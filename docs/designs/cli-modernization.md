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

## Next Steps

Following the approval of this design, a project plan will be created to:

1. Audit and document the current "Vibe" of every script in `package.json`.
2. Implement the `cli-guardian` and `cli-vibe-check` skills.
3. Patch the most critical "Noisy" tools identified in the audit.
