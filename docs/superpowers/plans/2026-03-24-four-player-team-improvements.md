# Four-Player Team Mode Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve 4-player team UX: team-aware AI bidding, team scoreboard, teammate badge, and team win/lose messages.

**Architecture:** Changes flow in three layers: (1) shared types + state — add `lastBidderIndex` to `GameState` and `TeamScoreEntry` to shared-types; (2) server/game-logic — AI bidding uses `lastBidderIndex` to detect teammate duels; (3) client UI — scoreboard, badge, messages all receive new optional props, wired up in `GameScreen`. All 4-player branches guard on `state.playerCount === 4` so 2/3-player behaviour is unchanged.

**Tech Stack:** TypeScript strict, React Native + Expo, Vitest, `@dabb/shared-types`, `@dabb/game-logic`, `@dabb/i18n`, `@dabb/ui-shared`

---

## File Map

| File                                                      | Change                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/shared-types/src/game.ts`                       | Add `lastBidderIndex` to `GameState`; add `TeamScoreEntry` interface       |
| `packages/game-logic/src/state/initial.ts`                | Set `lastBidderIndex: null` in `createInitialState` and `resetForNewRound` |
| `packages/game-logic/src/state/reducer.ts`                | Set `lastBidderIndex` in `handleBidPlaced`                                 |
| `apps/server/src/ai/BinokelAIPlayer.ts`                   | Team-aware bidding in `decideBidding`                                      |
| `apps/server/src/__tests__/aiPlayer.test.ts`              | Tests for teammate-aware bidding                                           |
| `packages/i18n/src/types.ts`                              | Add 4 new keys to `game` section of `TranslationKeys`                      |
| `packages/i18n/src/locales/de.ts`                         | German translations for the 4 new keys                                     |
| `packages/i18n/src/locales/en.ts`                         | English translations for the 4 new keys                                    |
| `apps/client/src/components/game/OpponentZone.tsx`        | Add `isTeammate?` prop                                                     |
| `apps/client/src/components/game/ScoreboardStrip.tsx`     | Add `teamScores?` prop; team rendering branch                              |
| `apps/client/src/components/game/ScoreboardModal.tsx`     | Add `teamScores?` + `teamsByPlayerIndex?` props; team column rendering     |
| `apps/client/src/components/game/GameTerminatedModal.tsx` | Replace `winnerNickname` with `winnerNicknames[]`; 4-player message keys   |
| `apps/client/src/components/game/CelebrationLayer.tsx`    | Add `isTeamGame?`; select correct message key                              |
| `packages/ui-shared/src/useGameLog.ts`                    | Fix `game_finished` log entry for 4-player (team winner names)             |
| `apps/client/src/components/ui/GameScreen.tsx`            | Wire all new props; fix winner detection for 4-player                      |

---

## Task 1: Add `lastBidderIndex` to `GameState` type

**Files:**

- Modify: `packages/shared-types/src/game.ts`

- [ ] **Step 1: Add `lastBidderIndex` to the `GameState` interface**

  In `packages/shared-types/src/game.ts`, add the new field to the `GameState` interface after `passedPlayers`:

  ```typescript
  // Bidding state
  currentBid: number;
  bidWinner: PlayerIndex | null;
  currentBidder: PlayerIndex | null;
  firstBidder: PlayerIndex | null;
  passedPlayers: Set<PlayerIndex>;
  lastBidderIndex: PlayerIndex | null; // Player who last placed a bid (null at round start)
  ```

- [ ] **Step 2: Add `TeamScoreEntry` interface**

  In `packages/shared-types/src/game.ts`, add after the `RoundHistoryEntry` interface at the bottom:

  ```typescript
  /** Used by ScoreboardStrip and ScoreboardModal in 4-player team games */
  export interface TeamScoreEntry {
    team: Team;
    names: string; // e.g. "Anna & Bob" — pre-formatted by caller
    score: number;
    isMyTeam: boolean;
  }
  ```

- [ ] **Step 3: Build to verify no type errors**

  ```bash
  pnpm --filter @dabb/shared-types run build
  ```

  Expected: build succeeds (TypeScript will complain about `lastBidderIndex` missing from `createInitialState` — fix in Task 2).

---

## Task 2: Set `lastBidderIndex` in initial state and reducer

**Files:**

- Modify: `packages/game-logic/src/state/initial.ts`
- Modify: `packages/game-logic/src/state/reducer.ts`

- [ ] **Step 1: Add `lastBidderIndex: null` to `createInitialState`**

  In `packages/game-logic/src/state/initial.ts`, add to the returned object under the bidding state section:

  ```typescript
  // Bidding state
  currentBid: 0,
  bidWinner: null,
  currentBidder: null,
  firstBidder: null,
  passedPlayers: new Set(),
  lastBidderIndex: null,
  ```

- [ ] **Step 2: Add `lastBidderIndex: null` to `resetForNewRound`**

  In `packages/game-logic/src/state/initial.ts`, add to the returned object in `resetForNewRound` under the reset bidding state section:

  ```typescript
  // Reset bidding state
  currentBid: 0,
  bidWinner: null,
  currentBidder: null,
  firstBidder: null,
  passedPlayers: new Set(),
  lastBidderIndex: null,
  ```

- [ ] **Step 3: Set `lastBidderIndex` in `handleBidPlaced`**

  In `packages/game-logic/src/state/reducer.ts`, update `handleBidPlaced` to track the bidder:

  ```typescript
  function handleBidPlaced(
    state: GameState,
    event: Extract<GameEvent, { type: 'BID_PLACED' }>
  ): GameState {
    if (state.firstBidder === null) {
      throw new Error('firstBidder is null during bidding');
    }
    const nextBidder = getNextBidder(
      event.payload.playerIndex,
      state.playerCount,
      state.passedPlayers,
      state.firstBidder
    );

    return {
      ...state,
      currentBid: event.payload.amount,
      currentBidder: nextBidder,
      lastBidderIndex: event.payload.playerIndex,
    };
  }
  ```

- [ ] **Step 4: Build game-logic to verify**

  ```bash
  pnpm --filter @dabb/game-logic run build
  ```

  Expected: build succeeds.

- [ ] **Step 5: Run game-logic tests**

  ```bash
  pnpm --filter @dabb/game-logic test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add packages/shared-types/src/game.ts packages/game-logic/src/state/initial.ts packages/game-logic/src/state/reducer.ts
  git commit -m "feat: add lastBidderIndex and TeamScoreEntry to game state"
  ```

---

## Task 3: AI team-aware bidding

**Files:**

- Modify: `apps/server/src/ai/BinokelAIPlayer.ts`
- Modify: `apps/server/src/__tests__/aiPlayer.test.ts`

- [ ] **Step 1: Write failing tests**

  In `apps/server/src/__tests__/aiPlayer.test.ts`, add a new `describe` block. The test sets up a 4-player game state where the AI's teammate holds the current bid. It verifies the AI passes in the uncertain zone and still bids when very confident.

  First, read the existing test file to understand the state-building pattern, then add:

  ```typescript
  describe('BinokelAIPlayer - 4-player team-aware bidding', () => {
    // Helper: build a minimal GameState for bidding tests
    function makeBiddingState(overrides: Partial<GameState> = {}): GameState {
      const base: GameState = {
        phase: 'bidding',
        playerCount: 4,
        players: [
          { id: 'p0', nickname: 'Alice', playerIndex: 0, team: 0, connected: true },
          { id: 'p1', nickname: 'Bob', playerIndex: 1, team: 1, connected: true },
          { id: 'p2', nickname: 'Carol', playerIndex: 2, team: 0, connected: true },
          { id: 'p3', nickname: 'Dave', playerIndex: 3, team: 1, connected: true },
        ],
        hands: new Map([
          [0, []],
          [1, []],
          [2, []],
          [3, []],
        ]),
        dabb: [],
        currentBid: 160,
        bidWinner: null,
        currentBidder: 2,
        firstBidder: 1,
        passedPlayers: new Set(),
        lastBidderIndex: 0, // Alice (team 0) set the current bid
        trump: null,
        currentTrick: { cards: [], leadSuit: null, winnerIndex: null },
        tricksTaken: new Map(),
        currentPlayer: null,
        roundScores: new Map(),
        totalScores: new Map(),
        targetScore: 1000,
        declaredMelds: new Map(),
        dealer: 3,
        round: 1,
        wentOut: false,
        dabbCardIds: [],
        lastCompletedTrick: null,
      };
      return { ...base, ...overrides };
    }

    it('passes when bidding against teammate and diff < 60', async () => {
      const ai = new BinokelAIPlayer(0); // hard — no blunders
      // Give Carol (player 2, team 0) a weak hand: estimatedTotal ≈ 180, bid = 170 → diff ≈ 10
      // A few low non-trump cards, no melds
      const weakHand = [
        { id: 'kreuz-buabe-1', suit: 'kreuz' as Suit, rank: 'buabe' as Rank },
        { id: 'kreuz-ober-1', suit: 'kreuz' as Suit, rank: 'ober' as Rank },
        { id: 'schippe-buabe-1', suit: 'schippe' as Suit, rank: 'buabe' as Rank },
        { id: 'schippe-ober-1', suit: 'schippe' as Suit, rank: 'ober' as Rank },
        { id: 'herz-buabe-1', suit: 'herz' as Suit, rank: 'buabe' as Rank },
        { id: 'herz-ober-1', suit: 'herz' as Suit, rank: 'ober' as Rank },
        { id: 'bollen-buabe-1', suit: 'bollen' as Suit, rank: 'buabe' as Rank },
        { id: 'bollen-ober-1', suit: 'bollen' as Suit, rank: 'ober' as Rank },
        { id: 'bollen-koenig-1', suit: 'bollen' as Suit, rank: 'koenig' as Rank },
      ];
      const state = makeBiddingState({
        currentBid: 160,
        lastBidderIndex: 0, // Alice = team 0 = Carol's teammate
        hands: new Map([
          [2, weakHand],
          [0, []],
          [1, []],
          [3, []],
        ]),
      });
      // Run 20 times — hard AI should always pass against teammate when uncertain
      for (let i = 0; i < 20; i++) {
        const action = await ai.decide({ gameState: state, playerIndex: 2 });
        expect(action.type).toBe('pass');
      }
    });

    it('bids when diff >= 60 even against teammate', async () => {
      const ai = new BinokelAIPlayer(0);
      // Give Carol a strong hand with a Familie (100 pts) + many trump
      // estimatedTotal will be well above 160 + 60 = 220
      const strongHand = [
        { id: 'herz-ass-1', suit: 'herz' as Suit, rank: 'ass' as Rank },
        { id: 'herz-10-1', suit: 'herz' as Suit, rank: '10' as Rank },
        { id: 'herz-koenig-1', suit: 'herz' as Suit, rank: 'koenig' as Rank },
        { id: 'herz-ober-1', suit: 'herz' as Suit, rank: 'ober' as Rank },
        { id: 'herz-buabe-1', suit: 'herz' as Suit, rank: 'buabe' as Rank },
        { id: 'herz-ass-2', suit: 'herz' as Suit, rank: 'ass' as Rank },
        { id: 'herz-10-2', suit: 'herz' as Suit, rank: '10' as Rank },
        { id: 'herz-koenig-2', suit: 'herz' as Suit, rank: 'koenig' as Rank },
        { id: 'herz-ober-2', suit: 'herz' as Suit, rank: 'ober' as Rank },
      ];
      const state = makeBiddingState({
        currentBid: 150,
        lastBidderIndex: 0, // teammate
        hands: new Map([
          [2, strongHand],
          [0, []],
          [1, []],
          [3, []],
        ]),
      });
      const action = await ai.decide({ gameState: state, playerIndex: 2 });
      expect(action.type).toBe('bid');
    });

    it('uses normal probabilistic logic when bidding against opponent', async () => {
      const ai = new BinokelAIPlayer(0);
      // Carol (team 0) bidding against Bob (team 1, lastBidderIndex = 1) with uncertain hand
      const uncertainHand = [
        { id: 'kreuz-buabe-1', suit: 'kreuz' as Suit, rank: 'buabe' as Rank },
        { id: 'kreuz-ober-1', suit: 'kreuz' as Suit, rank: 'ober' as Rank },
        { id: 'schippe-buabe-1', suit: 'schippe' as Suit, rank: 'buabe' as Rank },
        { id: 'schippe-ober-1', suit: 'schippe' as Suit, rank: 'ober' as Rank },
        { id: 'herz-buabe-1', suit: 'herz' as Suit, rank: 'buabe' as Rank },
        { id: 'herz-ober-1', suit: 'herz' as Suit, rank: 'ober' as Rank },
        { id: 'bollen-buabe-1', suit: 'bollen' as Suit, rank: 'buabe' as Rank },
        { id: 'bollen-ober-1', suit: 'bollen' as Suit, rank: 'ober' as Rank },
        { id: 'bollen-koenig-1', suit: 'bollen' as Suit, rank: 'koenig' as Rank },
      ];
      const state = makeBiddingState({
        currentBid: 160,
        lastBidderIndex: 1, // Bob = team 1 = opponent
        hands: new Map([
          [2, uncertainHand],
          [0, []],
          [1, []],
          [3, []],
        ]),
      });
      // With probabilistic logic and an uncertain hand vs opponent, we may bid or pass.
      // Just verify the action is a valid type (not throwing).
      const action = await ai.decide({ gameState: state, playerIndex: 2 });
      expect(['bid', 'pass']).toContain(action.type);
    });
  });
  ```

- [ ] **Step 2: Run tests — expect failures**

  ```bash
  pnpm --filter @dabb/server test -- --reporter=verbose 2>&1 | grep -A3 "team-aware"
  ```

  Expected: tests fail (teammate-pass logic not yet implemented).

- [ ] **Step 3: Implement team-aware bidding in `decideBidding`**

  In `apps/server/src/ai/BinokelAIPlayer.ts`, update `decideBidding`. Add the teammate check **after** computing `diff` but **before** the comfortable/hopeless/uncertain checks:

  ```typescript
  private decideBidding(context: AIDecisionContext): AIAction {
    const { gameState, playerIndex } = context;
    const hand = gameState.hands.get(playerIndex) ?? [];

    try {
      const minBid = getMinBid(gameState.currentBid);
      const canPassNow = canPass(gameState.currentBid);

      // First bid — must bid minimum, no blunder possible
      if (!canPassNow) {
        return { type: 'bid', amount: minBid };
      }

      // Evaluate best suit and estimate total score
      const { meldPoints, bestSuit } = evaluateBestSuit(hand, gameState.playerCount);
      const estimatedTotal =
        meldPoints + estimateTrickPoints(hand, bestSuit, gameState.playerCount);
      const diff = estimatedTotal - minBid;

      // In 4-player: if the current bid leader is our teammate, only bid when very confident.
      // This prevents AIs from running up the bid against their own partner.
      const partnerIndex = getPartner(playerIndex, gameState);
      const biddingAgainstPartner =
        partnerIndex !== null && gameState.lastBidderIndex === partnerIndex;

      if (biddingAgainstPartner) {
        // No blunder: never accidentally overbid a partner
        return diff >= 60 ? { type: 'bid', amount: minBid } : { type: 'pass' };
      }

      let optimal: AIAction;

      // Comfortable margin: always bid
      if (diff >= 60) {
        optimal = { type: 'bid', amount: minBid };
      } else if (diff <= -50) {
        // Clearly hopeless: always pass
        optimal = { type: 'pass' };
      } else {
        // Linear pass probability in [-50, 60] range
        // At diff=60: passProb=0%, at diff=-50: passProb=85%
        const passProb = Math.min(0.85, (60 - diff) / 110);
        optimal = Math.random() < passProb ? { type: 'pass' } : { type: 'bid', amount: minBid };
      }

      const alternative: AIAction =
        optimal.type === 'bid' ? { type: 'pass' } : { type: 'bid', amount: minBid };
      return this.maybeBlunder(optimal, [alternative]);
    } catch {
      if (canPass(gameState.currentBid)) {
        return { type: 'pass' };
      }
      return { type: 'bid', amount: getMinBid(gameState.currentBid) };
    }
  }
  ```

- [ ] **Step 4: Run tests — expect pass**

  ```bash
  pnpm --filter @dabb/server test -- --reporter=verbose 2>&1 | grep -A3 "team-aware"
  ```

  Expected: all 3 new tests pass.

- [ ] **Step 5: Run all server tests**

  ```bash
  pnpm --filter @dabb/server test
  ```

  Expected: all tests pass.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/server/src/ai/BinokelAIPlayer.ts apps/server/src/__tests__/aiPlayer.test.ts
  git commit -m "feat: add team-aware bidding to AI — pass when teammate holds bid unless very confident"
  ```

