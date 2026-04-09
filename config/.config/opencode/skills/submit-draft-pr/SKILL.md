---
name: submit-draft-pr
description: Create a draft PR using the repo template, apply labels, assign the author, and request a Copilot review
license: MIT
compatibility: opencode
metadata:
  workflow: github
  phase: pr-submission
---

## Parameters

- `issue` (optional): GitHub issue number to link. If provided, appends `Closes #<number>` to the PR body so the issue is automatically closed on merge.

Example usage:
```
Use the submit-draft-pr skill, issue 4848
```

## What I do

- Determine the current branch and infer the base branch (default: `main`)
- Check for a PR template in `.github/PULL_REQUEST_TEMPLATE.md` or `.github/PULL_REQUEST_TEMPLATE/` and populate it — do not submit a blank template
- If an issue number was provided, append `Closes #<number>` to the PR body. If the template has a dedicated closing/linked issues section, place it there; otherwise append it at the end
- Create the PR as a **draft** using `gh pr create --draft`
- Detect and apply relevant labels from the repo's available labels based on the change type (e.g. `bug`, `enhancement`, `documentation`, `chore`)
- Assign the PR to the authenticated user (`gh api user --jq .login`)
- Request a review from `copilot` using `gh pr edit --add-reviewer copilot`
- Report the PR URL and a summary of what was done

## When to use me

Use this when you have finished your changes and are ready to open a draft PR for review. The branch must already be pushed to the remote. If it is not, push it first.

## Rules

- Always create as **draft** — never open a ready-for-review PR directly
- If no PR template exists, write a concise description covering: what changed, why, and any relevant context
- If an issue number is provided, always include `Closes #<number>` — never omit it or alter the number
- If no issue number is provided, do not guess or prompt for one — skip the linking step entirely
- If labels cannot be determined with confidence, skip labeling rather than guessing
- Do not merge or close the PR
- Do not push additional commits — only create the PR
- If the PR already exists for this branch, report its URL and status instead of creating a duplicate
