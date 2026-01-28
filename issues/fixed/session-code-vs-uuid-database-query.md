# Bug: Session Code Used Instead of UUID in Database Queries

## Summary

When querying the database for events and sessions, the code passes the human-readable session code (e.g., `zahm-mond-97`, `weich-tor-45`) instead of the session UUID. This causes PostgreSQL to reject the query with an "invalid input syntax for type uuid" error.

## Error Messages

```
ERROR:  invalid input syntax for type uuid: "zahm-mond-97"
CONTEXT:  unnamed portal parameter $1 = '...'
STATEMENT:  SELECT id, session_id, sequence, event_type, payload, created_at
            FROM events
            WHERE session_id = $1 AND sequence > $2
            ORDER BY sequence ASC
```

```
ERROR:  invalid input syntax for type uuid: "weich-tor-45"
CONTEXT:  unnamed portal parameter $1 = '...'
STATEMENT:  SELECT id, code, player_count, status, target_score, created_at
            FROM sessions WHERE id = $1
```

## Affected Tables/Queries

1. **Events table**: `SELECT ... FROM events WHERE session_id = $1`
2. **Sessions table**: `SELECT ... FROM sessions WHERE id = $1`

## Observations

- The session code is a human-readable identifier like `zahm-mond-97`
- The database expects a UUID for `session_id` and `id` columns
- The bug occurs when a player connects to a game session

## Hints for Investigation

- Check where the session ID is passed to database queries in the event service
- Look for places where `session.code` might be used instead of `session.id`
- The socket handlers receive the session code from the URL/client, but database queries need the actual UUID
- Check `apps/server/src/services/eventService.ts` for event queries
- Check `apps/server/src/services/sessionService.ts` for session queries

## Reproduction Steps

1. Start the development environment (`./dev.sh start`)
2. Open the web app at http://localhost:8080
3. Create a new game
4. Navigate to the game URL (e.g., `/game/zahm-mond-97`)
5. Observe the PostgreSQL error in the logs
