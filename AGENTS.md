# Repository automation and deployment policy

These rules apply to ChatGPT, Codex, and other coding agents working in this repository.

## Production branch
- `main` is the production branch and is connected to Cloudflare Workers Builds.
- A push/update to `main` can cause a Cloudflare production build/deploy even when GitHub Actions do not run.
- Therefore normal implementation work MUST be done on a non-`main` task/feature branch based on the current `main`.

## GitHub Actions safety
- GitHub Actions workflows are intentionally manual-only (`workflow_dispatch`). Do not restore broad `push`, `pull_request`, `schedule`, `workflow_run`, or recursive dispatch triggers without explicit user approval.
- Do not run, re-run, or dispatch GitHub Actions unless the user explicitly asks to run CI/verification.
- Normal coding must not consume GitHub Actions minutes.

## Explicit production deployment protocol
- Only when the user explicitly says to deploy/publish/release the current approved work, update `main` to the approved target commit/branch using a normal fast-forward or reviewed merge. Never force-push `main`.
- That `main` update is the authorized Cloudflare production deployment trigger.
- If the approved code is already on `main` and the user explicitly requests a redeploy, update `.deploy/REQUEST` on `main` with a fresh request value; do not touch it during normal coding.
- Do not retry a failed deployment in a loop. Inspect the existing failure first and require explicit user approval before another deployment attempt.

## Agent behavior
- ChatGPT and Codex must follow the same deployment gate.
- A coding/edit request is NOT a deployment request. Words such as `deploy`, `publish`, `release`, or an equally explicit production instruction are required before updating production `main` for deployment.