---

## Task 4: Add i18n keys

**Files:**

- Modify: `packages/i18n/src/types.ts`
- Modify: `packages/i18n/src/locales/de.ts`
- Modify: `packages/i18n/src/locales/en.ts`

- [ ] **Step 1: Add new keys to `TranslationKeys` in `packages/i18n/src/types.ts`**

  Find the `game` section and add after `playerEndedGame: string;`:

  ```typescript
  youAndTeammateWonGame: string; // 4-player: "Du und {{name}} habt gewonnen! 🎉"
  playersWonGame: string; // 4-player: "{{name1}} und {{name2}} haben gewonnen."
  teamWonRound: string; // 4-player celebration: "Dein Team hat die Runde gewonnen! 🎉"
  teamWonGame: string; // 4-player celebration: "Dein Team hat gewonnen! 🎉"
  ```

- [ ] **Step 2: Add German translations in `packages/i18n/src/locales/de.ts`**

  Find the `game` section and add after `playerEndedGame`:

  ```typescript
  youAndTeammateWonGame: 'Du und {{name}} habt gewonnen! 🎉',
  playersWonGame: '{{name1}} und {{name2}} haben gewonnen.',
  teamWonRound: 'Dein Team hat die Runde gewonnen! 🎉',
  teamWonGame: 'Dein Team hat gewonnen! 🎉',
  ```

