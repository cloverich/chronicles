---
name: gh-implement
description: Implements a GitHub issue using Sonnet in an isolated worktree, with Opus reviewing the result. Escalates to a WIP pull request when human judgment is needed.
---

# Implement Issue

Orchestrates implementation of a GitHub issue: Sonnet implements in a worktree, Opus reviews against acceptance criteria, and work escalates to a WIP PR if it goes off track.

## Arguments

This skill accepts one argument: a GitHub issue number or URL (e.g. `#444` or `https://github.com/cloverich/chronicles/issues/444`).

## Steps

### 1. Read the issue

Fetch the issue with `gh issue view <number>`. Extract:
- Title and objective
- Acceptance criteria
- Dependencies (check if blocking issues are closed; if not, warn the user and stop)
- Any linked epic or design doc

### 2. Dispatch Sonnet to implement

Launch a sub-agent with `model: "sonnet"`, `subagent_type: "general-purpose"`, and `isolation: "worktree"`.

The prompt to Sonnet must include:
- The full issue body (objective, context, deliverable, acceptance criteria)
- Pointers to relevant files or design docs mentioned in the issue
- These explicit instructions:

```
## Implementation rules

1. Read the relevant code and design docs before writing any code.
2. Make focused changes that address the issue's objective — nothing more.
3. SCOPE GUARD: If the issue turns out to require changes beyond what's described
   (touching unexpected files, architectural decisions not in the spec, significantly
   more work than expected), STOP and report back what you found rather than
   expanding scope.
4. Run `yarn test` and `yarn lint` before finishing. If tests fail, attempt to fix.
   If you cannot fix them, include the failure details in your summary.
5. Commit your changes with a clear commit message referencing the issue number.
6. In your final response, provide:
   - A summary of what you changed and why
   - List of files modified
   - Test/lint results
   - Any concerns or open questions
```

### 3. Review the result

When the sub-agent completes, it returns a summary and the worktree branch name.

Review the changes:
- Run `git diff main...<branch>` (or `git diff master...<branch>`) to see the full diff
- Read specific changed files if the diff is large
- Run `yarn test` from the worktree path if Sonnet reported issues

Evaluate against these criteria:

**PASS** — all acceptance criteria met, changes are focused, tests pass:
- Tell the user the implementation looks good
- Provide a summary of what was done
- Offer to merge the branch and close the issue

**MINOR FIXES** — mostly good but specific issues need addressing:
- List the specific problems (be concrete: file, line, what's wrong)
- Dispatch Sonnet again (resume the same agent) with targeted feedback
- After the second implementation round, review again
  - If PASS → proceed as above
  - If still not right → escalate (see below)

**OFF THE RAILS** — changes are fundamentally misaligned:
- Do NOT dispatch another round
- Escalate immediately (see step 4)

#### "Off the rails" heuristics

Flag if any of these are true:
- Changes touch files not mentioned or implied by the issue
- Diff exceeds ~300 lines for a task that should be small
- Architectural decisions were made that weren't in the spec
- Tests were deleted or skipped to make things pass
- The implementation approach contradicts the design doc

### 4. Escalate to human (WIP PR)

When escalating (off the rails, second review still failing, or scope guard triggered):

1. Push the worktree branch:
   ```
   git push -u origin <branch>
   ```

2. Open a draft PR:
   ```
   gh pr create --draft --title "WIP: <issue title>" --body "$(cat <<'EOF'
   ## Issue

   Closes #<issue-number>

   ## Status: Needs human review

   This implementation was started but needs human judgment before proceeding.

   ## What was done

   <Summary of changes made>

   ## Why it stopped

   <Specific reason: off the rails / second review failure / scope expansion>

   ## What needs deciding

   <Concrete questions or decisions the human needs to make>
   EOF
   )"
   ```

3. Tell the user: the draft PR is open, here's what needs their attention, and link the PR.

### 5. Completion

On successful review:
- Confirm with the user before merging
- Do NOT auto-close the issue — the user confirms closure

## Resuming work

If the user says "continue #444" and a WIP PR or branch already exists for that issue:
- Check for existing branches matching the issue number (`git branch -a | grep 444`)
- Check for existing PRs (`gh pr list --search "444"`)
- If found, resume from that branch rather than starting fresh
- Read the PR body to understand where things left off

## Notes

- This skill runs as Opus (the orchestrator). Only implementation is delegated to Sonnet.
- Never auto-merge to main/master without user confirmation.
- Never auto-close issues — the user checks them off on the epic.
- One issue at a time. Do not parallelize implementation of multiple issues.
- If the issue is a research task (deliverable is "findings + follow-up issues"), the sub-agent should document findings in its summary rather than writing code. Opus then helps create follow-up issues or update the epic.
