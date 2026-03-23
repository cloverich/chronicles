# Swift Backend: Tooling & Library Research

> Research doc for the Chronicles Swift backend. Answers: what's built-in, what needs a package, and which package?

---

## Package Manager: SPM (Swift Package Manager)

**No real choice here.** SPM ships with Swift itself — it's the standard. CocoaPods is legacy, Carthage is dead. Every library below supports SPM.

SPM handles dependencies, builds, and test execution. One `Package.swift` file defines everything. `swift build` produces binaries, `swift test` runs XCTest suites. No `node_modules` equivalent sprawl — dependencies are compiled, not bundled.

---

## What's in Foundation (built-in, zero dependencies)

| Capability | Foundation API | Notes |
|---|---|---|
| JSON encode/decode | `JSONEncoder` / `JSONDecoder` + `Codable` | Type-safe, fast. All our IPC serialization. |
| File system | `FileManager`, `URL`, `Data` | Read/write/delete/enumerate files, check existence, get attributes (mtime, size) |
| Process spawning | `Process` (formerly `NSTask`) | Spawn subprocesses, pipe stdin/stdout/stderr. Used if we need to shell out. |
| String processing | `String`, `NSRegularExpression`, Swift Regex (5.7+) | Swift 5.7+ has first-class regex literals |
| Date/time | `Date`, `DateFormatter`, `ISO8601DateFormatter` | All our timestamp handling |
| Crypto hashing | `CryptoKit` (separate framework, ships with OS) | SHA256 for content hashing in the indexer |
| Async/concurrency | `async`/`await`, `Task`, structured concurrency | Built into the language since Swift 5.5 |
| stdin/stdout I/O | `FileHandle.standardInput` / `.standardOutput` | For the `--serve` daemon and MCP stdio transport |

**Bottom line:** JSON, files, process spawning, dates, hashing, async, and stdio are all built-in. No packages needed for any of these.

---

## External Packages Needed

### 1. GRDB.swift — SQLite + FTS5

