# Game Logic Test Utilities

This directory contains test utilities for writing integration tests for the Binokel game logic.

## Overview

The `testHelpers.ts` module provides a fluent API for simulating complete game rounds with deterministic, predetermined hands. This enables testing of complex game flows without randomness.

## Quick Start

```typescript
import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';
import { GameTestHelper, card, createHand } from './testHelpers.js';

describe('My Game Test', () => {
  it('simulates a game scenario', () => {
    const game = GameTestHelper.create('test-session');

    // Players join
    game.alice.joins();
    game.bob.joins();

    // Start game
    game.startGame({ playerCount: 2, targetScore: 1000, dealer: 0 as PlayerIndex });

    // Deal predetermined hands
    game.dealCards({
      alice: createHand([
        ['herz', 'ass', 0],
        ['herz', '10', 0] /* ... */,
      ]),
      bob: createHand([
        ['kreuz', 'ass', 0],
        ['kreuz', '10', 0] /* ... */,
      ]),
      dabb: createHand([
        ['bollen', 'ober', 0],
        ['bollen', 'buabe', 0] /* ... */,
      ]),
    });

    // Bidding
    game.bob.bids(150);
    game.alice.bids(160);
    game.bob.passes();

    // Verify state
    expect(game.state.phase).toBe('dabb');
    expect(game.state.bidWinner).toBe(0);
  });
});
```

## API Reference

### Card Helpers

#### `card(suit, rank, copy)`

Creates a single card with specific properties.

```typescript
card('herz', 'ass', 0); // First Herz Ass
card('schippe', 'ober', 1); // Second Schippe Ober
```

**Parameters:**

- `suit`: `'kreuz' | 'schippe' | 'herz' | 'bollen'`
- `rank`: `'buabe' | 'ober' | 'koenig' | '10' | 'ass'`
- `copy`: `0 | 1` (each card exists twice in the deck)

**Returns:** `Card` object with generated ID in format `{suit}-{rank}-{copy}`

#### `createHand(specs)`

Creates multiple cards from an array of specifications.

```typescript
const hand = createHand([
  ['herz', 'ass', 0],
  ['herz', '10', 0],
  ['herz', 'koenig', 0],
  ['herz', 'ober', 0],
  ['herz', 'buabe', 0],
]);
```

**Parameters:**

- `specs`: Array of `[Suit, Rank, 0 | 1]` tuples

**Returns:** `Card[]`

### GameTestHelper Class

#### `GameTestHelper.create(sessionId)`

Factory method to create a new test helper instance.

```typescript
const game = GameTestHelper.create('my-test-session');
```

### Game Setup Methods

#### `game.startGame(config)`

Starts the game with specified configuration.

```typescript
game.startGame({
  playerCount: 2, // 2, 3, or 4 players
  targetScore: 1000, // Score needed to win
  dealer: 0 as PlayerIndex,
});
```

#### `game.dealCards(config)`

Deals predetermined cards for deterministic testing.

```typescript
game.dealCards({
  alice: aliceHand, // Card[] - 18 cards for 2-player game
  bob: bobHand, // Card[] - 18 cards for 2-player game
  dabb: dabbCards, // Card[] - 4 cards
});
```

### Player Actions

The helper provides named player interfaces for readable tests:

- `game.alice` - Player 0 actions
- `game.bob` - Player 1 actions

#### `player.joins()`

Adds the player to the game.

```typescript
game.alice.joins();
game.bob.joins();
```

#### `player.bids(amount)`

Places a bid.

```typescript
game.bob.bids(150);
game.alice.bids(160);
```

#### `player.passes()`

Passes on bidding. Automatically triggers `BIDDING_WON` event when only one player remains.

```typescript
game.bob.passes(); // If Alice hasn't passed, she wins the bid
```

#### `player.takesDabb()`

Takes the dabb cards (uses cards from `dealCards()` call).

```typescript
game.alice.takesDabb();
// Alice's hand now has 22 cards (18 + 4)
```

#### `player.discards(cards)`

Discards cards after taking the dabb.

```typescript
game.alice.discards([
  card('kreuz', 'koenig', 0),
  card('kreuz', 'ober', 0),
  card('bollen', 'koenig', 0),
  card('bollen', 'buabe', 0),
]);
```

#### `player.declaresTrump(suit)`

Declares the trump suit.

```typescript
game.alice.declaresTrump('herz');
```

#### `player.declaresMelds(melds)`

