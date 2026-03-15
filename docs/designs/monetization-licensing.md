# Design Doc: Monetization & Licensing (Brainstorming)

**Status:** Brainstorming / Exploration (No commitments)

## Context

Chronicles has reached a level of maturity where protecting the intellectual property and exploring sustainable monetization is a priority. The rise of LLM-based "code cribbing" and automated app cloning necessitates a shift in how the source code and distribution are handled.

## Goals

1.  **Protect Source Code:** Prevent low-effort cloning and re-selling of the application logic.
2.  **Explore Monetization:** Evaluate licensing models that handle global tax compliance (VAT/GST) and user licensing with minimal overhead.
3.  **Preserve "Local-First" UX:** Ensure that any licensing or DRM does not break the core promise of a private, offline-capable journaling tool.
4.  **Minimize Technical Debt:** Avoid complex "Technical Taxes" like aggressive sandboxing if they do not provide proportional value.

---

## Strategy 1: Source Protection & Distribution

To prevent "straight-up taking" and re-selling, we move from a fully open-source model to a "Private Core, Public Release" model.

### 1. Private Repository

Move the main development repository to a private GitHub repo. This immediately stops LLM scrapers and low-effort forks.

### 2. Public "Releases" Repository

Maintain a public repository (e.g., `chronicles-app/releases`) containing:

- **GitHub Releases:** DMGs, installers, and changelogs.
- **Issue Tracker:** A public place for bug reports and feature requests.
- **Documentation:** `README.md` and user guides.
- **Benefit:** Keeps the familiar GitHub "Star/Download" workflow and free artifact hosting.

### 3. Build-Time Obfuscation Options

To protect the source code from being cribbed by LLMs or humans, we evaluate the following:

- **Option A: `javascript-obfuscator` (Variable/String Transformation)**
  - _How:_ Renames variables, encrypts strings, and adds dead-code injection.
  - _Pros:_ Easy to integrate into the esbuild pipeline; effectively poisons the code for LLM analysis.
  - _Cons:_ Can slightly increase bundle size and impact runtime performance if set too aggressively.

- **Option B: `Bytenode` (V8 Bytecode Compilation)**
  - _How:_ Compiles JavaScript into V8 bytecode files (`.jsc`) which are then loaded by Electron.
  - _Pros:_ High level of protection; the actual JS source is never present in the `.asar`. Extremely difficult to reverse-engineer.
  - _Cons:_ Makes debugging in production harder; requires specific loading logic in the main/preload processes.

- **Option C: Custom "Thin-Core" Approach**
  - _How:_ Keep the majority of the app readable but move "proprietary" logic (licensing, advanced markdown transforms) into a separate, highly obfuscated module or a small native C++ addon.
  - _Pros:_ Respects the "tinkerer" spirit for 90% of the app while protecting the commercial value.

---

## Strategy 2: Licensing & Monetization Models

Three primary paths are under consideration:

### A. Mac App Store (MAS)

- **Pros:**
  - Apple handles all licensing and global tax compliance.
  - Built-in trust and "one-click" purchase for users.
- **Cons (The "Technical Tax"):**
  - **Sandboxing:** Mandatory. Requires "Security-Scoped Bookmarks" for file system access (affects `notesDir` selection).
  - **Native Modules:** `better-sqlite3` and `sharp` require complex signing and entitlements.
  - **Review Process:** Subject to Apple's manual review and potential rejections.

### B. Merchant of Record (LemonSqueezy / Paddle)

- **Pros:**
  - Handles VAT/GST and global payments (Merchant of Record).
  - No mandatory sandboxing; full access to local filesystem.
  - Lower fees (~5% vs Apple's 15-30%).
- **Cons:**
  - Requires a custom "Activation" flow to prevent license sharing.
  - Requires a single-time internet connection for activation.

### C. The "Service Layer" Model (Obsidian Style)

- **Pros:**
  - Core app remains free (or "Nagware").
  - Monetize via "Add-on" services like **Chronicles Sync** or **Chronicles Publish**.
  - Avoids the friction of initial payment.
- **Cons:**
  - Requires building and maintaining server-side infrastructure.
  - Harder to monetize "purely local" users.

---

## Technical Implementation: Licensing (Non-MAS)

If choosing Strategy B (LemonSqueezy), the following pattern is proposed to prevent key sharing without being overly intrusive.

### 1. Machine Fingerprinting Options

The app needs to know it is running on an authorized machine without "spying" on the user or blocking their ability to tinker.

- **Option A: Hard Hardware Binding (IOPlatformUUID)**
  - _Mechanism:_ Read the macOS `IOPlatformUUID` or a combination of serial numbers.
  - _Privacy:_ **Low.** This is a persistent, unique identifier that can be tied back to a physical machine across different software.
  - _Control:_ High prevention of license sharing.

- **Option B: Privacy-Preserving Hashed Fingerprint (Salted SHA-256)**
  - _Mechanism:_ Concatenate `(IOPlatformUUID + App-Specific-Salt)` and hash it. Only the hash is ever sent to the server.
  - _Privacy:_ **Medium.** The original hardware ID is never transmitted. The server only sees an opaque string that it can't use to identify the machine in any other context.
  - _Control:_ Good balance; prevents key sharing while protecting machine identity.

- **Option C: Soft Device ID (Random UUID)**
  - _Mechanism:_ Generate a random UUID on first run and store it in `electron-store`.
  - _Privacy:_ **High.** No hardware data is collected. The "fingerprint" is just a random number unique to that installation.
  - _Control:_ Low. A user could technically reset this ID or copy the store file to another machine to bypass device limits. This is an "Honor System" approach that relies on the "Middle Ground" philosophy.

### 2. Activation vs. Validation

- **Activation (One-time):** App sends `(LicenseKey, MachineFingerprint)` to an API. Server records the device and returns a **Signed Activation Token**.
- **Validation (Local):** On every launch, the app verifies the local token using a public key. No internet required.

### 3. Offline Grace Period

To respect "Local-First" values:

- If a server check is required (e.g., every 30 days), allow a **14-day grace period** if the user is offline.
- Never "lock" the user out of their data; at worst, the editor becomes read-only if the license expires or is revoked.

---

## Evaluation Criteria

| Metric                     | Mac App Store        | LemonSqueezy           | Service Layer               |
| :------------------------- | :------------------- | :--------------------- | :-------------------------- |
| **Ease of Implementation** | Low (Heavy Refactor) | High (API Integration) | Medium (New Infrastructure) |
| **Tax/License Overhead**   | Zero                 | Zero                   | High (if self-hosted)       |
| **User Privacy**           | High                 | Medium (API Call)      | Low (Sync Data)             |
| **LLM Protection**         | High                 | Medium (Obfuscation)   | Low                         |

---

## Next Steps (Exploratory)

1. **Audit `better-sqlite3` for MAS:** Research the current state of MAS validation for native SQLite modules in Electron.
2. **Prototype Obfuscation:** Add a test obfuscation step to the production build to measure performance impact.
3. **Draft License UI:** Design a simple "Trial/License" screen in the `preferences` view.
