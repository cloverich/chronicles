# Desktop Framework Comparison 2026: Electron vs. Tauri vs. Electrobun

**Analysis Date:** February 23, 2026
**Context:** Evaluating framework options for Chronicles, a TypeScript-heavy local-first markdown notes app

---

## Executive Summary

**Recommendation for Chronicles:** Stay on Electron near-term, improve DX via Vite/Vitest migrations (see `VITE_MIGRATION.md`). Tauri is the credible alternative if mobile (iOS/Android) becomes a requirement; Electrobun is too early to plan around.

**Key Finding:** The Vitest migration should proceed independently of any framework decision — it's scoped to the renderer layer and survives any future migration.

---

## Current Chronicles Stack

- **Framework:** Electron 39.2.7
- **Build:** esbuild for all three bundles (main, preload, renderer)
- **Test:** Node.js native test runner, pre-compiled via esbuild
- **Frontend:** React 18, MobX, Slate/Plate.js, Radix UI, Tailwind CSS v4
- **Backend:** Node.js APIs in main process, SQLite via `better-sqlite3` + knex
- **Native Modules:** `better-sqlite3`, `sharp` (requires electron-rebuild)
- **Packaging:** `@electron/packager` v19, `@electron/rebuild`

**Key Architectural Points:**

- Three-process Electron architecture (main, preload, renderer)
- Context isolation enabled, sandbox disabled (for native modules)
- Custom `chronicles://` protocol handler
- `electron-store` for settings persistence

---

## Framework Deep Dive

### Electrobun

**What It Is:**
TypeScript-first desktop framework built on Bun runtime + Zig. Uses system webviews (WebKit/Edge WebView2/WebKitGTK) like Tauri. NOT a fork of Electron — completely different architecture with Bun runtime instead of Node.js.

**Current Status (Feb 2026):**

