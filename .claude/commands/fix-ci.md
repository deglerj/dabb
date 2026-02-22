Fix the failing CI build on GitHub for the current branch.

## Step 1 — Find the failing run

Get the current branch and locate the latest failed CI run:

```bash
gh run list --branch "$(git branch --show-current)" --status failure --limit 5
```

If no failed run is found on the current branch, check for a PR and its checks:

```bash
gh pr checks 2>/dev/null
```

Pick the most recent relevant failing run.

## Step 2 — Inspect the failure

Get the failed job logs:

```bash
gh run view <run-id> --log-failed
```

If the logs are truncated or unclear, also view the job summary:

```bash
gh run view <run-id>
```

## Step 3 — Diagnose the failure type

Classify what kind of failure it is before touching any code:

- **Build / type error** — TypeScript compiler errors from `pnpm run build`
- **Lint error** — ESLint violations from `pnpm run lint`
- **Test failure** — Failing assertions from `pnpm test`
- **Other** — e.g. Docker build, dependency issue

Read the relevant source files to understand the root cause. Do not guess — trace the exact error message to the file and line.

## Step 4 — Fix the issue

Apply the minimal fix that resolves the failure. Follow the project conventions:

- No `any` types (TypeScript strict mode is enabled)
- Do not skip or disable lint rules unless absolutely necessary and justified
- For test failures, fix the code (not the test), unless the test expectation itself is wrong
- Workarounds and dependency downgrades require approval. Propose them, but don't apply them automatically.

## Step 5 — Verify locally

Run `/ci-check` to confirm all three checks pass (build, lint, test) before declaring the fix complete.
