# ADR 006: Database Migration System

## Status

Accepted

## Context

The project uses PostgreSQL for persisting game sessions, players, and events. Initially, schema management was handled by running `schema.sql` directly with `CREATE TABLE IF NOT EXISTS` clauses. This approach had limitations:

- **No ALTER TABLE support**: Adding constraints or modifying columns couldn't be applied to existing databases
- **No migration tracking**: No way to know which changes had been applied
- **Manual intervention required**: Schema changes needed manual application in production

A specific issue arose when adding the `terminated` status to the sessions table constraint—existing databases couldn't receive this update automatically.

## Decision

We will use **postgres-migrations** for database schema management:

1. **Numbered SQL files** in `apps/server/src/db/migrations/` (e.g., `0001_initial_schema.sql`)
2. **Automatic tracking** via `pgmigrations` table
3. **Server startup migrations**: Migrations run automatically before the server accepts connections
4. **Idempotent migrations**: Use `IF NOT EXISTS` and conditional checks for safe re-runs

### Migration Structure

```
apps/server/src/db/migrations/
├── 0001_initial_schema.sql      # Base tables
├── 0002_add_terminated_status.sql  # Constraint fix
└── NNNN_description.sql         # Future migrations
```

### Why postgres-migrations?

- **Minimal**: ~50KB, no complex dependencies
- **Simple**: Plain SQL files, no TypeScript/JS migration code
- **Reliable**: Runs in transactions, tracks state in `pgmigrations`
- **Compatible**: Works with node-postgres (pg) which we already use

## Consequences

### Positive

- **Automatic schema updates**: Production databases stay in sync
- **Safe rollouts**: New server versions apply migrations on startup
- **Audit trail**: `pgmigrations` table shows migration history
- **Idempotent**: Safe to re-run migrations
- **No downtime**: Migrations run before accepting connections

### Negative

- **Additional dependency**: postgres-migrations package added
- **Startup delay**: Brief delay while migrations check/run
- **No rollback**: postgres-migrations doesn't support down migrations (manual intervention needed)

## Alternatives Considered

1. **node-pg-migrate**: More features (rollbacks, TypeScript migrations) but heavier
2. **Knex migrations**: Requires Knex ORM, adds significant complexity
3. **Prisma Migrate**: Requires Prisma ORM, complete paradigm shift
4. **Manual SQL scripts**: Current approach, doesn't scale

## Implementation Notes

### Running Migrations

```bash
# Automatic on server startup
pnpm --filter @dabb/server dev

# Manual run
pnpm --filter @dabb/server db:migrate
```

### Writing Idempotent Migrations

For constraints that may already exist:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'my_constraint'
    AND pg_get_constraintdef(oid) LIKE '%expected_value%'
  ) THEN
    ALTER TABLE my_table DROP CONSTRAINT my_constraint;
    ALTER TABLE my_table ADD CONSTRAINT my_constraint CHECK (...);
  END IF;
END $$;
```

### Docker Changes

The `docker-compose.yml` no longer mounts `schema.sql` to `/docker-entrypoint-initdb.d/`. The server handles all schema setup via migrations.
