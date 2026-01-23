# @dabb/shared-types

Shared TypeScript type definitions for the Dabb Binokel card game.

## Installation

```bash
pnpm add @dabb/shared-types
```

## Contents

### Card Types (`cards.ts`)

- `Suit` - Card suits: Kreuz, Schippe, Herz, Bollen
- `Rank` - Card ranks: Ass, Zehn, König, Ober, Buabe, Neun
- `Card` - Card with id, suit, rank, and point value
- `CardId` - String identifier for cards
- `RANK_POINTS` - Points per rank
- `DABB_SIZE` - Dabb size by player count

### Game Types (`game.ts`)

- `GamePhase` - Game phases: waiting, dealing, bidding, dabb, trump, melding, tricks, scoring, finished
- `GameState` - Complete game state
- `PlayerIndex` - Player position (0-3)
- `PlayerCount` - Number of players (2, 3, or 4)
- `Trick` - Current trick in play
- `Meld` - Meld declaration

### Event Types (`events.ts`)

- `GameEvent` - Union type of all game events
- Event types: GAME_STARTED, CARDS_DEALT, BID_PLACED, PLAYER_PASSED, etc.

### Socket Types (`socket.ts`)

- `ClientToServerEvents` - Events sent from client to server
- `ServerToClientEvents` - Events sent from server to client
- `SocketData` - Per-socket metadata

### API Types (`api.ts`)

- `CreateSessionRequest/Response`
- `JoinSessionRequest/Response`
- `SessionInfoResponse`

## Usage

```typescript
import type { Card, GameState, GameEvent } from '@dabb/shared-types';
import { SUIT_NAMES, RANK_NAMES, DABB_SIZE } from '@dabb/shared-types';
```
