Review recent changes and update documentation to match. Optional context hint: $ARGUMENTS

## Step 1 — Analyze what changed

Run `git diff main...HEAD` to see all changes on this branch. If on the main branch with no divergence, run `git diff HEAD~1...HEAD` to see the last commit.

Read the diff carefully and categorize the changes:

- **REST API changes**: modified routes in `apps/server/src/routes/`, `apps/server/src/app.ts`, or REST-related types in `packages/shared-types/src/api.ts`
- **Socket.IO changes**: modified `apps/server/src/socket/handlers.ts` or `packages/shared-types/src/socket.ts`
- **Database changes**: new or modified files in `apps/server/src/db/migrations/`
- **User-facing feature changes**: new game phases, new major UI features, new language support, new commands
- **Architectural changes**: new packages, new major patterns, new external dependencies, infrastructure changes, significant new design decisions
- **CLAUDE.md-worthy changes**: new key files, new patterns or conventions that future AI assistants need to know

Also consider any context hint from `$ARGUMENTS` when categorizing.

## Step 2 — Skip if no docs needed

If the diff contains **only** these types of changes, output "No documentation updates needed." and stop:

- Bug fixes with no observable API/behavior change
- Internal refactoring (same API surface, different implementation)
- Test additions or updates
- Dependency version bumps (minor/patch)
- Build configuration changes
- Minor UI styling or copy changes

## Step 3 — Update API docs (if REST API changed)

If REST endpoints were added, changed, or removed, update `docs/API.md`:

- Read the current `docs/API.md` to understand its structure
- Add new endpoints with full documentation (method, path, parameters, request body, success response, error codes)
- Update changed endpoints in place
- Remove or mark deprecated any deleted endpoints

## Step 4 — Update Socket docs (if Socket events changed)

If Socket.IO events were added, changed, or removed, update `docs/SOCKET_EVENTS.md`:

- Read the current file to understand its structure
- Add new client→server events in the "Client → Server Events" section
- Add new server→client events in the "Server → Client Events" section
- Update payload tables for changed events
- Remove deleted events

## Step 5 — Update Database docs (if schema changed)

If new migration files were added, read both the migration SQL and the current `docs/DATABASE.md`, then update the schema section to reflect new or changed tables/columns/indexes.

## Step 6 — Update README (if user-facing features changed)

If a significant new user-facing feature was added (new game mode, AI player support, new language, new major UI feature), read `README.md` and update the relevant section:

- "Key Features" list for major new capabilities
- Game rules sections if rules changed
- Getting Started if setup changed

Do NOT update README for internal changes, even substantial ones.

## Step 7 — Consider creating an ADR

Create a new ADR if the changes involve a **significant architectural decision** that future developers would wonder about. Ask yourself: "Would someone looking at this code in 6 months wonder _why_ this approach was chosen?"

ADR-worthy decisions include:

- Adopting a new external technology or framework
- Switching a major dependency or hosting provider
- Introducing a new cross-cutting architectural pattern
- Making an important trade-off with real consequences
- A non-obvious design choice that constrains future development

Bug fixes, small features, and routine refactoring do NOT need ADRs.

If an ADR is warranted:

1. List existing ADRs by checking `docs/adr/` to find the next number
2. Create `docs/adr/NNN-short-kebab-title.md` using this template:

```markdown
# ADR NNN: Short Title

## Status

Accepted

## Date

YYYY-MM-DD

## Context

[Why was this decision needed? What problem or situation prompted it?]

## Decision

[What was decided? Be specific and concrete.]

## Consequences

### Positive

- ...

### Negative

- ...

## Related

- [links to related ADRs or docs, if applicable]
```

Use today's date. Write in plain technical language — no jargon, no marketing speak.

## Step 8 — Update CLAUDE.md if needed

If the changes introduce new key files that future AI assistants should know about, or establish new conventions that belong in the "Key Patterns" or "Conventions" sections, update `CLAUDE.md` accordingly.

Only update CLAUDE.md for stable, established patterns — not for in-progress work.

## Step 9 — Report what was done

Summarize which documents were updated and why, or explain why no updates were needed.
