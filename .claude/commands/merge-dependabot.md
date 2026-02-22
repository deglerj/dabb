Merge all open Dependabot PRs one at a time, waiting for CI after each merge and fixing any failures before proceeding.

## Step 1 — List open Dependabot PRs

```bash
gh pr list --author "app/dependabot" --state open --json number,title,headRefName --jq 'sort_by(.number) | .[] | "#\(.number) \(.title)"'
```

If there are no open Dependabot PRs, report that and stop.

## Step 2 — Process each PR sequentially

Work through the PRs in ascending order (lowest number first). For each PR, follow steps 2a–2e before moving on to the next.
For major updates, check the dependencies' change log and migration guide. Perform necessary migration steps and fix deprecations.

### 2a — Update the PR branch

Bring the PR branch up to date with main to catch any conflicts early:

```bash
gh pr update-branch <number>
```

If this fails because the branch is already up to date, that's fine — continue.

### 2b — Wait for PR CI checks

Wait for all CI checks on the PR to complete. Do this in a **single blocking shell command** to avoid repeated tool calls while waiting:

```bash
gh pr checks <number> --watch --interval 30 --fail-fast
```

- If all checks pass (or the only failures are "Security Audit"): proceed to merge.
- If any check other than "Security Audit" fails: note the failure, skip this PR, and continue to the next one. Do not attempt to fix failures on PR branches — that is outside the scope of this command.

### 2c — Merge the PR

```bash
gh pr merge <number> --squash --delete-branch
```

### 2d — Wait for main branch CI

After the merge, a new CI run is triggered on main. Identify and watch it in a **single blocking shell command** to avoid repeated tool calls while waiting:

```bash
sleep 20 && \
  RUN_ID=$(gh run list --branch main --limit 1 --json databaseId -q '.[0].databaseId') && \
  gh run watch "$RUN_ID" --exit-status --interval 30
```

- If CI **passes**: proceed to the next PR.
- If CI **fails**: go to step 2e.

### 2e — Fix main branch CI failure

If main CI failed after the merge, invoke `/fix-ci` to diagnose and fix the issue before proceeding to the next PR.

After the fix is applied and verified (via `/ci-check`), commit and push the fix, then return to step 2a for the next PR.

Leaving the main branch CI broken is never an option! If `/fix-ci` doesn't help, propose another solution to restore the build.

## Step 3 - Clean up

After processing all PRs:

- Check Dependabot config for any exclusions that are no longer required and clean them up
- Check Security Audit config for any exclusions that are no longer required and clean them up
- Check package.json and settings.gradle files for any overrides and other workarounds that are no longer required and clean them up

## Step 4 — Report results

After processing all PRs and cleaning up, summarize:

- Which PRs were merged successfully
- Which PRs were skipped due to failing PR CI (list their numbers and titles)
- Whether any post-merge CI fixes were required
