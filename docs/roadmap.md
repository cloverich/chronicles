# Chronicles Roadmap (2026)

## Current Focus: High-Signal Ecosystem & Publishing

This roadmap outlines the transition of Chronicles from a "Local-First Journal" to a "High-Signal Authoring & Publishing Engine."

---

## 1. CLI Modernization & Standards

**Status:** In Progress (Design Phase)
**Goal:** Ensure all Chronicles scripts and tools adhere to the "Stdout for the Answer, Stderr for the Journey" rule.

- [x] Define CLI Authoring Guidelines ([docs/cli-authoring.md](cli-authoring.md))
- [x] Design CLI Modernization Project ([docs/designs/cli-modernization.md](designs/cli-modernization.md))
- [ ] Implement `cli-vibe-check` Skill (Auditor)
- [ ] Implement `cli-guardian` Skill (Builder)
- [ ] Audit & Patch existing scripts (`scripts/*.mjs`, `build.sh`)
  - [ ] `scripts/dev.mjs` (Vibe: Noisy/Broken)
  - [ ] `scripts/test.mjs` (Vibe: Pending) - See [Testing Philosophy](designs/testing-philosophy.md)

## 2. Publishing System (Phase 1)

**Status:** In Progress (Design Phase)
**Goal:** Extend the Preload Client to support "Publication Targets" for Hugo, Astro, and Substack.

- [x] Design Publishing Architecture ([docs/designs/publishing-system.md](designs/publishing-system.md))
- [ ] Implement Core Logic Library (`src/lib/publisher/`)
- [ ] Implement `PublisherClient` in Preload Layer
- [ ] Add "Publish" UI Toggle & Target Configuration
- [ ] Verify Asset Relocation (Image paths) for Hugo/Astro

---

## 3. Core Maintenance & Performance

**Goal:** Refining the foundational experience for daily note-taking (Ref: Issue #160).

- [ ] **Advanced Image Handling:** Move beyond simple lists to intelligent grouping and placement.
- [ ] **macOS Optimization:** Further refine native-style toolbar and overall system integration.
- [ ] **Theme Support:** Implementation of basic and custom themes. (Ref: [Theming Design](designs/theming.md))
- [ ] **Font Settings:** User-customizable typography for the editor.
- [ ] **Versioning:** Basic note versioning/history.
- [ ] **Encryption:** Opt-in encryption for local-first security.
- [ ] **UI Automation:** Improve stability and testing of interactive components. (Ref: [UI Driver](designs/ui-driver.md))

---

## 4. chronicles-cli

**Status:** In Progress (Design Phase)
**Goal:** Expose the Chronicles backend as a standalone CLI for scripting, LLM integration, and future MCP/TUI use.

- [x] Design CLI ([docs/designs/chronicles-cli.md](designs/chronicles-cli.md))
- [ ] Phase 0: Extract backend from Electron (de-Electron `IClient`, replace `electron-store`)
- [ ] Phase 1: Read-only commands + `index` (`journals list`, `docs search/get`, `tags list`)
- [ ] Phase 2: Mutation commands (`docs create/update/delete`, `journals create/rename/archive`)
- [ ] Phase 3: Access profiles (per-journal read/write permissions)
- [ ] Phase 4: Import + maintenance (`import`, `config get/set`, shell completions)

## 5. Future Initiatives

_Items in this section are pending prioritization or further research._

- [ ] **MCP Support:** Natural fast-follow once chronicles-cli is complete. (Ref: Issue #160, [CLI Design](designs/chronicles-cli.md#7-mcp-out-of-scope--design-notes))
- [ ] **Multi-Platform Support:** Linux and/or Windows builds. (Ref: Issue #160)
- [ ] **Cloud Sync (Optional):** Opt-in, encrypted sync for multi-device access.
- [ ] **Web UI (Optional):** A lightweight, browser-based viewer for published/synced notes.
- [ ] **Monetization:** Evaluate "Chronicles Publish" or "Sync" as a hosted service.

---

## Non-Features (Out of Scope)

Chronicles remains a focused, opinionated daily note-taking tool. The following are explicitly NOT planned (Ref: Issue #160):

- **Collaborative Real-time Editing** (Not a Google Docs/Notion competitor).
- **Complex Wiki-style Organization** (Not an Obsidian/Roam competitor).
- **Mind Mapping & Advanced Visual Layouts.**