- [ ] **Step 3: Add English translations in `packages/i18n/src/locales/en.ts`**

  Find the `game` section and add after `playerEndedGame`:

  ```typescript
  youAndTeammateWonGame: 'You and {{name}} won the game! 🎉',
  playersWonGame: '{{name1}} and {{name2}} won the game.',
  teamWonRound: 'Your team won the round! 🎉',
  teamWonGame: 'Your team won the game! 🎉',
  ```

- [ ] **Step 4: Build i18n to verify**

  ```bash
  pnpm --filter @dabb/i18n run build
  ```

  Expected: build succeeds (TypeScript validates that `de` and `en` satisfy `TranslationKeys`).

- [ ] **Step 5: Commit**

  ```bash
  git add packages/i18n/src/types.ts packages/i18n/src/locales/de.ts packages/i18n/src/locales/en.ts
  git commit -m "feat: add i18n keys for 4-player team win/lose messages"
  ```

---

## Task 5: Teammate badge in `OpponentZone`

**Files:**

- Modify: `apps/client/src/components/game/OpponentZone.tsx`

- [ ] **Step 1: Add `isTeammate?` prop and update render**

  Replace the entire file content with the updated version:

  ```typescript
  /**
   * OpponentZone — renders a single opponent's area on the table.
   * Landscape/tablet: nameplate + fanned card backs.
   * Portrait phone: nameplate only.
   */
  import React from 'react';
  import { View, Text, StyleSheet } from 'react-native';
  import { CardBackView } from '@dabb/game-canvas';
  import { useGameDimensions } from '../../hooks/useGameDimensions.js';
  import type { PlayerIndex } from '@dabb/shared-types';

  export interface OpponentZoneProps {
    playerIndex: PlayerIndex;
    nickname: string;
    cardCount: number;
    isConnected: boolean;
    isTeammate?: boolean;
    position: { x: number; y: number };
  }

  const CARD_W = 40;
  const CARD_H = 60;

  export function OpponentZone({ nickname, cardCount, isConnected, isTeammate, position }: OpponentZoneProps) {
    const { width, height } = useGameDimensions();
    const isLandscape = width > height;
    const isTablet = Math.min(width, height) > 600;
    const showCards = isLandscape || isTablet;

    return (
      <View style={[styles.container, { left: position.x - 40, top: position.y - 20 }]}>
        <View style={[styles.nameplate, isTeammate && styles.nameplateTeammate]}>
          <Text style={styles.name} numberOfLines={1}>
            {nickname}
          </Text>
          {isTeammate && <Text style={styles.teammateBadge}>🤝</Text>}
          {!isConnected && <Text style={styles.offlineBadge}>(offline)</Text>}
        </View>
        {showCards && cardCount > 0 && (
          <View style={styles.cardFan}>
            {Array.from({ length: Math.min(cardCount, 6) }).map((_, i) => (
              <View key={i} style={{ marginLeft: i === 0 ? 0 : -28 }}>
                <CardBackView width={CARD_W} height={CARD_H} />
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { position: 'absolute', alignItems: 'center', gap: 4 },
    nameplate: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#f2e8d0',
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: '#c8b090',
      shadowColor: '#000',
      shadowOffset: { width: 1, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    nameplateTeammate: {
      borderColor: '#4a90d9',
    },
    name: { fontSize: 14, color: '#3d2e18', maxWidth: 80 },
    teammateBadge: { fontSize: 12 },
    offlineBadge: { fontSize: 11, color: '#999' },
    cardFan: { flexDirection: 'row' },
  });
  ```

