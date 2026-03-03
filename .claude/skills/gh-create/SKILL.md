---
name: gh-create
description: Creates a single GitHub issue with proper formatting, linked to a parent epic. Designed to be delegated to a sub-agent (Sonnet/Haiku).
---

# Create GitHub Issue

Create a single GitHub issue linked to a parent epic. This skill is designed for delegation to a smaller model via the Agent tool.

## Arguments

This skill is invoked by a parent agent with a prompt containing:

- **Parent issue number** (e.g. `#50`) — the epic this issue belongs to
- **Title** — concise issue title in imperative form
- **Body content** — the objective, context, and deliverable

## Steps

### 1. Create the issue

Run `gh issue create` with the title and body. The body must follow this format:

```
gh issue create --title "<title>" --body "$(cat <<'EOF'
**Epic:** #<parent-number>

## Objective

<1-2 sentences describing what this issue accomplishes>

## Context

<Relevant background — what exists today, why this is needed, pointers to design docs or code>

## Deliverable

<Concrete output: a file, a feature, a decision documented in an issue comment, etc.>

## Acceptance criteria

- [ ] <Criterion 1>
- [ ] <Criterion 2>
EOF
)"
```

### 2. Return the result

Output the new issue number and URL so the calling agent can track it. Do not comment on the parent epic — the orchestrating agent updates the epic body directly.

## Notes

- Do not add labels or milestones unless explicitly told to.
- If the prompt includes a "depends on" reference, mention it in the Context section (e.g. "Depends on #51 for the token inventory").
- Keep the body concise. The design doc has the details — the issue should link to it, not duplicate it.
