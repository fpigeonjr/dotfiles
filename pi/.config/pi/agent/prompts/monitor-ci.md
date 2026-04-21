Monitor CI for the OPRE-OPS project using the scripts in `.claude/actions/`. Work from the `~/Code/OPRE-OPS` directory. Argument handling:

- If {{args}} is a numeric run ID → run `.claude/actions/monitor-ci.sh {{args}}` to poll until completion (60s interval by default). Report progress at each interval. When complete, summarize the conclusion, total elapsed time, and E2E test results.
- If {{args}} is a branch name → run `.claude/actions/quick-ci-status.sh {{args}}` for an instant snapshot of the latest CI run on that branch.
- If {{args}} is empty → infer the current branch with `git branch --show-current`, then run `.claude/actions/quick-ci-status.sh <branch>` for a quick status check. If the run is in progress and the user wants to wait for completion, get the run ID with `gh run list --branch <branch> --limit 1 --json databaseId --jq '.[0].databaseId'` and switch to `monitor-ci.sh`.
- If {{args}} contains "e2e" (e.g. "e2e <run_id>") → run `.claude/actions/monitor-e2e.sh <run_id>` to monitor E2E tests specifically, exiting early on first failure.

After any script completes, parse and explain the output clearly:
- ✅ All checks passed → confirm and report total time.
- ❌ Failures → list the failed jobs/tests by name, link to the Actions run URL, and ask if you should investigate the failure logs.
- ⏳ Still in progress → report elapsed time and offer to keep watching.

If the scripts are not executable, run `chmod +x .claude/actions/*.sh` first.
