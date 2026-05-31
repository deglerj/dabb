# ADR 006: Database Migration System

## Status

Accepted (updated: migrated from postgres-migrations to node-pg-migrate)

## Context

The project uses PostgreSQL for persisting game sessions, players, and events. Initially, schema management was handled by running `schema.sql` directly with `CREATE TABLE IF NOT EXISTS` clauses. This approach had limitations:

- **No ALTER TABLE support**: Adding constraints or modifying columns couldn't be applied to existing databases
- **No migration tracking**: No way to know which changes had been applied
- **Manual intervention required**: Schema changes needed manual application in production

A specific issue arose when adding the `terminated` status to the sessions table constraint—existing databases couldn't receive this update automatically.

## Decision

We use **node-pg-migrate** for database schema management:

1. **Numbered SQL files** in `apps/server/src/db/migrations/` (e.g., `1_initial_schema.sql`)
2. **Automatic tracking** via `pgmigrations` table
3. **Server startup migrations**: Migrations run automatically before the server accepts connections
4. **Idempotent migrations**: Use `IF NOT EXISTS` and conditional checks for safe re-runs

### Migration Structure

```
apps/server/src/db/migrations/
├── 1_initial_schema.sql         # Full schema (consolidated)
└── 2_description.sql            # Future migrations
```

### Why node-pg-migrate?

- **Actively maintained**: postgres-migrations is no longer maintained
- **Plain SQL files**: No TypeScript/JS migration code required
- **Reliable**: Runs in transactions, tracks state in `pgmigrations`
- **Down migrations**: Supports rollbacks via `-- Down Migration` section in SQL files
- **Compatible**: Works with node-postgres (pg) which we already use

## Consequences

### Positive

- **Automatic schema updates**: Production databases stay in sync
- **Safe rollouts**: New server versions apply migrations on startup
- **Audit trail**: `pgmigrations` table shows migration history
- **No downtime**: Migrations run before accepting connections
- **Rollback support**: Down migrations possible when needed

### Negative

- **Startup delay**: Brief delay while migrations check/run
- **New connection**: node-pg-migrate opens its own DB connection (separate from pool)

## Alternatives Considered

1. **postgres-migrations**: Previously used, no longer maintained
2. **Knex migrations**: Requires Knex ORM, adds significant complexity
3. **Prisma Migrate**: Requires Prisma ORM, complete paradigm shift
4. **Manual SQL scripts**: Doesn't scale

## Implementation Notes

### Running Migrations

```bash
# Automatic on server startup
pnpm --filter @dabb/server dev

# Manual run
pnpm --filter @dabb/server db:migrate
```

### Writing SQL Migrations

```sql
-- Up migration (whole file, or up to -- Down Migration marker)
ALTER TABLE my_table ADD COLUMN new_col VARCHAR(50);

-- Down Migration
ALTER TABLE my_table DROP COLUMN new_col;
```

For idempotent constraint changes:

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

### Docker

`docker-compose.yml` does not mount `schema.sql` to `/docker-entrypoint-initdb.d/`. The server handles all schema setup via migrations.
