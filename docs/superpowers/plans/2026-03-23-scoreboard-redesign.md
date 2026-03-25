# Scoreboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cryptic `240m + 70t` score breakdown with icon-labelled values and add colour-coded outcome badges to the bid column of the scoreboard modal.

**Architecture:** Add `wentOut?: boolean` to the shared `RoundHistoryEntry` type and propagate it through the `useRoundHistory` hook by tracking the `GOING_OUT` event. The `ScoreboardModal` reads the new field to render badges and adjusted score detail lines. i18n keys are added for the three badge labels.

**Tech Stack:** TypeScript, React Native (StyleSheet), Vitest + @testing-library/react (renderHook), pnpm workspaces.

---

## File Map

| File                                                       | Change                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/shared-types/src/game.ts`                        | Add `wentOut?: boolean` to `RoundHistoryEntry`                             |
| `packages/i18n/src/types.ts`                               | Add `bidMet`, `bidMissed`, `wentOut` to `game` namespace                   |
| `packages/i18n/src/locales/de.ts`                          | Add German translations                                                    |
| `packages/i18n/src/locales/en.ts`                          | Add English translations                                                   |
| `packages/ui-shared/src/useRoundHistory.ts`                | Track `GOING_OUT`; expose `wentOut` on completed rounds and `currentRound` |
| `packages/ui-shared/src/__tests__/useRoundHistory.test.ts` | New test file                                                              |
| `apps/client/src/components/game/ScoreboardModal.tsx`      | Visual redesign: icons, badges, red totals                                 |

---

## Task 1: Add `wentOut` to `RoundHistoryEntry`

**Files:**

- Modify: `packages/shared-types/src/game.ts` (around line 197)

- [ ] **Step 1: Add the field**

  Open `packages/shared-types/src/game.ts`. Find `RoundHistoryEntry` (~line 197). Add `wentOut?: boolean` after `winningBid`:

  ```ts
  export interface RoundHistoryEntry {
    round: number;
    bidWinner: PlayerIndex | null;
    winningBid: number;
    wentOut?: boolean; // true when the bid winner chose to go out (Abgehen)
    scores: Record<
      PlayerIndex | Team,
      { melds: number; tricks: number; total: number; bidMet: boolean }
    > | null;
  }
  ```

- [ ] **Step 2: Verify build**

  ```bash
  pnpm --filter @dabb/shared-types run build
  ```

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add packages/shared-types/src/game.ts
  git commit -m "feat(shared-types): add wentOut to RoundHistoryEntry"
  ```

---

## Task 2: Add i18n keys

**Files:**

- Modify: `packages/i18n/src/types.ts` (around line 125)
- Modify: `packages/i18n/src/locales/de.ts` (after line 115)
- Modify: `packages/i18n/src/locales/en.ts` (after line 115)

- [ ] **Step 1: Add to TranslationKeys**

  In `packages/i18n/src/types.ts`, find the `game` block. Add three keys after `bidColumn: string;` (~line 125):

  ```ts
  bidColumn: string;
  bidMet: string;
  bidMissed: string;
  wentOut: string;
  ```

- [ ] **Step 2: Add German translations**

  In `packages/i18n/src/locales/de.ts`, after `bidColumn: 'Gebot',` (line 115):

  ```ts
  bidColumn: 'Gebot',
  bidMet: 'Gebot erfüllt',
  bidMissed: 'Gebot verfehlt',
  wentOut: 'Abgegangen',
  ```

- [ ] **Step 3: Add English translations**

  In `packages/i18n/src/locales/en.ts`, after `bidColumn: 'Bid',` (line 115):

  ```ts
  bidColumn: 'Bid',
  bidMet: 'Bid met',
  bidMissed: 'Bid missed',
  wentOut: 'Went out',
  ```

- [ ] **Step 4: Verify build**

  ```bash
  pnpm --filter @dabb/i18n run build
  ```

  Expected: no errors. (The `satisfies TranslationKeys` assertion in each locale file will catch any missing keys.)

- [ ] **Step 5: Commit**

  ```bash
  git add packages/i18n/src/types.ts packages/i18n/src/locales/de.ts packages/i18n/src/locales/en.ts
  git commit -m "feat(i18n): add bidMet, bidMissed, wentOut keys"
  ```

---

## Task 3: Update `useRoundHistory` to track going-out

**Files:**

- Create: `packages/ui-shared/src/__tests__/useRoundHistory.test.ts`
- Modify: `packages/ui-shared/src/useRoundHistory.ts`

### Step-by-step