- [ ] **Step 2: Build client to verify**

  ```bash
  pnpm --filter @dabb/client run build 2>&1 | tail -20
  ```

  Expected: build succeeds (prop is optional, no callers broken yet).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/client/src/components/game/OpponentZone.tsx
  git commit -m "feat: add isTeammate prop to OpponentZone — blue border and handshake icon"
  ```

---

## Task 6: Team scoreboard strip

**Files:**

- Modify: `apps/client/src/components/game/ScoreboardStrip.tsx`

- [ ] **Step 1: Update `ScoreboardStrip` with team rendering branch**

  Replace the entire file content:

  ```typescript
  /**
   * ScoreboardStrip — a compact horizontal score display shown at the top of the game screen.
   * Shows total score per player (2/3-player) or per team (4-player), highlighting the local side.
   * Shows highest bid/bidder and current trump on the right.
   * Tappable to open the scoreboard history modal.
   */
  import React from 'react';
  import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
  import type { PlayerIndex, Suit, TeamScoreEntry } from '@dabb/shared-types';
  import { formatSuit } from '@dabb/game-logic';
  import { useTranslation } from '@dabb/i18n';

  export interface ScoreboardStripProps {
    totalScores: Array<{ playerIndex: PlayerIndex; score: number }>;
    myPlayerIndex: PlayerIndex;
    bidWinner: PlayerIndex | null;
    currentBid: number;
    trump: Suit | null;
    nicknames: Map<PlayerIndex, string>;
    teamScores?: TeamScoreEntry[];
    onPress?: () => void;
  }

  export function ScoreboardStrip({
    totalScores,
    myPlayerIndex,
    bidWinner,
    currentBid,
    trump,
    nicknames,
    teamScores,
    onPress,
  }: ScoreboardStripProps) {
    const { t } = useTranslation();

    const bidderName = bidWinner !== null ? (nicknames.get(bidWinner) ?? `P${bidWinner}`) : null;
    const bidText = bidderName !== null ? `${bidderName} · ${currentBid}` : '—';
    const trumpText = trump !== null ? formatSuit(trump) : '—';

    return (
      <TouchableOpacity style={styles.strip} onPress={onPress} activeOpacity={0.7}>
        {teamScores ? (
          // 4-player team mode: two colour-coded team boxes
          teamScores.map((entry) => (
            <View
              key={entry.team}
              style={[styles.teamEntry, entry.isMyTeam ? styles.teamEntryMine : styles.teamEntryOpponent]}
            >
              <Text
                style={[styles.teamName, entry.isMyTeam ? styles.teamNameMine : styles.teamNameOpponent]}
                numberOfLines={1}
              >
                {entry.names}
              </Text>
              <Text style={[styles.totalScore, styles.totalScoreHighlight]}>{entry.score}</Text>
            </View>
          ))
        ) : (
          // 2/3-player: one box per player
          totalScores.map((entry) => {
            const isMe = entry.playerIndex === myPlayerIndex;
            return (
              <View
                key={entry.playerIndex}
                style={[styles.playerEntry, isMe && styles.playerEntryHighlight]}
              >
                <Text style={[styles.totalScore, isMe && styles.totalScoreHighlight]}>
                  {entry.score}
                </Text>
              </View>
            );
          })
        )}
        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('game.bidColumn')}:</Text>
            <Text style={[styles.infoValue, bidWinner === null && styles.infoValueEmpty]}>
              {bidText}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('game.trump')}:</Text>
            <Text style={[styles.infoValue, trump === null && styles.infoValueEmpty]}>
              {trumpText}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const styles = StyleSheet.create({
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#2a1a0a',
      paddingLeft: 8,
      paddingRight: 60,
      paddingVertical: 4,
      gap: 6,
      minHeight: 36,
    },
    playerEntry: {
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      minWidth: 44,
    },
    playerEntryHighlight: {
      backgroundColor: '#c97f00',
    },
    teamEntry: {
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      minWidth: 60,
    },
    teamEntryMine: {
      backgroundColor: '#1e3a5f',
    },
    teamEntryOpponent: {
      backgroundColor: '#3a1e1e',
    },
    teamName: {
      fontSize: 9,
      maxWidth: 80,
    },
    teamNameMine: {
      color: '#7ab3e0',
    },
    teamNameOpponent: {
      color: '#e07a7a',
    },
    totalScore: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#f2e8d0',
    },
    totalScoreHighlight: {
      color: '#fff',
    },
    infoBlock: {
      marginLeft: 'auto',
      alignItems: 'flex-end',
      gap: 2,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    infoLabel: {
      fontSize: 10,
      color: '#c8b090',
    },
    infoValue: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#f2e8d0',
    },
    infoValueEmpty: {
      color: '#7a6a50',
      fontWeight: 'normal',
    },
  });
  ```

- [ ] **Step 2: Build to verify**

  ```bash
  pnpm --filter @dabb/client run build 2>&1 | tail -20
  ```

  Expected: succeeds.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/client/src/components/game/ScoreboardStrip.tsx
  git commit -m "feat: show 2 team score boxes in ScoreboardStrip for 4-player games"
  ```

---

## Task 7: Team scoreboard modal

**Files:**

- Modify: `apps/client/src/components/game/ScoreboardModal.tsx`

