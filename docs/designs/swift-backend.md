# Swift Backend Exploration

**Status:** Exploration / RFC
**Date:** 2026-03-22
**Context:** PR #486 (MCP Node port) completes the Bun removal. The backend is fully cleaved. Time to evaluate Swift as the backend runtime targeting macOS + iOS.

---

## Why Swift?

The Electrobun experiment (see [electrobun-migration.md](../plans/pending/electrobun-migration.md)) proved two things:

1. **The backend cleaves cleanly.** `bun-client` and `node-client` both implement `IClient` independently. The API surface is well-defined (~50 methods across 8 modules).
2. **WebView-based shells hit the same media issues regardless of framework.** Custom protocol handlers for local files (images, fonts) are a recurring pain point — Electron's `registerFileProtocol`, Electrobun's missing `WKURLSchemeHandler`, etc.

Swift solves the media problem natively (`WKURLSchemeHandler` is a first-class API in Swift/WKWebView) and unlocks the real prize: **iOS + macOS from one codebase.**

### What we gain

| Benefit | Details |
|---------|---------|
| **iOS target** | SwiftUI shell + WKWebView editor = universal app. Same notes dir via iCloud Drive or local sync. |
| **Native file serving** | `WKURLSchemeHandler` — no localhost HTTP server hack, no custom protocol registration. Just intercept `chronicles://` URLs natively. |
| **Native performance** | SQLite via GRDB (or raw C API), <100ms startup, 30-50MB RAM |
| **System integration** | Spotlight, Widgets, Share Sheet, Shortcuts, native menus, haptics |
| **App Store distribution** | No Chromium blob. Tiny bundle (~5-10MB). Passes App Store review trivially. |
| **Long-term maintainability** | Apple's first-party language. No framework to go stale (Electron, Electrobun, Tauri all have this risk). |

### What we lose

| Cost | Details |
|------|---------|
| **Windows/Linux** | Dead. macOS/iOS only. (Chronicles has never shipped on these anyway.) |
| **TypeScript backend** | The node-client/bun-client work becomes the reference implementation, not production code. |
| **AI-assisted coding velocity** | Swift is less well-covered than TypeScript in LLM training data. Coding from phone (Cursor, Claude Code web) may be harder — but see DevX section, it's better than expected. |
| **WebKit rendering** | Tied to system WebKit version. Same issue as Electrobun/Tauri but now it's permanent. |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Swift App                       │
│                                                  │
│  ┌──────────┐  ┌──────────────────────────────┐ │
│  │ SwiftUI  │  │       WKWebView              │ │
│  │ Shell    │  │  (Vite React app)             │ │
│  │          │  │                               │ │
│  │ - Menus  │  │  window.chronicles.* bridge   │ │
│  │ - Prefs  │  │  ← WKScriptMessageHandler    │ │
│  │ - Fonts  │  │  → evaluateJavaScript         │ │
│  └──────────┘  └──────────────────────────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │            Swift Backend                      ││
│  │                                               ││
│  │  GRDB (SQLite)  │  FileManager  │  Settings  ││
│  │  - journals     │  - notesDir   │  - prefs   ││
│  │  - documents    │  - attachments│  - themes  ││
│  │  - FTS5 search  │  - indexer    │            ││
│  │  - tags         │  - importer   │            ││
│  └──────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘

    chronicles:// URLs
    └── WKURLSchemeHandler intercepts
        └── serves files from notesDir/_attachments/
```

### The Bridge (IPC)

Same `window.chronicles` shape the renderer already expects. Implementation:

**JS → Swift** (calls from React):
```javascript
// Renderer calls:
window.chronicles.getClient().journals.list()

