# Skill Authoring Guide

This project uses a multi-platform skill architecture to support Claude Code, Gemini CLI, and OpenAI Codex agents.

## Architecture

To avoid duplication and maintain consistency across different AI agents, we use a "Source of Truth" pattern:

1.  **Claude Code (`.claude/skills/`)**: The primary source of truth for all skills. This directory contains the full `SKILL.md` instructions, scripts, references, and assets.
2.  **Gemini CLI (`skills/gemini/`)**: A proxy directory containing thin `SKILL.md` files that point to the Claude skill as the source of truth.
3.  **OpenAI Codex (`skills/codex/`)**: A proxy directory similar to Gemini, pointing to the Claude skill.

## Creating a New Skill

1.  **Define the Skill in Claude**:
    *   Create a directory in `.claude/skills/<skill-name>/`.
    *   Create `SKILL.md` with full instructions and YAML frontmatter.
    *   Add any supporting scripts to `.claude/skills/<skill-name>/scripts/`.

2.  **Create Proxies**:
    *   For Gemini: Create `skills/gemini/<skill-name>/SKILL.md` with the same YAML frontmatter and a pointer to the Claude version.
    *   For Codex: Create `skills/codex/<skill-name>/SKILL.md` following the same proxy pattern.

## Conventions

*   **Imperative Tone**: Use clear, actionable instructions (e.g., "Run the build script" instead of "You can run the build script").
*   **Minimal Emojis**: Avoid excessive emojis in automated output to keep logs clean for LLM context.
*   **Sequestration**: Hide verbose build logs unless a failure occurs to prevent flooding the agent's context.

## References

*   [Claude Skills Documentation](https://code.claude.com/docs/en/skills)
*   [OpenAI Agent Skills Documentation](https://developers.openai.com/codex/skills/)