- [ ] **Step 1: Update `ScoreboardModal` with team columns**

  Replace the props interface and the component, keeping all styles unchanged. The key changes are:
  - Add `teamScores?: TeamScoreEntry[]` and `teamsByPlayerIndex?: Map<PlayerIndex, Team>` props
  - When `teamScores` is present, render 2 team columns instead of N player columns

  Replace the file content:

  ```typescript
  /**
   * ScoreboardModal — full round history shown when user taps the scoreboard strip.
   */
  import React from 'react';
  import { Modal, View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
  import type { PlayerIndex, RoundHistoryEntry, Team, TeamScoreEntry } from '@dabb/shared-types';
  import type { RoundHistoryResult } from '@dabb/ui-shared';
  import { useTranslation } from '@dabb/i18n';

  export interface ScoreboardModalProps {
    visible: boolean;
    onClose: () => void;
    rounds: RoundHistoryEntry[];
    currentRound: RoundHistoryResult['currentRound'];
    nicknames: Map<PlayerIndex, string>;
    playerCount: number;
    totalScores: Array<{ playerIndex: PlayerIndex; score: number }>;
    teamScores?: TeamScoreEntry[];
    teamsByPlayerIndex?: Map<PlayerIndex, Team>;
  }

  export function ScoreboardModal({
    visible,
    onClose,
    rounds,
    currentRound,
    nicknames,
    playerCount,
    totalScores,
    teamScores,
    teamsByPlayerIndex,
  }: ScoreboardModalProps) {
    const { t } = useTranslation();
    const playerIndices = Array.from({ length: playerCount }, (_, i) => i as PlayerIndex);

    function name(pi: PlayerIndex) {
      return nicknames.get(pi) ?? `P${pi}`;
    }

    function BidBadge({ round }: { round: RoundHistoryEntry }) {
      if (round.scores === null) {
        return null;
      }
      if (round.wentOut) {
        return (
          <View style={[styles.badge, styles.wentOutBadge]}>
            <Text style={[styles.badgeText, { color: '#c97f00' }]}>🚪 {t('game.wentOut')}</Text>
          </View>
        );
      }
      // Determine if bid was met — works for both player-keyed and team-keyed scores
      const bidWinnerKey: PlayerIndex | Team | null =
        round.bidWinner !== null && teamsByPlayerIndex
          ? (teamsByPlayerIndex.get(round.bidWinner) ?? round.bidWinner)
          : round.bidWinner;
      if (bidWinnerKey !== null && round.scores[bidWinnerKey as PlayerIndex]?.bidMet) {
        return (
          <View style={[styles.badge, styles.bidMetBadge]}>
            <Text style={[styles.badgeText, { color: '#6bcb77' }]}>✓ {t('game.bidMet')}</Text>
          </View>
        );
      }
      return (
        <View style={[styles.badge, styles.bidMissedBadge]}>
          <Text style={[styles.badgeText, { color: '#e05555' }]}>✗ {t('game.bidMissed')}</Text>
        </View>
      );
    }

    // Determine the team of the bid winner (for column highlight)
    function bidWinnerTeam(round: RoundHistoryEntry): Team | null {
      if (round.bidWinner === null || !teamsByPlayerIndex) return null;
      return teamsByPlayerIndex.get(round.bidWinner) ?? null;
    }

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>{t('game.scoreHistory')}</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            {/* Column headers */}
            <View style={styles.row}>
              <Text style={[styles.cell, styles.roundCell, styles.headerText]}>
                {t('game.roundAbbr')}
              </Text>
              <Text style={[styles.cell, styles.bidCell, styles.headerText]}>
                {t('game.bidColumn')}
              </Text>
              {teamScores ? (
                teamScores.map((te) => (
                  <Text key={te.team} style={[styles.cell, styles.playerCell, styles.headerText]}>
                    {te.names}
                  </Text>
                ))
              ) : (
                playerIndices.map((pi) => (
                  <Text key={pi} style={[styles.cell, styles.playerCell, styles.headerText]}>
                    {name(pi)}
                  </Text>
                ))
              )}
            </View>

            <ScrollView>
              {/* Completed rounds */}
              {rounds.map((round) => (
                <View key={round.round} style={styles.row}>
                  <Text style={[styles.cell, styles.roundCell]}>{round.round}</Text>
                  <View
                    style={[
                      styles.cell,
                      styles.bidCell,
                      { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
                    ]}
                  >
                    <Text style={{ color: '#c8b090', fontSize: 11 }}>
                      {round.bidWinner !== null
                        ? `${name(round.bidWinner)} · ${round.winningBid}`
                        : '—'}
                    </Text>
                    {round.bidWinner !== null && <BidBadge round={round} />}
                  </View>
                  {teamScores ? (
                    teamScores.map((te) => {
                      const score = round.scores?.[te.team as unknown as PlayerIndex];
                      const isWinnerTeam = bidWinnerTeam(round) === te.team;
                      return (
                        <View key={te.team} style={[styles.cell, styles.playerCell]}>
                          {score !== undefined ? (
                            <>
                              <Text style={styles.scoreDetail}>
                                {round.wentOut
                                  ? `🃏 ${score.melds}`
                                  : `🃏 ${score.melds} + 🏆 ${score.tricks}`}
                              </Text>
                              <Text
                                style={[
                                  styles.scoreTotal,
                                  isWinnerTeam && score.bidMet ? styles.bidMet : undefined,
                                  score.total < 0 ? styles.scoreTotalNegative : undefined,
                                ]}
                              >
                                {score.total}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.scoreTotal}>—</Text>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    playerIndices.map((pi) => {
                      const score = round.scores?.[pi];
                      return (
                        <View key={pi} style={[styles.cell, styles.playerCell]}>
                          {score !== undefined ? (
                            <>
                              <Text style={styles.scoreDetail}>
                                {round.wentOut
                                  ? `🃏 ${score.melds}`
                                  : `🃏 ${score.melds} + 🏆 ${score.tricks}`}
                              </Text>
                              <Text
                                style={[
                                  styles.scoreTotal,
                                  pi === round.bidWinner && score.bidMet ? styles.bidMet : undefined,
                                  score.total < 0 ? styles.scoreTotalNegative : undefined,
                                ]}
                              >
                                {score.total}
                              </Text>
                            </>
                          ) : (
                            <Text style={styles.scoreTotal}>—</Text>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              ))}

              {/* Current in-progress round */}
              {currentRound && (
                <View style={[styles.row, styles.currentRow]}>
                  <Text style={[styles.cell, styles.roundCell]}>{currentRound.round}</Text>
                  <View
                    style={[
                      styles.cell,
                      styles.bidCell,
                      { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
                    ]}
                  >
                    <Text style={{ color: '#c8b090', fontSize: 11 }}>
                      {currentRound.bidWinner !== null
                        ? `${name(currentRound.bidWinner)} · ${currentRound.winningBid}`
                        : '—'}
                    </Text>
                    {currentRound.wentOut && (
                      <View style={[styles.badge, styles.wentOutBadge]}>
                        <Text style={[styles.badgeText, { color: '#c97f00' }]}>
                          🚪 {t('game.wentOut')}
                        </Text>
                      </View>
                    )}
                  </View>
                  {(teamScores ?? playerIndices.map((pi) => ({ team: pi }))).map((entry) => {
                    const key = 'team' in entry && teamScores ? (entry as TeamScoreEntry).team : (entry as unknown as PlayerIndex);
                    return (
                      <Text key={String(key)} style={[styles.cell, styles.playerCell, styles.scoreTotal]}>
                        —
                      </Text>
                    );
                  })}
                </View>
              )}

              {/* Totals row */}
              <View style={[styles.row, styles.totalsRow]}>
                <Text style={[styles.cell, styles.roundCell, styles.totalsLabel]}>{'='}</Text>
                <Text style={[styles.cell, styles.bidCell]} />
                {teamScores ? (
                  teamScores.map((te) => (
                    <Text key={te.team} style={[styles.cell, styles.playerCell, styles.totalsValue]}>
                      {te.score}
                    </Text>
                  ))
                ) : (
                  playerIndices.map((pi) => {
                    const entry = totalScores.find((s) => s.playerIndex === pi);
                    return (
                      <Text key={pi} style={[styles.cell, styles.playerCell, styles.totalsValue]}>
                        {entry?.score ?? 0}
                      </Text>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    card: {
      backgroundColor: '#2a1a0a',
      borderRadius: 12,
      padding: 16,
      width: '100%',
      maxWidth: 625,
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: '#5a3a1a',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: 'bold',
      color: '#f2e8d0',
    },
    closeButton: {
      padding: 4,
    },
    closeText: {
      fontSize: 18,
      color: '#c8b090',
    },
    row: {
      flexDirection: 'row',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: '#3a2a1a',
      alignItems: 'center',
    },
    currentRow: {
      backgroundColor: 'rgba(201,127,0,0.1)',
    },
    totalsRow: {
      borderTopWidth: 2,
      borderTopColor: '#5a3a1a',
      marginTop: 4,
      paddingTop: 8,
    },
    cell: {
      paddingHorizontal: 4,
    },
    roundCell: {
      width: 28,
      color: '#c8b090',
      fontSize: 12,
      textAlign: 'center',
    },
    bidCell: {
      flex: 1,
      color: '#c8b090',
      fontSize: 11,
    },
    playerCell: {
      width: 94,
      alignItems: 'center',
    },
    headerText: {
      color: '#f2e8d0',
      fontWeight: 'bold',
      fontSize: 12,
    },
    scoreDetail: {
      fontSize: 10,
      color: '#c8b090',
      textAlign: 'center',
    },
    scoreTotal: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#f2e8d0',
      textAlign: 'center',
    },
    bidMet: {
      color: '#6bcb77',
    },
    scoreTotalNegative: {
      color: '#e05555',
    },
    totalsLabel: {
      color: '#f2e8d0',
      fontWeight: 'bold',
    },
    totalsValue: {
      fontSize: 15,
      fontWeight: 'bold',
      color: '#c97f00',
      textAlign: 'center',
    },
    badge: {
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 2,
      alignSelf: 'flex-start',
    },
    badgeText: {
      fontSize: 10,
      fontWeight: 'bold',
    },
    bidMetBadge: {
      backgroundColor: '#1a3d22',
    },
    bidMissedBadge: {
      backgroundColor: '#3d1a1a',
    },
    wentOutBadge: {
      backgroundColor: '#3d2a00',
    },
  });
  ```