- **v1.0 shipped:** February 6, 2026 (three weeks ago)
- **GitHub stars:** ~6,400 at launch
- **Production apps:** Essentially one (the author's Blackboard app)
- **Plugin marketplace:** Not launched; planned for Q3 2026
- **Ecosystem:** Extremely thin — this is v1-week software

**Technical Highlights:**

- App bundles ~12-14 MB (using system webview)
- Startup time <50 ms
- Differential update patches as small as 14 KB (bsdiff)
- Typed end-to-end RPC between main and webview processes
- OOPIF (Out-of-Process IFrames) — webviews isolated in separate processes
- HMR + React + Tailwind works in one command via Bun bundler
- Cross-platform window controls, menus, accelerators, clipboard, dialogs built-in

**Limitations:**

- **Linux is broken.** WebKitGTK cannot handle Electrobun's advanced webview layering. The official workaround is `bundleCEF: true`, which adds ~150 MB and defeats the "tiny" premise.
- **Webview behavior differs across platforms.** macOS: hiding and passthrough are independent. Windows/Linux: hiding automatically enables passthrough (no separate setting). This is a real cross-platform consistency problem.
- **No cross-compilation.** Need separate CI runners for each OS.
- **Windows ARM not supported** (Bun limitation).
- **Ecosystem is vapor.** No plugin marketplace, minimal community tooling, <10 third-party production apps.
- **Very small community.** 6,400 stars vs. Tauri's much larger ecosystem.

**For Chronicles:**

- **Architectural fit is actually excellent.** Bun has built-in SQLite (`bun:sqlite`), so migrating from `better-sqlite3` would be relatively straightforward. The entire main process stays TypeScript — no Rust anywhere.
- **But ecosystem risk is disqualifying.** Chronicles would be betting on a framework with essentially one production app (the author's). Give this 12+ months and the plugin marketplace launch before considering.

---

### Tauri

**What It Is:**
Mature desktop framework (v1 shipped 2022, v2 stable Oct 2024) with Rust backend + any-JS-framework frontend. Uses system webviews like Electrobun. v2 added mobile (iOS/Android) as first-class targets.

**Current Status (Feb 2026):**

- **Latest stable:** v2.4.2
- **Ecosystem:** 3,800+ downstream repos on GitHub
- **Production apps:** GitButler (19k stars), Cap screen recorder, Jan AI assistant (40k stars)
- **Community:** 17,700+ Discord members
- **Foundation:** Under The Commons Conservancy (non-profit), security-audited
- **Adoption growth:** ~35% YoY per GitHub metrics

**Technical Highlights:**

- Installers <10 MB, startup <500 ms, RAM 20-50 MB idle
- Mobile support (iOS/Android) in v2
- Multi-webview support (behind feature flag)
- Swift + Kotlin bindings for plugins (in addition to Rust)
- Distribution targets: App Store, Play Store, Microsoft Store, Flathub, Snapcraft, AUR
- Security audit by Radically Open Security (NLNet/NGI funded)
- Hardened IPC, scope validation, IFrame API

**Limitations:**

- **Rust is required for anything beyond built-in plugins.** The frontend is any JS framework, but backend native capabilities require Rust. This is the primary barrier for TypeScript-only teams.
- **System webview inconsistency** (same as Electrobun): WebKit vs. Edge WebView2 vs. WebKitGTK behave differently. CSS/JS quirks vary.
- **WebView2 dependency on older Windows:** Edge WebView2 may not be installed on older Windows 10 systems. Tauri can bundle a bootstrapper but adds friction.
- **Plugin ecosystem smaller than Electron's** (though growing steadily).
- **No direct Node.js integration:** npm packages relying on Node.js APIs are not usable on the Rust side. Browser-compatible packages work fine in the frontend.
- Known bug with Rust Edition 2024 compatibility in `cargo_toml` dependency (GitHub issue [#11829](https://github.com/tauri-apps/tauri/issues/11829)).

**For Chronicles:**

- **Frontend transfers cleanly.** The React/MobX/Slate/Radix stack would be completely preserved.
- **Backend is expensive.** The entire database layer (`better-sqlite3` + knex with ~5 migrations, multiple query files) would need to move to Rust via `tauri-plugin-sql`. This isn't a surface swap — it's rewriting persistence in a different language.
- **Other migrations:** `sharp` would need a Rust image-processing crate. The IPC bridge/preload script becomes Tauri commands in Rust. `electron-store` and `chronicles://` protocol have direct Tauri equivalents (minor).
- **Bottom line:** Multi-month project. The cost is high relative to the actual pain points (which are build DX, not Electron fundamentally). If mobile becomes a requirement, the calculus changes.

---

### Electron

**Current for Chronicles:** v39.2.7

**Strengths:**

- **Full Node.js ecosystem** available in main process without restrictions
- **Consistent rendering:** Bundled Chromium eliminates cross-platform webview rendering differences
- **Mature packaging/auto-update/distribution tooling** (though Tauri/Electrobun have caught up)
- **Enormous community:** Years of Stack Overflow answers, mature ecosystem, proven production apps (VS Code, Obsidian, Slack, Discord)
- **100% TypeScript throughout** if desired, no secondary language required

**Weaknesses:**

- Installers 80-150 MB (bundled Chromium)
- RAM usage 150-400 MB idle
- Startup 1-2 seconds
- Ships its own Chromium per-app (disk duplication)
- **The actual pain for Chronicles:** slow HMR, build times, developer experience — NOT the framework fundamentally

**For Chronicles:**

- Already at v39, well-maintained
- All native modules work as-is
- The Vite migration (see `VITE_MIGRATION.md`) addresses the real DX pain without touching the framework layer

---


---

## Package Management & Tooling (2026)

### pnpm vs. Bun (as Package Manager)

**Context:** Chronicles uses a complex dependency tree (Plate.js, Remark, Radix) and sensitive native modules (`better-sqlite3`, `sharp`).

**pnpm (The Recommendation):**
- **Disk Efficiency:** Uses a content-addressable store to save space across projects.
- **Strictness:** Non-flat `node_modules` prevents "phantom dependencies," which is critical when working with the large, fragmented trees of the Slate/Plate and Remark ecosystems.
- **Stability:** Works perfectly with `electron-rebuild` and existing Node-API modules.
- **Verdict:** The safest and most efficient path for Chronicles in 2026.

**Bun (as Package Manager/Runtime):**
- **Speed:** `bun install` is significantly faster than Yarn/pnpm.
- **Runtime Risk:** Using the Bun runtime for the Main process risks breaking `better-sqlite3` and `sharp` due to ABI differences and missing Node-API shims.
- **Windows Support:** Still trails macOS/Linux stability for production desktop apps.
- **Verdict:** Excellent for one-off scripts or simple tools, but too risky as a primary runtime for a production Electron app with deep native dependencies.

---
## Migration Analysis for Chronicles

### Database Layer (Critical)

**Current:** `better-sqlite3` + knex query builder, ~5 migrations, multiple query files

**Tauri path:**

- Migrate to `tauri-plugin-sql` (Rust)
- Rewrite knex queries as raw SQL or Diesel ORM patterns
- Port migrations to Rust schema management
- **Effort:** High (weeks)

**Electrobun path:**

- Bun has built-in SQLite (`bun:sqlite`)
- Queries stay TypeScript, knex likely compatible or easily adapted
- **Effort:** Medium (days to low weeks)

**Electron path:**

- No change required

### Image Processing

**Current:** `sharp` (Node.js native module)

**Tauri path:**

- Use Rust `image` crate or similar
- Rewrite processing logic in Rust
- **Effort:** Medium

**Electrobun path:**

- `sharp` may work directly (Bun environment)
- If not, need Zig/C bindings or workaround
- **Effort:** Low to medium (unknown, ecosystem thin)

**Electron path:**

- No change required

### IPC / Context Bridge

**Current:** Preload script with context isolation

**Tauri path:**

- Rewrite as Tauri commands in Rust
- Frontend calls TypeScript wrappers around Tauri IPC
- **Effort:** Medium to high

**Electrobun path:**

- Use Electrobun's typed end-to-end RPC (TypeScript throughout)
- **Effort:** Low to medium

**Electron path:**

- No change required

### Testing (Vitest)

**All frameworks:**

- Vitest is scoped to the renderer layer (React components, stores, utilities)
- Chronicles tests are 100% renderer-side currently (TagStore, SearchStore, markdown parsing, etc.)
- **Vitest works identically regardless of framework** — it tests the React app, not the wrapper

**Conclusion:** Vitest migration is framework-agnostic and should proceed independently.

---

## Community Direction Signals (Feb 2026)

**Electron:**

- Losing developer mindshare for **new** projects
- Dominates installed base (VS Code, Slack, Obsidian, etc.) but new apps increasingly choose alternatives
- Still the "I need to ship quickly and can't afford edge cases" option

**Tauri:**

- Real adoption growth (+35% YoY)
- 3,800+ downstream repos, major production apps with 10k-50k stars
- The ecosystem is credible and mature
- Security audit, non-profit foundation, active development
- **The credible Electron alternative today**

**Electrobun:**

- v1-week software (Feb 6, 2026 launch)
- 6,400 stars, no significant production apps beyond the author's
- TypeScript-first architecture is genuinely interesting
- **Too early to plan around** — give it 12+ months minimum

**General trend:**

- System webview frameworks (Tauri, Electrobun) are the future direction for new desktop apps prioritizing bundle size and resource usage
- Electron remains pragmatic for maximum stability and ecosystem depth
- The "no Rust" selling point of Electrobun is meaningful for TypeScript-only teams, but ecosystem immaturity is disqualifying

---

## Practical Recommendation for Chronicles

### Near-term (2026):

1. **Stay on Electron**, improve DX via **Vite migration** (see `VITE_MIGRATION.md`)

   - Addresses actual pain points (slow HMR, build times)
   - No framework risk, preserves all investments
   - Vite brings HMR, fast CSS iteration, better dev experience

2. **Proceed with Vitest independently**

   - Natural follow-on after Vite renderer migration
   - Scoped entirely to renderer layer
   - Survives any future framework migration
   - Real value: HMR for tests, shared config, faster feedback loop

3. **Monitor Electrobun** through mid-2026

   - Watch for plugin marketplace launch (Q3 2026)
   - Watch for third-party production apps
   - Re-evaluate if ecosystem matures

4. **Keep Tauri as long-term option** if:
   - Mobile (iOS/Android) becomes a requirement
   - Bundle size becomes a critical business need
   - Multi-month migration project is acceptable cost

### Mid-term (2027+):

- If Electrobun ecosystem matures (plugin marketplace, 100+ production apps, stable cross-platform story), re-evaluate as "Electron replacement without Rust"
- If mobile becomes strategic, Tauri v2 is the proven path
- If neither applies, staying on Electron remains pragmatic

---

## Packaging Utilities

Current: `@electron/packager` v19, `@electron/rebuild`

**Relevance to framework migrations:**

- **Electron:** No change (existing tooling)
- **Tauri:** Replaced entirely by Tauri CLI (builds, signs, notarizes, packages)
- **Electrobun:** Replaced entirely by Electrobun's built-in tooling
- **Vite/Vitest migration:** Irrelevant — packaging consumes build artifacts, doesn't care what produces them

Packaging sits at the end of the pipeline; it's orthogonal to the Vite/Vitest decision.

---

## Appendix: Key Statistics (Feb 2026)

| Metric                       | Electron                | Tauri v2          | Electrobun               |
| ---------------------------- | ----------------------- | ----------------- | ------------------------ |
| **First stable**             | 2013                    | Oct 2024          | Feb 6, 2026              |
| **Latest version**           | 39.2.7                  | 2.4.2             | 1.0                      |
| **Installer size**           | 80-150 MB               | <10 MB            | 12-14 MB                 |
| **RAM idle**                 | 150-400 MB              | 20-50 MB          | Unknown (~30-60 MB est.) |
| **Startup time**             | 1-2 sec                 | <500 ms           | <50 ms                   |
| **Backend language**         | Node.js (JS/TS)         | Rust              | Bun (TS)                 |
| **Webview**                  | Bundled Chromium        | System webview    | System webview           |
| **Mobile support**           | No                      | Yes (iOS/Android) | No                       |
| **Cross-compilation**        | Yes                     | No                | No                       |
| **GitHub stars (framework)** | 114k                    | 89k               | 6.4k                     |
| **Production apps**          | Thousands               | Hundreds          | <10                      |
| **Ecosystem maturity**       | Very high               | High              | Very low                 |
| **Security audit**           | N/A (built on Chromium) | Yes (ROS, 2024)   | No                       |
| **Non-profit foundation**    | No                      | Yes (TCC)         | No                       |

---

## Sources

- [Electrobun v1 Launch](https://blackboard.sh/blog/electrobun-v1/)
- [Electrobun GitHub](https://github.com/blackboardsh/electrobun)
- [Electrobun Cross-Platform Development Docs](https://blackboard.sh/electrobun/docs/guides/cross-platform-development/)
- [Electrobun HN Discussion (Feb 2026)](https://news.ycombinator.com/item?id=47069650)
- [Tauri 2.0 Stable Release](https://v2.tauri.app/blog/tauri-20/)
- [Tauri Core Ecosystem Releases](https://v2.tauri.app/release/)
- [Tauri Community Growth & Feedback](https://v2.tauri.app/blog/tauri-community-growth-and-feedback/)
- [Tauri vs Electron - DoltHub (Nov 2025)](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/)
- [Best framework for desktop application in 2026 - Tibicle](https://tibicle.com/blog/best-framework-for-desktop-application-in-2026)

---

**Last Updated:** February 23, 2026
**Next Review:** Q3 2026 (after Electrobun plugin marketplace launch)
