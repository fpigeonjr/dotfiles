---
name: release-pr
description: Watch CI on a draft PR, wait for all checks to pass, then mark it ready for review and confirm it is releasable
license: MIT
compatibility: opencode
metadata:
  workflow: github
  phase: pr-release
---

## What I do

- Identify the PR to release: use the provided PR URL or number if given, otherwise infer from the current branch
- Confirm the PR is still in draft state before proceeding
- Poll CI checks using `gh pr checks` until all required checks pass or a failure is detected
  - Poll every 30 seconds; report progress at each interval
  - Stop immediately and report if any check fails — do not convert to ready on failure
- Once all checks are green, convert the draft to ready-for-review using `gh pr ready`
- Report the final PR URL and status

## When to use me

Use this after a draft PR has been submitted and Copilot review feedback has been addressed. This is the final step before the PR can be merged.

## Rules

- Do not merge the PR — only mark it ready
- Do not push additional commits
- If CI fails, stop and clearly report which check failed and why, then wait for instructions
- If the PR is already marked ready, report that and skip the conversion step
- If required checks are not configured on the repo, note this and ask the user to confirm before marking ready
- Do not mark ready if there are unresolved review threads — report them and ask the user how to proceed
