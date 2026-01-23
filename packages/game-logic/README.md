# @dabb/game-logic

Core game logic for the Dabb Binokel card game. Implements event sourcing, meld detection, trick-taking rules, and bidding.

## Installation

```bash
pnpm add @dabb/game-logic
```

## Key Concepts

### Event Sourcing

Game state is computed by replaying events through a reducer:

```typescript
import { applyEvents, createInitialState } from '@dabb/game-logic';

const events = await loadEvents(sessionId);
const state = applyEvents(events);
```

### Anti-Cheat Filtering

Events are filtered before sending to clients:

```typescript
import { filterEventsForPlayer } from '@dabb/game-logic';

const playerEvents = filterEventsForPlayer(events, playerIndex);
```

## API

### State Management

- `createInitialState(playerCount)` - Create new game state
- `applyEvent(state, event)` - Apply single event
- `applyEvents(events)` - Rebuild state from events
- `filterEventsForPlayer(events, playerIndex)` - Filter events for player view

### Card Operations

- `createDeck()` - Create 48-card Binokel deck
- `shuffleDeck(deck)` - Shuffle cards
- `dealCards(deck, playerCount)` - Deal cards and create dabb
- `sortHand(cards)` - Sort cards by suit and rank

### Game Rules

- `isValidBid(state, amount)` - Validate bid amount
- `isBiddingComplete(state)` - Check if bidding is done
- `getBiddingWinner(state)` - Get bidding winner
- `isValidPlay(card, hand, trick, trump)` - Validate card play
- `getValidPlays(hand, trick, trump)` - Get all valid plays
- `determineTrickWinner(trick, trump)` - Determine trick winner
- `calculateTrickPoints(cards)` - Calculate trick points

### Meld Detection

- `detectMelds(hand, trump)` - Find all melds in hand
- `calculateMeldPoints(melds)` - Sum meld points

### Event Factories

- `createGameStartedEvent(ctx, playerCount, targetScore, dealer)`
- `createCardsDealtEvent(ctx, hands, dabb)`
- `createBidPlacedEvent(ctx, playerIndex, amount)`
- `createPlayerPassedEvent(ctx, playerIndex)`
- `createBiddingWonEvent(ctx, winnerIndex, winningBid)`
- `createDabbTakenEvent(ctx, playerIndex, dabb)`
- `createCardsDiscardedEvent(ctx, playerIndex, cards)`
- `createTrumpDeclaredEvent(ctx, playerIndex, suit)`
- `createMeldsDeclaredEvent(ctx, playerIndex, melds, points)`
- `createCardPlayedEvent(ctx, playerIndex, card)`
- `createTrickWonEvent(ctx, winnerIndex, cards, points)`

## Testing

```bash
pnpm test
```

Tests cover bidding logic, deck operations, meld detection, and trick-taking rules.
