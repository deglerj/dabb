# Database Documentation

This document describes the database schema, migrations, and best practices for the Dabb project.

## Overview

Dabb uses PostgreSQL as its primary database. The schema supports the event-sourcing architecture used for game state management.

## Connection

Connection is managed through a connection pool configured in `apps/server/src/db/pool.ts`:

```typescript
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Connection timeout
});
```

### Environment Variables

| Variable       | Description                  | Example                                      |
| -------------- | ---------------------------- | -------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/dabb` |

## Schema

The database schema is defined in `apps/server/src/db/schema.sql`.

### Tables

#### `sessions`

Stores game session metadata.

| Column         | Type        | Description                                                   |
| -------------- | ----------- | ------------------------------------------------------------- |
| `id`           | UUID        | Primary key                                                   |
| `code`         | VARCHAR(50) | Unique join code (e.g., "ABCD")                               |
| `player_count` | SMALLINT    | Number of players (2, 3, or 4)                                |
| `status`       | VARCHAR(20) | Session status: `waiting`, `active`, `finished`, `terminated` |
| `target_score` | INTEGER     | Score needed to win (default: 1000)                           |
| `created_at`   | TIMESTAMPTZ | Creation timestamp                                            |
| `updated_at`   | TIMESTAMPTZ | Last update timestamp                                         |

#### `players`

Stores player information for each session.

| Column         | Type        | Description                                 |
| -------------- | ----------- | ------------------------------------------- |
| `id`           | UUID        | Primary key                                 |
| `session_id`   | UUID        | Foreign key to sessions                     |
| `secret_id`    | UUID        | Secret identifier for reconnection          |
| `nickname`     | VARCHAR(50) | Player's display name                       |
| `player_index` | SMALLINT    | Player's position (0-3)                     |
| `team`         | SMALLINT    | Team assignment (0 or 1, null for 3-player) |
| `connected`    | BOOLEAN     | Connection status                           |
| `created_at`   | TIMESTAMPTZ | Join timestamp                              |

#### `events`

Event store for game state (event sourcing pattern).

| Column       | Type        | Description                          |
| ------------ | ----------- | ------------------------------------ |
| `id`         | UUID        | Primary key                          |
| `session_id` | UUID        | Foreign key to sessions              |
| `sequence`   | BIGINT      | Event sequence number within session |
| `event_type` | VARCHAR(50) | Event type (e.g., "CARD_PLAYED")     |
| `payload`    | JSONB       | Event data                           |
| `created_at` | TIMESTAMPTZ | Event timestamp                      |

### Indexes

- `idx_sessions_code` - Fast lookup by join code
- `idx_sessions_status` - Filter by session status
- `idx_players_session_id` - Players by session
- `idx_players_secret_id` - Player reconnection lookup
- `idx_events_session_id` - Events by session
- `idx_events_session_sequence` - Event ordering

## Migrations

Dabb uses [postgres-migrations](https://github.com/thomwright/postgres-migrations) to manage database schema changes. Migrations run automatically on server startup.

### Running Migrations

```bash
# Migrations run automatically on server startup

# To run manually (from project root):
pnpm --filter @dabb/server db:migrate

# Or from apps/server directory:
pnpm db:migrate
```

### How Migrations Work

1. Numbered SQL files in `apps/server/src/db/migrations/` (e.g., `0001_initial_schema.sql`)
2. The `pgmigrations` table tracks which migrations have been applied
3. On startup, the server runs any pending migrations in order
4. Each migration runs in a transaction for safety

### Migration Files

Migration files follow the naming convention: `NNNN_description.sql`

| File                             | Purpose                                 |
| -------------------------------- | --------------------------------------- |
| `0001_initial_schema.sql`        | Base tables (sessions, players, events) |
| `0002_add_terminated_status.sql` | Add 'terminated' status to sessions     |

### Creating New Migrations

1. Create a new SQL file with the next sequence number:

   ```
   apps/server/src/db/migrations/0003_your_description.sql
   ```

2. Write your SQL migration. For idempotent migrations, use:
   - `CREATE TABLE IF NOT EXISTS` for new tables
   - `CREATE INDEX IF NOT EXISTS` for indexes
   - `DO $$ ... $$` blocks with conditionals for constraints

3. Test locally:
   ```bash
   ./dev.sh reset  # Reset database
   pnpm --filter @dabb/server dev  # Start server (runs migrations)
   ```

### Example: Adding a New Column

```sql
-- 0003_add_last_activity.sql
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();
```

### Example: Modifying a Constraint (Idempotent)

```sql
-- 0004_update_constraint.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'my_constraint'
    AND pg_get_constraintdef(oid) LIKE '%new_value%'
  ) THEN
    ALTER TABLE my_table DROP CONSTRAINT my_constraint;
    ALTER TABLE my_table ADD CONSTRAINT my_constraint CHECK (...);
  END IF;
END $$;
```

### Baseline for Existing Databases

If you have an existing database without the `pgmigrations` table:

- The first migration (`0001_initial_schema.sql`) uses `IF NOT EXISTS` clauses
- It will safely skip creating tables that already exist
- Subsequent migrations will apply their changes

## Local Development

### Using Docker (Recommended)

```bash
# Start PostgreSQL
pnpm docker:start

# Run migrations
pnpm --filter @dabb/server db:migrate
```

The Docker setup uses these default credentials:

- **Host**: localhost
- **Port**: 5432
- **Database**: dabb
- **User**: dabb
- **Password**: dabb_dev_password

### Manual PostgreSQL Setup

1. Install PostgreSQL
2. Create database and user:

```sql
CREATE USER dabb WITH PASSWORD 'your_password';
CREATE DATABASE dabb OWNER dabb;
```

3. Set `DATABASE_URL` in `.env.local`:

```env
DATABASE_URL=postgresql://dabb:your_password@localhost:5432/dabb
```

4. Run migrations

## Event Sourcing Pattern

Game state is managed through events stored in the `events` table:

1. **Write**: Store new events with incrementing sequence numbers
2. **Read**: Replay events through a reducer to compute current state
3. **Benefits**: Full audit trail, easy debugging, replay capability

### Event Types

Events follow the types defined in `@dabb/shared-types`:

- `GAME_STARTED` - Game initialization
- `CARDS_DEALT` - Initial card distribution
- `BID_PLACED` / `BID_PASSED` - Bidding phase
- `DABB_EXCHANGED` - Dabb exchange
- `TRUMP_DECLARED` - Trump suit selection
- `MELDS_ANNOUNCED` - Meld declarations
- `CARD_PLAYED` - Trick play
- `TRICK_COMPLETED` - Trick winner
- `ROUND_ENDED` - Round scoring
- `GAME_ENDED` - Final results

## Backup and Restore

### Backup

```bash
pg_dump -h localhost -U dabb -d dabb > backup.sql
```

### Restore

```bash
psql -h localhost -U dabb -d dabb < backup.sql
```

## Troubleshooting

### Connection Issues

1. Check PostgreSQL is running
2. Verify `DATABASE_URL` format
3. Check firewall/network settings
4. Verify user permissions

### Migration Failures

1. Check PostgreSQL logs
2. Verify schema.sql syntax
3. Look for constraint violations
4. Check for conflicting migrations

### Performance

1. Monitor with `EXPLAIN ANALYZE`
2. Check index usage
3. Consider vacuuming for deleted sessions
4. Archive old sessions if needed