// Under the hood:
window.webkit.messageHandlers.chronicles.postMessage({
  module: "journals", method: "list", args: [], callId: "abc123"
})
```

**Swift → JS** (responses):
```swift
webView.evaluateJavaScript(
  "window.__chroniclesResolve('abc123', \(jsonPayload))"
)
```

This is the exact same dispatch pattern as the Electrobun RPC (`clientCall` with `{ module, method, args }`), just using WKWebView's native message handler instead of Electrobun's RPC channel. The JS shim that creates the `Proxy`-based IClient is ~50 lines and can be shared.

### Database: GRDB

[GRDB](https://github.com/groue/GRDB.swift) is the gold standard Swift SQLite library:

- Full FTS5 support (our search depends on this)
- WAL mode, foreign keys, all the pragmas we use
- Type-safe query builder (or raw SQL when needed)
- Migration system
- 10k+ GitHub stars, actively maintained, used in production by major apps

The schema is identical — same tables, same FTS5 virtual table, same migrations (SQL is portable). We'd write the migration runner in Swift but the SQL files themselves can be reused verbatim.

### Media: WKURLSchemeHandler

This is the key win over Electrobun. In Swift:

```swift
class ChroniclesSchemeHandler: NSObject, WKURLSchemeHandler {
    let notesDir: URL

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url,
              let relativePath = extractRelativePath(url) else {
            urlSchemeTask.didFailWithError(/* ... */)
            return
        }

        let fileURL = notesDir.appendingPathComponent("_attachments").appendingPathComponent(relativePath)

        // Security: validate path is within notesDir
        guard fileURL.standardized.path.hasPrefix(notesDir.standardized.path) else {
            urlSchemeTask.didFailWithError(/* ... */)
            return
        }

        // Serve the file
        let data = try! Data(contentsOf: fileURL)
        let response = URLResponse(url: url, mimeType: mimeType(for: fileURL), expectedContentLength: data.count, textEncodingName: nil)
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }
}
```

No localhost HTTP server. No CSP hacks. The `chronicles://` URLs the markdown files already reference Just Work.

---

## Migration Strategy

### What stays (unchanged)

```
src/views/           # All React components — identical
src/components/      # All UI components — identical
src/hooks/           # MobX stores, React hooks — identical
src/markdown/        # Parsing/serialization — identical
src/themes/          # Theme system — identical
src/fonts/           # Font system — mostly identical (fs calls move to bridge)
vite.config.ts       # Vite dev server — identical
```

**The entire renderer is unchanged.** It talks to `window.chronicles` and doesn't know or care what's behind it.

### What gets rewritten in Swift

| Module | TS Lines | Swift Complexity | Notes |
|--------|----------|-----------------|-------|
| `journals` | ~120 | Low | CRUD on one table |
| `documents` | ~250 | Medium | FTS5 queries, file I/O |
| `tags` | ~60 | Low | One aggregate query |
| `preferences` | ~80 | Low | JSON file read/write |
| `files` | ~200 | Medium | Directory ops, markdown read/write |
| `indexer` | ~350 | High | Incremental sync, mtime/hash, FTS rebuild |
| `importer` | ~400 | High | Notion/Obsidian parsing, file copying |
| `bulk-operations` | ~150 | Medium | Batch mutations |
| **Total** | ~1,610 | | |

The node-client is ~1,600 lines of business logic. In Swift this might be ~2,000-2,500 lines (Swift is more verbose for the same operations). The indexer and importer are the hardest — they do markdown parsing (micromark) which has no Swift equivalent. Options:

1. **Keep markdown parsing in JS.** The indexer calls into the WebView (or a headless JSContext) for parsing, gets back MDAST, then indexes in Swift. Weird but pragmatic.
2. **Use swift-markdown.** Apple's own [swift-markdown](https://github.com/apple/swift-markdown) library. Doesn't support our custom syntax (#tags, [[wikilinks]], OFM extensions). Would need extensions.
3. **Use cmark-gfm via C interop.** Closer to our micromark pipeline but still missing custom syntax.
4. **Port micromark extensions to Swift.** Nuclear option. Don't do this.

**Recommendation:** Option 1 (JS parsing) for the initial port. The indexer already runs as a background job — having it call into a JSContext for parsing is acceptable. Revisit if performance is a problem (it won't be for <10k documents).

### What gets deleted

```
src/electron/        # Main process
src/preload/         # IPC bridge
src/node-client/     # Node.js backend (reference only, no longer deployed)
src/bun-client/      # Bun backend (reference only)
```

**The node-client becomes reference code only.** The MCP server also moves to Swift (see Package Structure below). The whole point is escaping the native dependency rebuild treadmill — keeping MCP on Node with better-sqlite3 would defeat the purpose.

### Swift Package Structure

```
Package.swift
├── ChroniclesCore    (library: GRDB, indexer, all business logic)
├── ChroniclesApp     (executable: SwiftUI + WKWebView shell)
└── ChroniclesMCP     (executable: stdio MCP server, imports ChroniclesCore)
```

Single `swift build`, two binaries, zero `node-gyp`, zero `electron-rebuild`. The MCP server becomes a ~5MB static binary — distribute it anywhere, no runtime dependencies.

---

## DevX Changes

### Xcode: when is it actually required?

**Xcode is NOT required for most development.** The backend is a standard Swift Package Manager project. The entire non-UI layer — GRDB, SQLite, indexer, MCP server — builds and tests from the command line.

| Task | Tool | Xcode needed? |
|------|------|---------------|
| Edit Swift backend | VS Code/Cursor + [sourcekit-lsp](https://github.com/swiftlang/vscode-swift) | No |
| Build/test backend | `swift build && swift test` | No |
| Run MCP server | `swift run chronicles-mcp` | No |
| Edit React frontend | VS Code / Cursor | No |
| Dev mode (WKWebView + Vite) | `swift run chronicles-app` + `yarn dev` | No |
| iOS simulator testing | Xcode | Yes |
| App Store submission | `xcodebuild` (can be CI-only) | Yes (CLI tools) |
| SwiftUI previews | Xcode | Yes |
| Debugging gnarly layout | Xcode | Helpful |

You can [build a SwiftUI + WKWebView app purely from SPM](https://theswiftdev.com/how-to-build-macos-apps-using-only-the-swift-package-manager/) — `swift build` produces a binary that imports AppKit/WebKit just fine. For dev, you don't even need a `.app` bundle — just run the binary directly. There's a [minimal example](https://github.com/eudoxia0/swiftui-without-xcode) of this approach.

**Swift 6.1+** added automatic background indexing for sourcekit-lsp, so VS Code/Cursor now gives proper autocomplete, jump-to-definition, and diagnostics without manual builds. This was a major friction point that's now resolved.

### Current workflow (Electron)

```bash
HEADLESS=true yarn start    # Electron + Vite dev server
# Edit React code → HMR in Electron window
# Edit backend code → restart Electron
```

### Swift workflow

```bash
# Terminal 1: Vite dev server (unchanged)
yarn dev:renderer    # or: npx vite

# Terminal 2:
swift run chronicles-app
# Swift app loads http://localhost:5173 in WKWebView
# Edit React code → HMR in WKWebView (same as today)
# Edit Swift backend → ⌃C, swift build && swift run (~2-5s incremental)
```

**Key difference:** Backend changes require a `swift build` (~2-5s incremental) instead of a Node.js restart. Comparable speed. Full builds are slower (~15-30s) but rare.

**Editor story:** Edit everything in VS Code/Cursor. sourcekit-lsp handles Swift, TypeScript tooling handles the frontend. No editor split needed — same as writing a Rust+JS project in VS Code today.

### Coding from phone

| Tool | Swift support | TypeScript support | Verdict |
|------|--------------|-------------------|---------|
| **Claude Code (web)** | Can generate Swift, can't build/test | Full support | Swift is write-only from phone |
| **GitHub Codespaces** | No macOS SDK | Full support | Swift backend can't run |
| **Cursor mobile** | Limited | Full support | Same limitation |

**Reality:** You can't build or test Swift code from a phone or Codespace (needs macOS SDK for AppKit/WebKit imports). The React frontend remains fully editable from anywhere.

**Mitigations:**
1. **Backend API is stable and small** (~50 methods). Most day-to-day work is frontend. Backend changes can wait for a mac session.
2. **Keep node-client as a dev shim.** When coding from phone, run Vite + node-client in a Codespace. The renderer doesn't care which backend serves `window.chronicles`. Full-stack mobile development for everything except Swift-specific features.
3. **`swift test` for pure logic** — the `ChroniclesCore` library (GRDB queries, indexer logic, file ops) imports only Foundation, not AppKit. This subset *could* potentially build on Linux in a Codespace, though this is untested and not a priority.

**Bottom line:** Phone coding story is "same as today for frontend, write-only for backend, use node-client shim for full-stack dev." Acceptable given backend change frequency.

---

## iOS Considerations

### WKWebView on iOS

The Lexical editor is designed for mobile WebViews (it's what Meta uses for Facebook/Instagram's rich text on iOS). This is why the [framework comparison](framework-comparison-2026.md) identified Lexical as a prerequisite.

**Current editor status:** Lexical is now the default editor (per electron-modernization). This prerequisite is already met.

### Data sync

Markdown files on disk are the source of truth. For iOS sync:

1. **iCloud Drive:** Put `notesDir` in iCloud Drive. macOS and iOS both read/write the same files. SQLite index is per-device (rebuilt from files on first launch).
2. **iCloud CloudKit:** More complex but allows selective sync, conflict resolution. Overkill for v1.
3. **Git:** The notes directory is already git-friendly. Could sync via Working Copy (iOS git client).

**Recommendation:** iCloud Drive for v1. It's zero-effort — just point the app at the right directory.

### App architecture on iOS

```
iOS App
├── SwiftUI (navigation, settings, share sheet)
├── WKWebView (editor — full Lexical/React app)
├── GRDB (same schema, same SQLite, rebuilt index)
└── FileManager (same notes directory via iCloud)
```

95% of the Swift backend code is shared between macOS and iOS. The shell differs (UIKit/SwiftUI layout vs. AppKit/SwiftUI), but the backend modules are platform-agnostic.

---

## Phased Approach

### Incremental Strategy: Swift backend under Electron first

Instead of building the Swift app shell and backend simultaneously, rewrite the backend in Swift while the app remains Electron. The Electron main process spawns the Swift backend as a subprocess, communicating over stdio JSON-RPC — the same `clientCall({ module, method, args })` dispatch pattern Electrobun used.

This means:
- **No big-bang migration.** Backend and shell are independent workstreams.
- **Immediate value.** The Swift backend is usable from day one (Electron ships it as a subprocess).
- **The MCP server comes free.** Same Swift binary, same `ChroniclesCore` library, different transport (stdio for MCP vs. stdio for Electron IPC).
- **Shell swap is the final step.** Replace Electron with SwiftUI+WKWebView only after the backend is proven.

#### The IPC Bridge

The seam is `src/preload/client/factory.ts` — currently 25 lines that create a `NodeClient` in-process:

```typescript
// Today: in-process
const nodeClient = await createNodeClient({ dbPath, notesDir, settingsDir });
return { journals: nodeClient.journals, documents: nodeClient.documents, ... };
```

Replace with a subprocess bridge:

```typescript
// Tomorrow: subprocess
const swiftProcess = spawn("path/to/chronicles-backend", ["--stdio"], { stdio: ["pipe", "pipe", "inherit"] });
const rpc = createStdioRPC(swiftProcess.stdin, swiftProcess.stdout);

// Same Proxy pattern as Electrobun's chronicles-shim.ts
return new Proxy({}, {
  get: (_, module: string) => new Proxy({}, {
    get: (_, method: string) => (...args: unknown[]) =>
      rpc.request({ module, method, args })
  })
}) as IClient;
```

This is almost identical to the Electrobun `chronicles-shim.ts` Proxy pattern (see `src/electrobun/chronicles-shim.ts`), just with stdio instead of Electrobun's RPC channel. The renderer and preload bridge don't change at all — `window.chronicles.getClient()` returns the same `IClient` shape.

The ~13 utility methods (dialogs, themes, fonts, openPath) stay in Electron's main process — they need Electron APIs (dialog, shell, nativeTheme). They'll move to Swift only in the final shell swap.

#### What about the non-IClient methods?

The `window.chronicles` API has two layers:
1. **IClient methods** (~50 methods across 8 modules) — these move to Swift subprocess
2. **Utility methods** (13 methods: dialogs, themes, fonts, openPath, setNativeTheme) — these stay in Electron until shell swap

This split is clean because the utility methods use Electron APIs that don't exist in a subprocess. During the Electron→Swift shell swap, they move to SwiftUI native equivalents (NSOpenPanel, NSFontManager, etc.).

---

### Phase 0: Swift Package + GRDB Schema (1-2 days)

- Create `chronicles-swift/` directory (monorepo — same repo, separate package manager)
- Set up Swift Package with GRDB dependency
- Port the Drizzle schema to GRDB table definitions
- Port migrations (reuse SQL files directly — they're just SQL)
- Write tests against in-memory SQLite
- **Validate:** Schema matches, migrations run, tables created

### Phase 1: Core Backend + stdio RPC (~1 week)

- Implement journals, documents, tags, preferences, files in Swift
- FTS5 search (GRDB has first-class support)
- Add a `chronicles-backend` executable target with stdio JSON-RPC transport
- Test against a real notes directory
- **Validate:** Same queries, same results as node-client (can run both side-by-side against same DB)

### Phase 2: Wire into Electron (~2-3 days)

- Replace `src/preload/client/factory.ts` to spawn Swift subprocess
- Proxy-based IClient bridge (reuse Electrobun `chronicles-shim.ts` pattern)
- Bundle the Swift binary in the Electron app (`scripts/build.sh` change)
- **Validate:** Full app works end-to-end, Electron shell unchanged, Swift backend underneath

### Phase 3: Indexer + Importer (~1 week)

- Port incremental indexer (mtime/hash/FTS rebuild)
- Markdown parsing via embedded JSContext (or swift-markdown if sufficient)
- Port importer (Notion, Obsidian)
- MCP server target (same `ChroniclesCore`, stdio MCP transport)
- **Validate:** Indexing works, MCP server responds correctly

### Phase 4: Swift App Shell (~1 week)

- SwiftUI macOS app with WKWebView
- `WKURLSchemeHandler` for `chronicles://` URLs
- `WKScriptMessageHandler` bridge (JS ↔ Swift IPC — in-process now, no subprocess needed)
- Port utility methods (dialogs, themes, fonts) to SwiftUI/AppKit
- **Validate:** React app works fully through native Swift shell

### Phase 5: iOS Shell (~1 week)

- SwiftUI iOS app sharing `ChroniclesCore`
- iCloud Drive notes directory
- Mobile-optimized navigation
- **Validate:** create/edit/search documents on iPhone

### Phase 6: Cut Over

- App Store submission (macOS + iOS)
- Delete `src/electron/`, `src/preload/`, `src/node-client/`
- Keep `src/bun-client/` as reference only

---

## Open Questions

1. **Separate repo or monorepo?** The Swift package could live in `chronicles-swift/` within the existing repo (monorepo) or in a separate `chronicles-native` repo. Monorepo keeps everything together but mixes npm and Swift Package Manager. Separate repo is cleaner but splits the project.

2. **~~MCP server: keep Node or port to Swift?~~** **Resolved: Port to Swift.** The whole motivation is escaping native dependency rebuild hell. A Swift MCP server is just another target in the same Swift package — single `swift build`, ~5MB binary, zero runtime dependencies.

3. **Markdown parsing strategy?** The indexer needs to parse markdown to extract tags, links, and content for FTS. Using a JSContext from Swift works but is architecturally weird. swift-markdown is cleaner but may not support our custom syntax. Need a spike.

4. **How much SwiftUI vs. how much WKWebView?** Pure approach: everything except menus/window chrome is in the WebView. Hybrid approach: sidebar navigation in SwiftUI, editor in WKWebView. The hybrid approach is more native-feeling on iOS but means reimplementing UI in two places.

5. **Timeline vs. PR #486 and current work?** This is a significant pivot. Should we finish current Electron maintenance (theming, fonts, vitest) first, or start the Swift work in parallel?

---

## Decision Framework

**Do this if:**
- iOS is a real target (not hypothetical)
- You're willing to develop backend exclusively on Mac
- The 4-6 week timeline is acceptable
- You're okay losing Windows/Linux forever

**Don't do this if:**
- Cross-platform matters eventually
- Mobile coding velocity is critical
- The current Electron app is "good enough" for the foreseeable future

**The middle path:** Start Phase 0-1 as a spike. Port the schema and core CRUD to Swift, run tests, see how it feels. If the GRDB + FTS5 story works well and the bridge prototype is clean, commit to the full migration. If it feels wrong, you've lost 2-3 days and gained certainty.

---

## References

- [Framework Comparison 2026](framework-comparison-2026.md) — identifies Swift+WebView as long-term recommendation
- [Electrobun Migration](../plans/pending/electrobun-migration.md) — prior art on cleaving the backend, media issues
- [GRDB.swift](https://github.com/groue/GRDB.swift) — SQLite for Swift
- [swift-markdown](https://github.com/apple/swift-markdown) — Apple's markdown parser
- [WKURLSchemeHandler](https://developer.apple.com/documentation/webkit/wkurlschemehandler) — native custom URL schemes in WKWebView
