Perform full project housekeeping: merge dependencies, review docs, check server health, fix lint, and improve test coverage.

## Step 1 — Merge Dependabot PRs

Invoke `/merge-dependabot` and wait for it to complete before proceeding. This ensures subsequent steps work with the most up-to-date codebase.

---

## Step 2 — Parallel checks

Run steps 2a, 2b, 2c, 2d, and 2e **in parallel** using background agents (`Task` tool with `run_in_background: true`) or simultaneous tool calls where possible. Collect all results before moving to Step 3.

### 2a — Review and update documentation

Do a full freshness audit of the project documentation — not just recent changes, but whether the docs reflect the current state of the codebase overall.

1. Read `README.md`, `CLAUDE.md`, `docs/API.md`, `docs/SOCKET_EVENTS.md`, `docs/DATABASE.md`, and all files under `docs/arc42/` and `docs/adr/`.
2. Cross-check each document against the actual codebase:
   - Do all mentioned file paths, commands, and config values still exist and work?
   - Are there features, patterns, or conventions documented that no longer exist?
   - Are there significant features, patterns, or key files that exist in the code but are missing from docs?
3. Update any section that is outdated, incomplete, or misleading. Remove content that is no longer relevant.
4. Do **not** rewrite docs that are accurate — only fix what is actually wrong or missing.
5. Summarize what was changed and why.

### 2b — Check for unmaintained dependencies

Identify direct dependencies that may be abandoned or no longer actively maintained.

1. Collect all direct dependencies from all `package.json` files in the repo (root + all apps and packages):

   ```bash
   find . -name "package.json" -not -path "*/node_modules/*" -not -path "*/.turbo/*" | \
     xargs grep -l '"dependencies"\|"devDependencies"'
   ```

2. For each unique direct dependency, check when it was last published:

   ```bash
   npm view <package-name> time.modified
   ```

3. Flag packages where the last publish was **more than 3 months ago** (before approximately `<today minus 90 days>`).

4. For each flagged package, assess whether it is abandoned:
   - Check the npm page and repository (README, issues, last commit date).
   - Look for signs of active maintenance: recent commits, responses to issues, published release notes.
   - A package can be "stable and done" (e.g., a utility with a narrow scope) — distinguish this from truly abandoned packages.

5. For packages that appear abandoned and are not "stable and done", propose a concrete solution:
   - A well-maintained replacement package
   - An actively maintained fork
   - Or, if the package is a transitive risk only, note it as low-priority

6. Present findings as a table: Package | Last Published | Assessment | Proposed Action.

### 2c — Server maintenance

SSH into the production server for a combined health, maintenance, and database check. Run all sub-checks in a single SSH session where possible.

Connect using:

```bash
ssh -i ~/.ssh/dabb-deploy dabb@dabb.degler.info
```

#### OS updates and reboot

```bash
# Check for available apt upgrades
apt list --upgradable 2>/dev/null

# Check if a reboot is required (file exists when kernel/libc was updated)
ls /var/run/reboot-required 2>/dev/null && echo "REBOOT REQUIRED" || echo "No reboot needed"

# Show what triggered the reboot requirement if applicable
cat /var/run/reboot-required.pkgs 2>/dev/null || true
```

- If upgrades are available: list them and recommend running `sudo apt upgrade` (do NOT run it yourself — this must be done by the user).
- If a reboot is required: report which packages triggered it and recommend scheduling a maintenance window.

#### Disk and Docker usage

```bash
# OS disk usage
df -h /

# Docker overall disk usage
docker system df
```

- If Docker reclaimable space exceeds 500 MB, run `docker system prune -f` to remove dangling images and stopped containers (this does **not** remove volumes or running containers and is safe to run automatically).
- If OS disk usage is above 80%: flag it for the user.

#### SSL certificate expiry

Check the Let's Encrypt certificate served by nginx:

```bash
echo | openssl s_client -connect dabb.degler.info:443 -servername dabb.degler.info 2>/dev/null \
  | openssl x509 -noout -dates
```

- If the certificate expires within **30 days**: warn the user and recommend checking the certbot container logs (`docker compose -f /opt/dabb/docker-compose.prod.yml logs certbot`).
- If it expires within **7 days**: treat as urgent.
- Otherwise: report the expiry date and mark as healthy.

#### Database health

Exec into the running Postgres container and run maintenance and health checks:

```bash
docker exec -i $(docker ps --filter name=postgres --format '{{.Names}}' | head -1) \
  psql -U postgres -d dabb -c "
    -- Run maintenance
    VACUUM ANALYZE;

    -- Table bloat summary (tables with more than 10 MB dead tuples)
    SELECT relname AS table,
           n_dead_tup AS dead_rows,
           pg_size_pretty(pg_total_relation_size(relid)) AS total_size
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 1000
    ORDER BY n_dead_tup DESC;

    -- Overall database size
    SELECT pg_size_pretty(pg_database_size('dabb')) AS db_size;

    -- Largest tables
    SELECT relname AS table,
           pg_size_pretty(pg_total_relation_size(relid)) AS size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 5;
  "
```

- Report the database size and top 5 largest tables.
- If any table has significant dead rows after `VACUUM ANALYZE`, flag it (this should be rare since autovacuum runs automatically).
- If the database size exceeds 1 GB: flag it for the user.

### 2d — Review TODO / FIXME / HACK comments

Find all technical debt markers in the codebase and decide what to do with each.

1. Collect all markers:

   ```bash
   grep -rn --include="*.ts" --include="*.tsx" -E "TODO|FIXME|HACK|XXX" \
     --exclude-dir=node_modules --exclude-dir=.turbo --exclude-dir=dist .
   ```

2. Group findings by type:
   - **FIXME / BUG**: Known defects — create a GitHub issue for each if one doesn't already exist, then replace the comment with a reference: `// TODO: see issue #NNN`
   - **TODO**: Planned work — evaluate whether it is still relevant. If yes, create a GitHub issue and add the issue reference. If the code has since addressed the concern, remove the comment.
   - **HACK / XXX**: Workarounds — check if the underlying cause has been resolved (e.g., a dependency bug that's now fixed). If still needed, keep with a brief explanation; if obsolete, remove.

3. Apply any comment cleanups directly in the source files and commit with a message like `Clean up TODO/FIXME comments`.

4. Do **not** spend time fixing the underlying issues now — the goal is to ensure every marker is either tracked in an issue or removed if no longer relevant.

### 2e — Fix linter findings

1. Run the linter:

   ```bash
   pnpm lint
   ```

2. If there are findings, run auto-fix first:

   ```bash
   pnpm lint:fix
   ```

3. Review any remaining findings that could not be auto-fixed and fix them manually.

4. After all fixes are applied, run `pnpm lint` once more to confirm zero findings.

5. If lint fixes changed any files, commit them:
   - Stage only the changed source files (not generated files)
   - Use a commit message like `Fix ESLint findings`

---

## Step 3 — Improve test coverage

After Step 2 is complete (especially after lint fixes from step 2e are committed):

1. Run the full test suite with coverage:

   ```bash
   pnpm test:coverage
   ```

2. Identify files with **line coverage below 70%** that contain non-trivial logic (skip generated files, `index.ts` barrel files, type-only files, and pure configuration).

3. Prioritize by importance:
   - `packages/game-logic/` — highest priority (core rules)
   - `packages/shared-types/` logic helpers — high priority
   - `apps/server/src/services/` — medium priority
   - UI hooks in `packages/ui-shared/` — medium priority
   - React components — lower priority

4. For each prioritized file, read it carefully and write tests that cover the untested logic. Follow the existing test patterns in `packages/game-logic/src/__tests__/` and use the `GameTestHelper` where applicable.

5. After writing tests, run `pnpm test` to confirm all new tests pass.

6. Commit new test files with a message like `Add missing tests for <module name>`.

---

## Step 4 — Final CI check

After all changes from steps 2d, 2e, and 3 are committed, run a final CI check to ensure everything is green:

```bash
pnpm run build && pnpm run lint && pnpm test
```

If anything fails, fix it before concluding.

---

## Step 5 — Summary report

Produce a final summary covering:

1. **Dependabot PRs**: How many merged, any skipped
2. **Documentation**: Which files were updated and what changed
3. **Stale dependencies**: Flagged packages and proposed actions (requires user follow-up)
4. **Server health**: OS update status, reboot requirement, SSL expiry, Docker prune result, DB size and top tables
5. **TODO/FIXME cleanup**: How many markers resolved, how many GitHub issues created
6. **Lint**: How many findings were fixed
7. **Test coverage**: Which files gained tests, overall coverage delta
8. **Remaining action items**: Anything that needs manual follow-up by the user (e.g. apt upgrade, reboot scheduling, dependency replacements, SSL renewal)