- [ ] **Step 2: Build to verify**

  ```bash
  pnpm --filter @dabb/client run build 2>&1 | tail -20
  ```

  Expected: succeeds.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/client/src/components/game/ScoreboardModal.tsx
  git commit -m "feat: show 2 team columns in ScoreboardModal for 4-player games"
  ```

---

## Task 8: Team win/lose messages in `GameTerminatedModal`

**Files:**

- Modify: `apps/client/src/components/game/GameTerminatedModal.tsx`

- [ ] **Step 1: Replace `winnerNickname` with `winnerNicknames[]` and add team logic**

  Replace the entire file content:

  ```typescript
  /**
   * GameTerminatedModal — shown when the game ends (someone reached the target score
   * or the session was terminated). Uses a centered card over a transparent backdrop.
   */
  import React from 'react';
  import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
  import { Colors, Fonts, Shadows } from '../../theme.js';
  import { useTranslation } from '@dabb/i18n';

  export interface GameTerminatedModalProps {
    visible: boolean;
    winnerId: string | null;
    winnerNicknames: string[];
    isLocalWinner: boolean;
    terminatedByNickname?: string | null;
    onDone: () => void;
  }

  export function GameTerminatedModal({
    visible,
    winnerId,
    winnerNicknames,
    isLocalWinner,
    terminatedByNickname,
    onDone,
  }: GameTerminatedModalProps) {
    const { t } = useTranslation();

    let title: string;
    if (terminatedByNickname) {
      title = t('game.playerEndedGame', { name: terminatedByNickname });
    } else if (!winnerId) {
      title = t('game.gameEnded');
    } else if (isLocalWinner) {
      if (winnerNicknames.length === 2) {
        // 4-player: "Du und Anna habt gewonnen! 🎉"
        const teammateName = winnerNicknames.find((n) => n !== winnerNicknames[0]) ?? winnerNicknames[1];
        title = t('game.youAndTeammateWonGame', { name: teammateName });
      } else {
        title = t('game.youWonGame');
      }
    } else {
      if (winnerNicknames.length === 2) {
        // 4-player: "Bob und Chris haben gewonnen."
        title = t('game.playersWonGame', { name1: winnerNicknames[0], name2: winnerNicknames[1] });
      } else {
        title = t('game.playerWonGame', { name: winnerNicknames[0] ?? t('common.player') });
      }
    }

    return (
      <Modal transparent animationType="fade" visible={visible}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Pressable style={styles.button} onPress={onDone}>
              <Text style={styles.buttonLabel}>{t('common.done')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  const styles = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      backgroundColor: Colors.paperFace,
      borderRadius: 12,
      paddingVertical: 32,
      paddingHorizontal: 28,
      alignItems: 'center',
      minWidth: 260,
      ...Shadows.panel,
    },
    title: {
      fontFamily: Fonts.display,
      color: Colors.inkDark,
      fontSize: 22,
      textAlign: 'center',
      marginBottom: 24,
    },
    button: {
      backgroundColor: Colors.amber,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 32,
    },
    buttonLabel: {
      fontFamily: Fonts.bodyBold,
      color: '#ffffff',
      fontSize: 16,
    },
  });
  ```

- [ ] **Step 2: Build — expect a compile error in GameScreen (caller still passes old prop)**

  ```bash
  pnpm --filter @dabb/client run build 2>&1 | grep -i "winnerNickname"
  ```

  Expected: TypeScript error about `winnerNickname` — will be fixed in Task 10 (GameScreen wiring).

- [ ] **Step 3: Stage the component change — do NOT commit yet**

  The caller (`GameScreen`) still passes the old `winnerNickname` prop and will fail to build until Task 11 fixes it. Stage this file now; it will be committed together with the caller fix in Task 11 Step 9.

  ```bash
  git add apps/client/src/components/game/GameTerminatedModal.tsx
  ```

---

## Task 9: Team messages in `CelebrationLayer`

**Files:**

- Modify: `apps/client/src/components/game/CelebrationLayer.tsx`

- [ ] **Step 1: Add `isTeamGame?` prop and correct message selection**

  Update the props interface and `startAnimation` callback. Replace the relevant parts:

  Change the `CelebrationLayerProps` interface:

  ```typescript
  export interface CelebrationLayerProps {
    showConfetti: boolean;
    showFireworks: boolean;
    isTeamGame?: boolean;
  }
  ```

  Change the component signature:

  ```typescript
  export function CelebrationLayer({ showConfetti, showFireworks, isTeamGame }: CelebrationLayerProps) {
  ```

  Change the `startAnimation` callback (update `setMessage` line and dependency array):

  ```typescript
  const startAnimation = useCallback(
    (isConfetti: boolean) => {
      stopAnimation();
      particles.current = isConfetti
        ? createConfetti(width, height)
        : createFireworks(width, height);
      const gravity = isConfetti ? 0.12 : 0.05;

      let msg: string;
      if (isConfetti) {
        msg = isTeamGame ? t('game.teamWonRound') : t('game.youWonRound');
      } else {
        msg = isTeamGame ? t('game.teamWonGame') : t('game.youWonGame');
      }
      setMessage(msg);

      const animate = () => {
        stepParticles(particles.current, gravity);
        setTick((t) => t + 1);
        rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);

      timerRef.current = setTimeout(stopAnimation, PARTICLE_LIFETIME_MS);
    },
    [width, height, stopAnimation, t, isTeamGame]
  );
  ```

- [ ] **Step 2: Build to verify**

  ```bash
  pnpm --filter @dabb/client run build 2>&1 | tail -20
  ```

  Expected: succeeds (prop is optional, caller not yet updated — that's fine).

- [ ] **Step 3: Commit**

  ```bash
  git add apps/client/src/components/game/CelebrationLayer.tsx
  git commit -m "feat: CelebrationLayer shows team win messages in 4-player games"
  ```

---

## Task 10: Fix game log `gameFinished` entry for 4-player

**Files:**

- Modify: `packages/shared-types/src/gameLog.ts`
- Modify: `packages/ui-shared/src/useGameLog.ts`
- Modify: `apps/client/src/components/ui/GameScreen.tsx`

**Context:** The current `game_finished` log entry stores `winner: PlayerIndex | Team`. The formatter in `GameScreen.tsx` does `nicknames.get(d.winner as PlayerIndex)` which returns `undefined` for 4-player (where `winner` is a `Team` integer 0 or 1, not a player index). The fix: embed the winner names at log-creation time in `useGameLog.ts`, where player data is available.

- [ ] **Step 1: Add `winnerNames` to `GameFinishedLogData`**

  In `packages/shared-types/src/gameLog.ts`, update the `GameFinishedLogData` interface:

  ```typescript
  export interface GameFinishedLogData {
    kind: 'game_finished';
    winner: PlayerIndex | Team;
    winnerNames: string[]; // Resolved display names — 1 name for 2/3-player, 2 for 4-player team
  }
  ```

- [ ] **Step 2: Populate `winnerNames` in `useGameLog.ts`**

  In `packages/ui-shared/src/useGameLog.ts`, update the `GAME_FINISHED` case to resolve names from `playerTeamData`:

  ```typescript
  case 'GAME_FINISHED': {
    const winnerValue = event.payload.winner;
    let winnerNames: string[];

    // Check if winner is a Team (0 or 1) or a PlayerIndex
    const teamEntries = Array.from(playerTeamData.values());
    const isTeamWinner = teamEntries.length > 0 && teamEntries.some((e) => e.team === winnerValue);

    if (isTeamWinner) {
      // 4-player: collect names of all players on the winning team
      winnerNames = Array.from(playerTeamData.entries())
        .filter(([, data]) => data.team === winnerValue)
        .map(([, data]) => data.nickname);
    } else {
      // 2/3-player: single player name
      const entry = playerTeamData.get(winnerValue as PlayerIndex);
      winnerNames = entry ? [entry.nickname] : [String(winnerValue)];
    }

    return {
      id: event.id,
      timestamp: event.timestamp,
      type: 'game_finished',
      playerIndex: null,
      data: {
        kind: 'game_finished',
        winner: winnerValue,
        winnerNames,
      },
    };
  }
  ```

  **Note:** `playerTeamData` is the `Map<PlayerIndex, { nickname: string; team: Team }>` already built earlier in the same `useMemo` loop from `PLAYER_JOINED` events.

- [ ] **Step 3: Update formatter in `GameScreen.tsx`**

  In `apps/client/src/components/ui/GameScreen.tsx`, find the `case 'game_finished':` in `formatLogEntryText` (around line 139) and replace:

  ```typescript
  case 'game_finished':
    return t('gameLog.gameFinished', {
      name: d.winnerNames.join(' & '),
    });
  ```

- [ ] **Step 4: Build and test**

  ```bash
  pnpm --filter @dabb/shared-types run build
  pnpm --filter @dabb/ui-shared run build
  pnpm --filter @dabb/ui-shared test
  ```

  Expected: all succeed.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/shared-types/src/gameLog.ts packages/ui-shared/src/useGameLog.ts apps/client/src/components/ui/GameScreen.tsx
  git commit -m "feat: game log shows both team member names in 4-player game_finished entry"
  ```

---

## Task 11: Wire everything in `GameScreen`

**Files:**

- Modify: `apps/client/src/components/ui/GameScreen.tsx`

This is the most complex wiring task. Read the file before editing.

- [ ] **Step 1: Fix `totalScores` useMemo for 4-player (currently returns empty for team games)**

  The current `totalScores` useMemo iterates playerIndices and calls `state.totalScores.get(playerIndex)`, which returns `undefined` for 4-player games (score is keyed by `Team`). The memo result itself is fine for the 2/3-player path — we'll add a separate `teamScores` memo for 4-player.

  Add a new `teamScores` useMemo after the existing `totalScores` one:

  ```typescript
  // 4-player team mode: compute per-team score entries for scoreboard components
  const teamScores = useMemo((): TeamScoreEntry[] | undefined => {
    if (state.playerCount !== 4) return undefined;
    const myPlayer = state.players.find((p) => p.playerIndex === playerIndex);
    const myTeam = myPlayer?.team;
    const result: TeamScoreEntry[] = [];
    for (const team of [0, 1] as Team[]) {
      const members = state.players
        .filter((p) => p.team === team)
        .sort((a, b) => a.playerIndex - b.playerIndex);
      const names = members.map((p) => nicknames.get(p.playerIndex) ?? p.nickname).join(' & ');
      const score = state.totalScores.get(team) ?? 0;
      result.push({ team, names, score, isMyTeam: myTeam === team });
    }
    // Ensure local player's team is first
    return result.sort((a) => (a.isMyTeam ? -1 : 1));
  }, [state.players, state.totalScores, state.playerCount, playerIndex, nicknames]);
  ```

  Also add `teamsByPlayerIndex` for the modal:

  ```typescript
  const teamsByPlayerIndex = useMemo((): Map<PlayerIndex, Team> | undefined => {
    if (state.playerCount !== 4) return undefined;
    const map = new Map<PlayerIndex, Team>();
    for (const p of state.players) {
      if (p.team !== undefined) map.set(p.playerIndex, p.team);
    }
    return map;
  }, [state.players, state.playerCount]);
  ```

  You will also need to add the `Team` and `TeamScoreEntry` imports at the top:

  ```typescript
  import type {
    PlayerIndex,
    Card,
    GameLogEntry,
    Suit,
    Rank,
    Team,
    TeamScoreEntry,
  } from '@dabb/shared-types';
  ```

- [ ] **Step 2: Fix winner detection for 4-player**

  Replace the existing `winnerPlayer` block (lines ~346–352):

  ```typescript
  // Termination — derive winner info for 4-player (team) and 2/3-player (individual)
  const isTerminated = state.phase === 'terminated' || state.phase === 'finished';

  const winnerInfo = useMemo(() => {
    if (state.phase !== 'finished') return null;
    if (state.playerCount === 4) {
      // 4-player: totalScores keyed by Team
      const winningTeam =
        ([0, 1] as Team[]).find((t) => (state.totalScores.get(t) ?? 0) >= state.targetScore) ??
        null;
      if (winningTeam === null) return null;
      const myPlayer = state.players.find((p) => p.playerIndex === playerIndex);
      const isLocalWinner = myPlayer?.team === winningTeam;
      const winnerNicknames = state.players
        .filter((p) => p.team === winningTeam)
        .sort((a, b) => a.playerIndex - b.playerIndex)
        .map((p) => nicknames.get(p.playerIndex) ?? p.nickname);
      // Use first team member's id as winnerId (just needs to be non-null to show modal)
      const winnerId = state.players.find((p) => p.team === winningTeam)?.id ?? null;
      return { winnerId, winnerNicknames, isLocalWinner };
    } else {
      // 2/3-player: totalScores keyed by PlayerIndex
      const winnerPlayer =
        state.players.find((p) => {
          const score = state.totalScores.get(p.playerIndex);
          return score !== undefined && score >= state.targetScore;
        }) ?? null;
      if (!winnerPlayer) return null;
      return {
        winnerId: winnerPlayer.id,
        winnerNicknames: [nicknames.get(winnerPlayer.playerIndex) ?? winnerPlayer.nickname],
        isLocalWinner: winnerPlayer.playerIndex === playerIndex,
      };
    }
  }, [
    state.phase,
    state.playerCount,
    state.totalScores,
    state.targetScore,
    state.players,
    playerIndex,
    nicknames,
  ]);
  ```

- [ ] **Step 3: Pass `isTeammate` to `OpponentZone`**

  In the opponents render loop, derive `isTeammate` and pass it:

  ```typescript
  {Array.from(opponentPositions.entries()).map(([opIdx, pos]) => {
    const player = state.players[opIdx];
    const opCards = state.hands.get(opIdx);
    const myPlayer = state.players.find((p) => p.playerIndex === playerIndex);
    const isTeammate =
      state.playerCount === 4 &&
      myPlayer?.team !== undefined &&
      player?.team === myPlayer.team;
    return (
      <OpponentZone
        key={opIdx}
        playerIndex={opIdx}
        nickname={nicknames.get(opIdx) ?? player?.nickname ?? `P${opIdx}`}
        cardCount={opCards?.length ?? 0}
        isConnected={player?.connected ?? false}
        isTeammate={isTeammate}
        position={pos}
      />
    );
  })}
  ```

- [ ] **Step 4: Pass `teamScores` to `ScoreboardStrip`**

  ```typescript
  <ScoreboardStrip
    totalScores={totalScores}
    myPlayerIndex={playerIndex}
    bidWinner={state.bidWinner}
    currentBid={state.currentBid}
    trump={state.trump}
    nicknames={nicknames}
    teamScores={teamScores}
    onPress={() => setScoreboardOpen(true)}
  />
  ```

- [ ] **Step 5: Pass `teamScores` and `teamsByPlayerIndex` to `ScoreboardModal`**

  ```typescript
  <ScoreboardModal
    visible={scoreboardOpen}
    onClose={() => setScoreboardOpen(false)}
    rounds={rounds}
    currentRound={currentRound}
    nicknames={nicknames}
    playerCount={state.playerCount}
    totalScores={totalScores}
    teamScores={teamScores}
    teamsByPlayerIndex={teamsByPlayerIndex}
  />
  ```

- [ ] **Step 6: Pass `isTeamGame` to `CelebrationLayer`**

  ```typescript
  <CelebrationLayer
    showConfetti={showConfetti}
    showFireworks={showFireworks}
    isTeamGame={state.playerCount === 4}
  />
  ```

- [ ] **Step 7: Fix `GameTerminatedModal` to use new `winnerNicknames` prop**

  ```typescript
  <GameTerminatedModal
    visible={isTerminated}
    winnerId={winnerInfo?.winnerId ?? null}
    winnerNicknames={winnerInfo?.winnerNicknames ?? []}
    isLocalWinner={winnerInfo?.isLocalWinner ?? false}
    terminatedByNickname={terminatedByNickname}
    onDone={handleDone}
  />
  ```

- [ ] **Step 8: Build to verify all wiring**

  ```bash
  pnpm --filter @dabb/client run build 2>&1 | tail -30
  ```

  Expected: build succeeds with no TypeScript errors.

- [ ] **Step 9: Commit (includes GameTerminatedModal staged in Task 8)**

  ```bash
  git add apps/client/src/components/ui/GameScreen.tsx
  git commit -m "feat: wire team props in GameScreen — badges, scoreboard, winner detection, messages"
  ```

---

## Task 12: CI check

- [ ] **Step 1: Run full CI suite**

  ```bash
  pnpm run build && pnpm test && pnpm lint && pnpm run typecheck
  ```

  Expected: all pass.

- [ ] **Step 2: Fix any issues found**

  If type errors: read the specific file and fix. If test failures: read the test output and fix.

- [ ] **Step 3: Final commit if any fixes needed**

  ```bash
  git add -p   # stage only changed files
  git commit -m "fix: address CI issues in 4-player team improvements"
  ```

---

## Notes for Implementer

- **Task 10 (game log)** has a "read first" step — the exact shape of `game_finished` data in `useGameLog.ts` must be confirmed before editing. Do not skip the read.
- **Task 8** will leave a TypeScript build error until Task 11 is complete (caller still uses old prop). This is expected — commit the component change and fix the caller in Task 11.
- **Import additions** in `GameScreen.tsx` (Task 11): add `Team` and `TeamScoreEntry` to the `@dabb/shared-types` import line.
- **`useMemo` for `winnerInfo`** in Task 11 requires removing the old `const winnerPlayer = ...` block entirely.