Declares melds for the player.

```typescript
const melds = game.detectMeldsFor(0 as PlayerIndex);
game.alice.declaresMelds(melds);
```

#### `player.plays(card)`

Plays a card in the trick phase. Automatically triggers `TRICK_WON` event when all players have played.

```typescript
game.alice.plays(card('herz', 'ass', 0));
game.bob.plays(card('herz', '10', 1));
// Trick is automatically resolved
```

### Phase Completion Methods

#### `game.completeMelding()`

Marks the melding phase as complete and transitions to tricks.

```typescript
game.alice.declaresMelds(aliceMelds);
game.bob.declaresMelds(bobMelds);
game.completeMelding();

expect(game.state.phase).toBe('tricks');
```

#### `game.scoreRound(config)`

Scores the completed round.

```typescript
game.scoreRound({
  scores: {
    0: { melds: 150, tricks: 120, total: 270, bidMet: true },
    1: { melds: 40, tricks: 80, total: 120, bidMet: true },
    2: { melds: 0, tricks: 0, total: 0, bidMet: true },
    3: { melds: 0, tricks: 0, total: 0, bidMet: true },
  },
  totalScores: { 0: 270, 1: 120, 2: 0, 3: 0 },
});
```

#### `game.startNewRound(config)`

Starts a new round with rotated dealer.

```typescript
game.startNewRound({ round: 2, dealer: 1 as PlayerIndex });
```

### State Access

#### `game.state`

Returns the current game state by applying all events.

```typescript
expect(game.state.phase).toBe('bidding');
expect(game.state.currentBid).toBe(160);
expect(game.state.bidWinner).toBe(0);
```

#### `game.allEvents`

Returns a copy of all events generated so far.

```typescript
const events = game.allEvents;
console.log(`Generated ${events.length} events`);
```

#### `game.detectMeldsFor(playerIndex)`

Auto-detects melds for a player based on their current hand and declared trump.

```typescript
game.alice.declaresTrump('herz');
const aliceMelds = game.detectMeldsFor(0 as PlayerIndex);
// Returns Meld[] with correct trump bonuses applied
```

## Game Flow

A complete two-player round follows this sequence:

```
1. Players join        → game.alice.joins(), game.bob.joins()
2. Game starts         → game.startGame(...)
3. Cards dealt         → game.dealCards(...)
4. Bidding             → player.bids(), player.passes()
5. Dabb                → player.takesDabb(), player.discards()
6. Trump declaration   → player.declaresTrump()
7. Meld declaration    → player.declaresMelds(), game.completeMelding()
8. Trick-taking        → player.plays() (18 tricks for 2 players)
9. Scoring             → game.scoreRound()
10. New round          → game.startNewRound() (if no winner)
```

## Tips for Writing Tests

### Deterministic Hands

Always use `createHand()` with specific cards to ensure reproducible tests:

```typescript
// Good: Specific cards for predictable melds
const aliceHand = createHand([
  ['herz', 'ass', 0],
  ['herz', '10', 0],
  ['herz', 'koenig', 0],
  ['herz', 'ober', 0],
  ['herz', 'buabe', 0], // Familie!
  // ... more cards
]);

// Bad: Random hands make tests flaky
const deck = shuffleDeck(createDeck());
```

### Card Count Requirements

For a 2-player game:

- Each player gets **18 cards**
- Dabb has **4 cards**
- Total: 40 cards (the complete deck)

### Verifying Phase Transitions

Check `game.state.phase` after key actions:

```typescript
game.bob.passes();
expect(game.state.phase).toBe('dabb');  // Bidding complete

game.alice.discards([...]);
expect(game.state.phase).toBe('trump'); // Ready for trump

game.alice.declaresTrump('herz');
expect(game.state.phase).toBe('melding');
```

### Testing Melds

Use `detectMeldsFor()` to automatically find melds:

```typescript
const melds = game.detectMeldsFor(0 as PlayerIndex);
const familie = melds.find((m) => m.type === 'familie');

expect(familie).toBeDefined();
expect(familie!.points).toBe(150); // 100 + 50 trump bonus
```

## Existing Tests

- `roundIntegration.test.ts` - Complete round simulation
- `twoPlayerGame.test.ts` - Two-player game setup tests
- `melds.test.ts` - Meld detection unit tests
- `tricks.test.ts` - Trick-taking logic tests
- `bidding.test.ts` - Bidding phase tests
