Create a draft PR for the current branch. If {{args}} is provided, treat it as a GitHub issue number and append "Closes #{{args}}" to the PR body — place it in the template's linked issues section if one exists, otherwise append it at the end.

Fetch the PR template using the GitHub API: `gh api repos/{owner}/{repo}/contents/.github/pull_request_template.md --jq .content | base64 -d` (the filename may be lowercase or uppercase — try both pull_request_template.md and PULL_REQUEST_TEMPLATE.md if the first fails). Populate the template fully — do not submit a blank or partially filled template. If no template exists after trying both casings, write a concise description covering what changed, why, and any relevant context.

Create the PR as a draft using `gh pr create --draft`. Detect and apply relevant labels from the repo's available labels based on the change type (e.g. bug, enhancement, documentation, chore) — skip labeling if labels cannot be determined with confidence. Assign the PR to the authenticated user via `gh api user --jq .login`.

If the PR already exists for this branch, report its URL and status instead of creating a duplicate. Report the PR URL and a summary of what was done when complete.

Finally, print this exact note: "ACTION REQUIRED: GitHub does not support requesting a Copilot review via the API. Please open the PR in your browser and add Copilot as a reviewer manually from the Reviewers panel."
