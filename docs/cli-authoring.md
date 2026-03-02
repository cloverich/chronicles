# CLI Design: Humans vs. Machines vs. LLMs

## Understanding 2>&1 as Pretext

In Unix-like systems, every process starts with three default file descriptors: `0` (stdin), `1` (stdout), and `2` (stderr). The notation `2>&1` redirects stderr to the current destination of stdout.

- **Human Use:** Humans typically keep these separate to see errors clearly.
- **Machine/Script Use:** Scripts often redirect `2>&1` to a log file to capture the full execution history.
- **LLM Use:** LLMs frequently use `2>&1` to maximize context. Since tools often print critical debugging info or progress to stderr, merging the streams ensures the LLM "sees" the full linear buffer. Conversely, `> /dev/null 2>&1` is used to "silence" a tool completely by piping both streams into the bit bucket.

## The Separation of Concerns: Stdout vs. Stderr

The "garbage" issue in CLIs usually arises when developers treat stdout and stderr as interchangeable. The golden rule is: **Stdout for the Answer, Stderr for the Journey.**

- **Stdout (Standard Output):** Reserved for the primary result—stable, structured data (JSON/CSV) or the specific string requested. This is what gets piped to the next command.
- **Stderr (Standard Error):** Reserved for everything else—logs, progress bars, colors, warnings, and human-centric context.
- **Benefit:** When a human runs `grep`, they see the progress bar on their screen (via stderr), but only the relevant data passes through the pipe (via stdout).

## The CLIG vs. Reality: Environment Awareness

While the [Command Line Interface Guidelines (CLIG)](https://clig.dev/) promote "human-first" design, the practical standard for modern CLIs is **Environment Awareness** via `isatty(1)` detection.

- **Interactive (TTY):** If the tool detects a terminal, it provides a rich UI (colors, spinners, interactive prompts).
- **Non-Interactive (Piped/Scripted):** If the tool detects it is being piped or run in a CI environment, it should automatically strip colors and switch to a "quiet" or machine-readable format.
- **Legacy Failure:** Older CLIs (like early `npm`) dumped interactive UI elements into stdout, poisoning the data stream for scripts and requiring heavy regex cleanup.

## The "LLM=True" Shift

We are entering an era where the "machine" user is often an LLM. Unlike standard scripts, LLMs are sensitive to "token noise" and can be distracted or hallucinated by excessive verbosity.

- **Machine Mode:** Explicit flags like `--json` or `--quiet` are essential.
- **LLM Context:** An emerging best practice is supporting an `LLM=true` environment variable. This tells the CLI to provide "semantic signal"—high-level structured data and clear descriptions—while omitting low-level "garbage" like spinner characters or repetitive progress percentages.

---

## Case Studies: The Good and The Bad

### The Good: Respecting the Boundary

1.  **`gh` (GitHub CLI):** Excellent environment awareness. It renders tables for humans but switches to tab-delimited text for pipes. Its `--json` flag is the gold standard for structured output.
2.  **`rg` (ripgrep):** Follows the UNIX philosophy perfectly. Data goes to stdout; warnings and errors go to stderr. It is "silent" on success unless data is found.
3.  **`kubectl` (Kubernetes):** Its consistent use of `-o json` and `-o yaml` makes it the backbone of infrastructure automation, strictly separating cluster status (stderr) from resource data (stdout).

### The Bad: Creating Noise

1.  **`npm` (Node Package Manager):** Historically notorious for stdout pollution. It frequently leaks progress bars and "up to date" messages into stdout, making it difficult to pipe list or info commands without `-s`.
2.  **`docker`:** Interactive output can be overwhelming. Commands like `docker build` stream massive amounts of progress data that, when captured via `2>&1`, create bloated log files with redundant lines.
3.  **`terraform`:** Often mixes "Refreshing state..." status messages with actual plan data in the same buffer, making it difficult to extract specific resource IDs without parsing out ANSI noise.

---

## Practical Steps for Improvement

1.  **Audit Streams:** Run your CLI with `> /dev/null`. If you still see "Success!" or "Progress: 100%", you are leaking UI noise into stdout. Move it to `stderr`.
2.  **Automate TTY Detection:** Use `isatty` checks to disable colors and spinners automatically when the output is not a terminal.
3.  **Implement `--json` Early:** Provide a structured version of your data so machines (and LLMs) don't have to guess your text formatting.
4.  **Actionable Stderr:** Ensure error messages on `stderr` include a specific "Next Step" suggestion (e.g., "Run `auth login` to fix this").
