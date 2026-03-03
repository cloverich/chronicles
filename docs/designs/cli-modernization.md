# Design Doc: CLI Modernization & Tooling Standards

## Context

As Chronicles matures, its internal scripting ecosystem—spanning build tools, test runners, and development utilities—has become a primary interface for both human developers and automated agents (LLMs). Current tools often exhibit "stream pollution," where diagnostic logs and interactive UI elements leak into `stdout`, complicating piping, logging, and machine parsing.

This document establishes the vision for a "high-signal" CLI ecosystem that treats humans and machines as first-class citizens.

## Reference

All modernization efforts must adhere to the principles defined in [docs/cli-authoring.md](../cli-authoring.md).

## The Lay of the Land

Chronicles currently utilizes a mix of Shell, Node.js (MJS), and third-party CLI tools.

- **Node.js Scripts (`scripts/*.mjs`):** These handle complex tasks like dev-mode orchestration and test running. They often use `console.log` indiscriminately, mixing "The Answer" with "The Journey."
- **Shell Scripts (`build.sh`):** High-level entry points that aggregate output from multiple sub-commands.
- **Package Scripts (`package.json`):** The primary UI for developers, often wrapping tools like `tsc`, `prettier`, and `esbuild` which have varying levels of stream discipline.

## Goals

1.  **Strict Stream Discipline:** Ensure `stdout` is reserved for data/results and `stderr` for logs/progress.
2.  **Environment Awareness:** Tools should automatically adapt their output based on whether they are in a TTY (Human) or a Pipe (Machine/LLM).
3.  **Actionable Failures:** Error messages must move beyond "Error: Code X" to providing a "Next Step" suggestion on `stderr`.
4.  **LLM Compatibility:** Provide high-signal, low-token noise output for AI agents.

## Success Criteria (Evaluation)

A modernized CLI tool is considered successful if it passes the following checks:

- **The Silence Test:** Running the tool with `> /dev/null` leaves the terminal empty (logs moved to `stderr`).
- **The Pipe Test:** Piped output contains zero ANSI color codes or spinner characters unless explicitly requested.
- **The JSON Test:** Data-heavy commands offer a `--json` flag that matches the text output's schema.
- **The LLM Vibe Check:** An LLM agent can successfully interpret the tool's failure and fix the state without manual human intervention.

## Proposed Strategy: Guardian & Vibe-Check

To maintain these standards without manual toil, we propose two specialized skills:

### 1. `cli-guardian` (The Builder)

A skill focused on the **Synthesis** of new tools. It provides standardized templates for:

- `isTTY` detection logic.
- Standardized flag parsing (`--json`, `--verbose`, `--quiet`).
- Structured error handling that separates the error message from the remedial instruction.

### 2. `cli-vibe-check` (The Auditor)

A skill focused on the **Evaluation** of existing tools. It performs automated "smoke tests":

- Inspects code for `console.log` vs `console.error` usage.
- Executes tools in varied environments (TTY vs non-TTY) to verify behavioral shifts.
- Scores tools on a "Vibe Scale" (Pristine, Functional, Noisy, Broken) to prioritize refactoring efforts.

## Initial Audit: Skill Scripts

Scripts audited against the Success Criteria above.

| Script                                          | Silence Test | Errors → stderr | Actionable Errors | TTY Aware |      Vibe      |
| ----------------------------------------------- | :----------: | :-------------: | :---------------: | :-------: | :------------: |
| `build.sh`                                      |      ❌      |     Partial     |      Partial      |    ❌     |   **Noisy**    |
| `skills/local-install/scripts/install-build.sh` |      ❌      |       ❌        |      Partial      |    ❌     |   **Noisy**    |
| `skills/release/scripts/preflight.sh`           |      ✅      |       ✅        |        ✅         |    ❌     | **Functional** |
| `skills/release/scripts/create-release.sh`      |      ❌      |       ✅        |      Partial      |    ❌     |   **Noisy**    |

### `build.sh` — Noisy

All progress messages (`echo "Using build number..."`, `echo "Building package..."`, `echo "Copying electron folder"`) go to `stdout`. Only one error case correctly uses `>&2`. Fails the Silence Test immediately. Has no TTY detection, no `--json` flag. The one error message ("Increment build number.") is actionable; the rest are journaling noise on the wrong stream.

**Priority fixes:** Move all progress `echo` lines to `>&2`.

### `install-build.sh` — Noisy

Every line of output — including the final success message and error messages — goes to `stdout`. The error path (`echo "Error: Build failed..."`) does not use `>&2`, meaning an agent piping stdout would receive error text in the data stream. Build log path is reported on failure (good); success path tells you how to launch the app (reasonable for human UX, but leaks to stdout). No TTY awareness.

**Priority fixes:** Route all `echo` progress/status lines to `>&2`; move error `echo` lines to `>&2`.

### `preflight.sh` — Functional

The cleanest of the four. Error cases all use `>&2` with explicit "Next Step" instructions ("Commit or stash changes first", "Run git pull first"). The stdout output _is_ the answer — release metadata and commit list that the calling agent consumes directly. Passes the Silence Test on error (errors go to stderr). Passes on success conceptually (stdout carries useful data, not noise). No TTY awareness needed given the output is structured text for agent consumption. No actionable gaps identified.

### `create-release.sh` — Noisy

Errors correctly use `>&2` (usage, missing file, build failure) — better stream discipline than `install-build.sh`. However, all progress headers (`==> Tagging`, `==> Building`, `==> Creating DMG`, `Done.`) go to `stdout`, failing the Silence Test. The `hdiutil` and `yarn build` outputs are properly suppressed. No TTY awareness or `--json` support; not needed given the script's purpose but worth noting.

**Priority fixes:** Move all `echo "==>"` progress lines to `>&2`; keep the terminal `Done.` line on `>&2` as well so stdout carries only the `gh release create` URL output.

## Next Steps

1. ~~Audit and document the current "Vibe" of every script~~ — see Initial Audit above.
2. Patch `build.sh` and `install-build.sh` (most critical — both fail the Silence Test and have errors on stdout).
3. Patch `create-release.sh` (straightforward — just move `echo "==>"` lines to stderr).
4. Implement the `cli-guardian` and `cli-vibe-check` skills for ongoing enforcement.
