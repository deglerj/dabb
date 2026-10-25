# Event ordering and recovery

The Firebase event log is the protocol source of truth. `GameEvent.sequence` is a
positive, session-local, contiguous integer beginning at `1`. Events are applied
in ascending sequence order; Firebase callback order and push-key order are not
protocol ordering.

## Delivery contract

- `GameEvent.id` identifies one logical event. Re-delivering the same ID is a
  no-op. The first copy is retained; a later copy must not produce another
  reducer transition or cosmetic effect.
- A different event with the same sequence is a protocol conflict. Clients do
  not choose one by callback order or rewrite either sequence.
- A late event is buffered until all earlier sequences are available. It is not
  applied out of order.
- A missing sequence or a sequence conflict requires a full snapshot
  resynchronization from `sessions/<code>/events`. The snapshot is sorted by
  sequence and deduplicated by ID before replay.
- Reconnects use the same full-log procedure. Local array length and Firebase
  child-callback order are not evidence that the log is complete.
- A snapshot containing a gap or a conflict remains non-canonical until a
  subsequent snapshot resolves it; clients must not silently compact or repair
  the log.

`normalizeEventLog` and `analyzeEventLog` in `@dabb/game-logic` encode the
ordering, deduplication, and inspection rules. `EventStore` is the single
acceptance point for snapshots and live deliveries: it incrementally reduces a
contiguous event, buffers gaps, and reports when Firebase must resynchronize.
The UI derives its filtered projection from the store's complete raw log, while
actions and AI use its unfiltered state. None of these layers changes persisted
event payloads or game rules.

## Client recovery lifecycle

`useFirebaseGame` establishes the event stream in this order:

1. Read the complete event snapshot.
2. Replace the `EventStore` snapshot and mark those IDs as replayed.
3. Subscribe to child events only after the snapshot resolves.
4. Feed each live child through `EventStore.accept`.
5. Re-read the complete snapshot when a gap, conflict, or invalid event is reported.

The snapshot and subscription belong to the session identity. Changing the session or
unmounting cancels an in-flight read and removes the active listener exactly once. Player
metadata, presence, and emotes have independent subscriptions: metadata updates replace
nickname and AI-seat projections without restarting the event stream. This keeps
termination events live while still resolving their display name from the latest metadata.
