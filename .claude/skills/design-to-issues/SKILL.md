---
name: design-to-issues
description: Creates a GitHub epic and child issues from a design document's implementation plan. Use when a design doc has a reviewed plan section ready to be converted into trackable work.
---

# Design Plan to GitHub Issues

Read a design document's implementation plan and produce a GitHub epic issue with linked child issues for each work item.

## Prerequisites

- The design document must have a reviewed, approved plan section (typically a numbered task list organized into phases)
- `gh` CLI authenticated
- User has reviewed and approved the plan in the design doc before invoking this skill

## Arguments

This skill accepts one argument: the path to the design document (e.g. `docs/designs/theming.md`).

## Steps

### 1. Read the design document

Read the design doc at the provided path. Identify:
- The project name / title
- The plan section (typically the last major section, with numbered items organized into phases)
- Any items marked as deferred

### 2. Draft the epic

Compose the epic issue body. Format:

```markdown
## Overview

<1-2 sentence summary of the project from the design doc's executive summary>

## Design document

<Relative path to the design doc in the repo, as a link>

## Plan

<Numbered checklist of all work items from the plan, including deferred items marked as such>

- [ ] #XX — <Item 1 title>
- [ ] #XX — <Item 2 title>
- [ ] [DEFERRED] <Item N title>

## Notes

- Deferred items are tracked here for completeness but do not have child issues yet.
- Check off items as their child issues are closed.
```

The `#XX` placeholders are filled in after child issues are created (step 4).

### 3. Create the epic issue

```
gh issue create --title "<Project name>: implementation epic" --body "<body>"
```

Save the epic issue number.

### 4. Create child issues

For each non-deferred plan item, delegate to a sub-agent using the `gh-create` skill. Use the Agent tool with `model: "haiku"` and `subagent_type: "general-purpose"`.

Provide each sub-agent with:
- The parent epic issue number
- The item title
- A body prompt including: objective (from the plan item description), context (from the design doc), deliverable, and acceptance criteria
- Any dependency references (e.g. "depends on the token audit issue")

Run independent issue creations in parallel where possible (items without dependencies between them).

### 5. Update the epic

After all child issues are created, edit the epic body to replace `#XX` placeholders with actual issue numbers:

```
gh issue edit <epic-number> --body "<updated body with real issue numbers>"
```

### 6. Report

Show the user:
- The epic issue URL
- A summary table of all created child issues (number, title, dependencies)
- Which items were deferred and not issued

## Notes

- This skill should run with Opus for the planning/orchestration. Child issue creation is delegated to Haiku via sub-agents.
- Research-oriented issues should note that their deliverable is "findings documented in issue comments + follow-up issues created or existing issues updated."
- Dependencies between issues should be mentioned in each issue's Context section, not enforced via GitHub's project tooling (keep it simple).
- Do not create issues for deferred items. They stay as unchecked lines in the epic until the user decides to promote them.
