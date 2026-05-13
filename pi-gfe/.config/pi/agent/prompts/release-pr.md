Release the draft PR to ready-for-review. If {{args}} is provided, treat it as a PR URL or number; otherwise infer the PR from the current branch.

Confirm the PR is in draft state before proceeding. Poll CI checks using `gh pr checks` every 30 seconds, reporting progress at each interval, until all required checks pass or a failure is detected. If any check fails, stop immediately and report which check failed and why — do not convert to ready on failure.

Once all checks are green, check for unresolved review threads — if any exist, report them and ask how to proceed rather than marking ready. If all checks pass and no unresolved threads exist, convert the draft to ready-for-review using `gh pr ready`.

If required checks are not configured on the repo, note this and ask the user to confirm before marking ready. Report the final PR URL and status when complete.
