Address PR review comments for this pull request. Use {{args}} if a PR URL or identifier was provided. If no argument was provided, infer the PR from the current branch context, preferring the PR associated with the checked out branch. If the PR cannot be determined confidently, ask for the PR URL instead of guessing.

Collect all open PR review comments and unresolved conversations first. Investigate each comment carefully before making changes. Only apply changes for feedback that is valid or materially improves the code. If a comment is not valid or should not be adopted, do not change the code for it; reply with a concise explanation.

Make the minimal correct changes needed. Run relevant local tests, checks, or builds before pushing. Push the branch after fixes pass. After pushing, reply to each addressed review comment with a concise summary of what changed. Resolve each conversation only after the push succeeds.

If any comment is blocked or cannot be resolved confidently, stop and report the blocker instead of guessing.
