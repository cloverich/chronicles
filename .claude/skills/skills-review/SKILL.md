---
name: skills-review
description: Reviews and validates the multi-platform skill structure (Claude, Gemini, Codex) in this repository. Use when adding or modifying skills to ensure they follow project conventions and are correctly proxied.
---

# Skills Review

This skill ensures that all skills in the repository follow the "Source of Truth" architecture and project conventions.

## Workflow

1.  **Enumerate Skills**: List all skills in `.claude/skills/`.
2.  **Validate Structure**: For each skill in `.claude/skills/`, check for:
    *   Existence of `SKILL.md`.
    *   Presence of YAML frontmatter (name, description).
    *   Absence of excessive emojis.
    *   Proper use of scripts for deterministic tasks.
3.  **Validate Proxies**:
    *   Check that a corresponding proxy exists in `skills/gemini/` and `skills/codex/`.
    *   Ensure proxies point to the `.claude/skills/` version as the source of truth.
    *   Verify YAML frontmatter matches between source and proxies.
4.  **Report Issues**: Provide a concise summary of any missing or misconfigured skills.

## Usage

*   "Review all skills in the project."
*   "Check if the local-install skill is correctly proxied."
*   "Run the skills-review skill for the new build-docs skill."

## Conventions
*   **Source of Truth**: All instructions should be in `.claude/skills/`.
*   **Minimal Emojis**: Logs and output should be clean and readable for LLMs.
*   **Proxy Consistency**: Frontmatter must be consistent across all proxy versions.