- [ ] **Step 1: Write the failing tests**

  Create `packages/ui-shared/src/__tests__/useRoundHistory.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { renderHook } from '@testing-library/react';
  import { useRoundHistory } from '../useRoundHistory.js';
  import type { GameEvent } from '@dabb/shared-types';

  const base = { sessionId: 's1', timestamp: 0 };
  const seq = (() => {
    let n = 0;
    return () => ++n;
  })();

  function ev<T extends GameEvent['type']>(
    type: T,
    payload: Extract<GameEvent, { type: T }>['payload']
  ): GameEvent {
    return { ...base, id: `e${seq()}`, sequence: seq(), type, payload } as GameEvent;
  }

  const gameStarted = ev('GAME_STARTED', { playerCount: 3, targetScore: 1000, dealer: 0 });
  const biddingWon = ev('BIDDING_WON', { playerIndex: 0, winningBid: 180 });
  const goingOut = ev('GOING_OUT', { playerIndex: 0, suit: 'HERZ' });
  const roundScored = ev('ROUND_SCORED', {
    scores: {
      0: { melds: 0, tricks: 0, total: -180, bidMet: false },
      1: { melds: 80, tricks: 0, total: 80, bidMet: false },
      2: { melds: 40, tricks: 0, total: 40, bidMet: false },
    },
    totalScores: { 0: -180, 1: 80, 2: 40 },
  });
  const newRound = ev('NEW_ROUND_STARTED', { round: 2, dealer: 1 });
  const biddingWon2 = ev('BIDDING_WON', { playerIndex: 1, winningBid: 160 });
  const roundScored2 = ev('ROUND_SCORED', {
    scores: {
      0: { melds: 120, tricks: 90, total: 210, bidMet: false },
      1: { melds: 60, tricks: 100, total: 160, bidMet: true },
      2: { melds: 80, tricks: 30, total: 110, bidMet: false },
    },
    totalScores: { 0: 30, 1: 240, 2: 150 },
  });

  describe('useRoundHistory', () => {
    it('sets wentOut on a completed going-out round', () => {
      const { result } = renderHook(() =>
        useRoundHistory([gameStarted, biddingWon, goingOut, roundScored])
      );
      expect(result.current.rounds).toHaveLength(1);
      expect(result.current.rounds[0].wentOut).toBe(true);
    });

    it('does not set wentOut on a normal completed round', () => {
      const { result } = renderHook(() => useRoundHistory([gameStarted, biddingWon, roundScored]));
      expect(result.current.rounds).toHaveLength(1);
      expect(result.current.rounds[0].wentOut).toBeUndefined();
    });

    it('sets wentOut on currentRound while in progress after going out', () => {
      const { result } = renderHook(() => useRoundHistory([gameStarted, biddingWon, goingOut]));
      expect(result.current.currentRound?.wentOut).toBe(true);
    });

    it('does not set wentOut on currentRound before going out', () => {
      const { result } = renderHook(() => useRoundHistory([gameStarted, biddingWon]));
      expect(result.current.currentRound?.wentOut).toBeUndefined();
    });

    it('resets wentOut between rounds', () => {
      const { result } = renderHook(() =>
        useRoundHistory([
          gameStarted,
          biddingWon,
          goingOut,
          roundScored,
          newRound,
          biddingWon2,
          roundScored2,
        ])
      );
      expect(result.current.rounds).toHaveLength(2);
      expect(result.current.rounds[0].wentOut).toBe(true);
      expect(result.current.rounds[1].wentOut).toBeUndefined();
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  pnpm --filter @dabb/ui-shared test -- --reporter=verbose useRoundHistory
  ```

  Expected: all 5 tests FAIL (hook doesn't yet track `GOING_OUT`).

- [ ] **Step 3: Update `RoundHistoryResult.currentRound` type**

  In `packages/ui-shared/src/useRoundHistory.ts`, add `wentOut?: boolean` to the `currentRound` inline type in the `RoundHistoryResult` interface:

  ```ts
  export interface RoundHistoryResult {
    rounds: RoundHistoryEntry[];
    currentRound: {
      round: number;
      bidWinner: PlayerIndex | null;
      winningBid: number;
      wentOut?: boolean;
      meldScores: Record<PlayerIndex, number> | null;
    } | null;
    gameWinner: PlayerIndex | Team | null;
  }
  ```

- [ ] **Step 4: Add `wentOut` tracking to the hook**

  In the `useMemo` callback of `useRoundHistory`:
  1. Add `let wentOut = false;` alongside the other accumulator declarations at the top of the callback.

  2. In the `NEW_ROUND_STARTED` case, add `wentOut = false;`:

     ```ts
     case 'NEW_ROUND_STARTED':
       roundNumber = event.payload.round;
       bidWinner = null;
       winningBid = 0;
       meldScores = {} as Record<PlayerIndex, number>;
       wentOut = false;
       break;
     ```

  3. Add a new `GOING_OUT` case (before `ROUND_SCORED`):

     ```ts
     case 'GOING_OUT':
       wentOut = true;
       break;
     ```

  4. In the `ROUND_SCORED` case, spread `wentOut` conditionally when pushing the entry:

     ```ts
     rounds.push({
       round: roundNumber,
       bidWinner,
       winningBid,
       ...(wentOut ? { wentOut } : {}),
       scores: event.payload.scores as Record<...>,
     });
     ```

     Do NOT reset `wentOut` here — it resets on the next `NEW_ROUND_STARTED`.

  5. In the first `currentRound` construction block (the `if (bidWinner !== null)` branch, ~line 89), spread `wentOut`:

     ```ts
     currentRound = {
       round: roundNumber,
       bidWinner,
       winningBid,
       ...(wentOut ? { wentOut } : {}),
       meldScores: hasMelds ? meldScores : null,
     };
     ```

     The second branch (`bidWinner === null` fallback, ~line 104) does NOT include `wentOut`.

- [ ] **Step 5: Run tests to confirm they pass**

  ```bash
  pnpm --filter @dabb/ui-shared test -- --reporter=verbose useRoundHistory
  ```

  Expected: all 5 tests PASS.

- [ ] **Step 6: Run full ui-shared test suite**

  ```bash
  pnpm --filter @dabb/ui-shared test
  ```

  Expected: all tests pass.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/ui-shared/src/useRoundHistory.ts packages/ui-shared/src/__tests__/useRoundHistory.test.ts
  git commit -m "feat(ui-shared): track GOING_OUT in useRoundHistory"
  ```

---

## Task 4: Redesign ScoreboardModal

**Files:**

- Modify: `apps/client/src/components/game/ScoreboardModal.tsx`

This task is purely visual — no new tests needed (the hook is already tested; UI rendering tests for React Native require a snapshot/integration setup not established in this codebase).

- [ ] **Step 1: Add new styles**

  At the bottom of `StyleSheet.create({...})` in `ScoreboardModal.tsx`, add:

  ```ts
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
  scoreTotalNegative: {
    color: '#e05555',
  },
  ```

- [ ] **Step 2: Fix the zero-score guard**

  Find `{score ? (` (~line 74). Change to:

  ```tsx
  {score != null ? (
  ```

- [ ] **Step 3: Replace score detail line**

  Find the `<Text style={styles.scoreDetail}>` line that renders `{score.melds}m + {score.tricks}t`. Replace the whole block with:

  ```tsx
  <Text style={styles.scoreDetail}>
    {round.wentOut ? `🃏 ${score.melds}` : `🃏 ${score.melds} + 🏆 ${score.tricks}`}
  </Text>
  ```

  Note: `round` is the `RoundHistoryEntry` from the outer `rounds.map`. The `round` variable is in scope.

- [ ] **Step 4: Update score total colour**

  Find the `<Text style={[styles.scoreTotal, score.bidMet ? styles.bidMet : undefined]}>` line. Replace with:

  ```tsx
  <Text
    style={[
      styles.scoreTotal,
      pi === round.bidWinner && score.bidMet ? styles.bidMet : undefined,
      score.total < 0 ? styles.scoreTotalNegative : undefined,
    ]}
  >
    {score.total}
  </Text>
  ```

  This narrows the green `bidMet` highlight to the bid winner only, and adds red for negative totals.

- [ ] **Step 5: Add badge helper function**

  At the top of the component function body (after `const { t } = useTranslation();`), add:

  ```tsx
  function BidBadge({ round }: { round: RoundHistoryEntry }) {
    if (round.scores === null) return null; // in-progress — handled separately
    if (round.wentOut) {
      return (
        <View style={[styles.badge, styles.wentOutBadge]}>
          <Text style={[styles.badgeText, { color: '#c97f00' }]}>🚪 {t('game.wentOut')}</Text>
        </View>
      );
    }
    if (round.bidWinner !== null && round.scores[round.bidWinner]?.bidMet) {
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
  ```

- [ ] **Step 6: Render badge in completed round rows**

  Find the bid cell `<Text>` inside `rounds.map`:

  ```tsx
  <Text style={[styles.cell, styles.bidCell]}>
    {round.bidWinner !== null ? `${name(round.bidWinner)} ${round.winningBid}` : '—'}
  </Text>
  ```

  Replace with a `<View>` so the badge can sit alongside the text:

  ```tsx
  <View
    style={[
      styles.cell,
      styles.bidCell,
      { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
    ]}
  >
    <Text style={{ color: '#c8b090', fontSize: 11 }}>
      {round.bidWinner !== null ? `${name(round.bidWinner)} · ${round.winningBid}` : '—'}
    </Text>
    {round.bidWinner !== null && <BidBadge round={round} />}
  </View>
  ```

- [ ] **Step 7: Render going-out badge on the in-progress row**

  Find the `currentRound` row's bid cell `<Text>`. Replace it with:

  ```tsx
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
        <Text style={[styles.badgeText, { color: '#c97f00' }]}>🚪 {t('game.wentOut')}</Text>
      </View>
    )}
  </View>
  ```

- [ ] **Step 8: Build and typecheck**

  ```bash
  pnpm run build
  ```

  Expected: no errors. This runs `tsc` which will catch any type errors across all packages.

- [ ] **Step 9: Run all tests**

  ```bash
  pnpm test
  ```

  Expected: all tests pass.

- [ ] **Step 10: Commit**

  ```bash
  git add apps/client/src/components/game/ScoreboardModal.tsx
  git commit -m "feat(client): redesign scoreboard modal with icon breakdown and outcome badges"
  ```

---

## Final check

- [ ] **Run CI locally**

  ```bash
  /ci-check
  ```

  Expected: build, lint, and tests all pass.