- **What:** SQLite toolkit for Swift. Think "better Drizzle" — type-safe query builder, migrations, Codable record mapping.
- **Why:** First-class FTS5 support (create tables, query with MATCH, rank by relevance, custom tokenizers). Also handles our schema migrations — can run raw SQL files directly.
- **Maturity:** ~7.1k GitHub stars, actively maintained by Gwendal Roué, used by major apps. 10+ years old.
- **FTS5 specifics:** Supports `porter` and `unicode61` tokenizers (we use `porter unicode61`), external content tables, and custom tokenizers if we ever need them.
- **GitHub:** [groue/GRDB.swift](https://github.com/groue/GRDB.swift)
- **SPM:** `.package(url: "https://github.com/groue/GRDB.swift.git", from: "7.0.0")`

### 2. swift-argument-parser — CLI framework

- **What:** Apple's official CLI argument parsing library. Declarative, type-safe, auto-generates help text.
- **Why:** We need subcommands (`chronicles journals list`, `chronicles documents search --text "foo"`), flags (`--json`, `--serve`), and clean help output. This is the standard.
- **Maturity:** Apple-maintained, 3.7k stars, 41 releases, latest v1.7.0. Used by Swift's own tools.
- **GitHub:** [apple/swift-argument-parser](https://github.com/apple/swift-argument-parser)
- **SPM:** `.package(url: "https://github.com/apple/swift-argument-parser", from: "1.3.0")`

### 3. MCP Swift SDK — Model Context Protocol server

- **What:** Official Swift SDK for MCP. Provides server and client components, stdio transport built-in.
- **Why:** The `chronicles-mcp` binary needs to speak MCP protocol over stdio. This SDK handles framing, message parsing, tool/resource registration — we just implement the handlers.
- **Maturity:** Official (under `modelcontextprotocol` GitHub org). v0.11.0. Originally built by MacPaw/Loopwork, merged into the official org. Has `StdioTransport` built-in.
- **GitHub:** [modelcontextprotocol/swift-sdk](https://github.com/modelcontextprotocol/swift-sdk)
- **SPM:** `.package(url: "https://github.com/modelcontextprotocol/swift-sdk.git", from: "0.11.0")`
- **Note:** Relatively young (months not years), but it's the official SDK and implements the full spec.

### 4. Yams — YAML parser (for frontmatter)

- **What:** Swift YAML parser built on libYAML. Supports `Codable`.
- **Why:** We need to parse YAML frontmatter from markdown files (title, tags, createdAt, updatedAt). Yams lets us decode directly into a `Codable` struct.
- **Maturity:** MIT licensed, maintained by JP Simard (of SwiftLint fame). Powers SwiftLint, SwiftGen, XcodeGen, SourceKitten. Very battle-tested.
- **GitHub:** [jpsim/Yams](https://github.com/jpsim/Yams)
- **SPM:** `.package(url: "https://github.com/jpsim/Yams.git", from: "6.2.1")`

### 5. swift-markdown — Markdown parsing (Apple)

- **What:** Apple's markdown parser. Produces a typed AST (like mdast but Swift-native). Powered by cmark-gfm.
- **Why:** We need to walk markdown ASTs to extract links, images, and text content for FTS indexing.
- **Limitation:** Does NOT support YAML frontmatter natively ([open issue #73](https://github.com/swiftlang/swift-markdown/issues/73)). We strip the YAML block first, parse it with Yams, then parse the body with swift-markdown.
- **Maturity:** Apple/swiftlang maintained. Used in DocC (Apple's documentation system). 120 commits, 10 releases.
- **GitHub:** [swiftlang/swift-markdown](https://github.com/swiftlang/swift-markdown)
- **SPM:** `.package(url: "https://github.com/swiftlang/swift-markdown.git", from: "0.7.0")`

---

## Markdown Parsing Strategy

The current Node backend uses markdown for four things:

1. **Frontmatter extraction** — YAML block → `{ title, tags, createdAt, updatedAt }`
2. **Plain text for FTS** — markdown body → stripped text for the `documents_fts` table
3. **Link/image extraction** — walk AST to find `.md` links and image references
4. **Import processing** — convert Obsidian wikilinks (`[[Title]]`) and inline tags (`#tag`) to standard format

### Swift approach: Yams + swift-markdown (two-pass)

```swift
// 1. Split frontmatter from body (regex or simple string scan for --- delimiters)
let (yamlString, markdownBody) = splitFrontmatter(rawContent)

// 2. Parse YAML frontmatter with Yams
let frontmatter = try YAMLDecoder().decode(FrontMatter.self, from: yamlString)

// 3. Parse markdown body with swift-markdown
let document = Document(parsing: markdownBody)

// 4. Walk the AST for whatever we need
var visitor = ContentExtractor()  // extracts plain text, links, images
visitor.visit(document)
```

This is actually **simpler** than the Node approach, which chains micromark → mdast → multiple remark plugins. Two focused libraries instead of ~10 npm packages.

**Wikilink/tag handling for imports:** swift-markdown supports custom `BlockDirective` and `InlineCode` parsing, or we can pre-process with regex before parsing (wikilinks are simple patterns). This is import-only code — not on the hot path.

### Alternative considered: SwiftToolkit/frontmatter

[SwiftToolkit/frontmatter](https://github.com/SwiftToolkit/frontmatter) wraps Yams specifically for frontmatter parsing. Nice API but adds a dependency for ~20 lines of code we'd write anyway (split on `---`, decode YAML). Not worth the extra dependency.

---

## Summary: The Dependency List

```swift
// Package.swift dependencies
dependencies: [
    .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.0.0"),
    .package(url: "https://github.com/apple/swift-argument-parser", from: "1.3.0"),
    .package(url: "https://github.com/modelcontextprotocol/swift-sdk.git", from: "0.11.0"),
    .package(url: "https://github.com/jpsim/Yams.git", from: "6.2.1"),
    .package(url: "https://github.com/swiftlang/swift-markdown.git", from: "0.7.0"),
]
```

**5 dependencies total.** Compare to the current Node backend which pulls in ~10 packages just for markdown parsing, plus better-sqlite3, drizzle-orm, and their transitive deps.

| Package | Used by | Purpose |
|---|---|---|
| GRDB.swift | ChroniclesCore | SQLite, FTS5, migrations, record mapping |
| swift-argument-parser | `chronicles` CLI | Subcommands, flags, help text |
| MCP Swift SDK | `chronicles-mcp` | MCP protocol, stdio transport |
| Yams | ChroniclesCore | YAML frontmatter parsing |
| swift-markdown | ChroniclesCore | Markdown AST for link/image extraction + FTS text |

**What's NOT a dependency:**
- JSON (Foundation `Codable`)
- File system (Foundation `FileManager`)
- Process spawning (Foundation `Process`)
- Async/concurrency (language built-in)
- Crypto hashing (CryptoKit)
- stdin/stdout IO (Foundation `FileHandle`)
- HTTP (not needed — all IPC is stdio)
