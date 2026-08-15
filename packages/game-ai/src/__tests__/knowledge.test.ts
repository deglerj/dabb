/**
 * Tests for buildRoundMemory.
 *
 * The scramble test at the bottom is the important one. All three drivers hand the AI an
 * unfiltered GameState, so nothing but discipline stops it reading opponents' hands — and a bot
 * that cheats does not look buggy, it looks strong. The scramble replaces every hidden part of
 * the state with different cards and asserts the deductions do not move.
 */

import { describe, expect, it } from 'vitest';
import type {
  Card,
  CompletedTrick,
  GameState,
  PlayedCard,
  PlayerIndex,
  Rank,
  Suit,
} from '@dabb/shared-types';
import { createInitialState } from '@dabb/game-logic';

import { buildRoundMemory } from '../knowledge.js';

function card(suit: Suit, rank: Rank, copy: 0 | 1 = 0): Card {
  return { id: `${suit}-${rank}-${copy}`, suit, rank, copy };
}

function play(playerIndex: PlayerIndex, c: Card): PlayedCard {
  return { cardId: c.id, card: c, playerIndex };
}

function trick(cards: PlayedCard[], winnerIndex: PlayerIndex, round = 1): CompletedTrick {
  return { cards, winnerIndex, points: 0, round };
}

/** Four-player game, trump Herz, seats 0/2 and 1/3 partnered. */
function baseState(overrides: Partial<GameState> = {}): GameState {
  const state = createInitialState(4);
  return {
    ...state,
    phase: 'tricks',
    playerCount: 4,
    players: [
      { id: 'p0', nickname: 'Alice', playerIndex: 0, team: 0 },
      { id: 'p1', nickname: 'Bob', playerIndex: 1, team: 1 },
      { id: 'p2', nickname: 'Carol', playerIndex: 2, team: 0 },
      { id: 'p3', nickname: 'Dave', playerIndex: 3, team: 1 },
    ],
    trump: 'herz',
    round: 1,
    hands: new Map([
      [0 as PlayerIndex, [card('kreuz', 'koenig'), card('herz', 'buabe')]],
      [1 as PlayerIndex, [card('schippe', 'ass')]],
      [2 as PlayerIndex, [card('bollen', 'ass')]],
      [3 as PlayerIndex, [card('bollen', '10')]],
    ]),
    ...overrides,
  };
}

describe('buildRoundMemory — deductions', () => {
  it('deduces a lead-suit void and a trump void from an off-suit discard', () => {
    // Bob cannot follow Kreuz and does not ruff, so he holds neither Kreuz nor trump. His
    // partner Dave is not winning at that point, so the must-trump rule was in force.
    const state = baseState({
      trickHistory: [
        trick(
          [
            play(0, card('kreuz', 'ass')),
            play(1, card('bollen', 'buabe')),
            play(2, card('kreuz', 'buabe')),
            play(3, card('kreuz', '10')),
          ],
          0
        ),
      ],
    });

    const memory = buildRoundMemory(state, 0);

    expect(memory.voidIn.get(1)).toContain('kreuz');
    expect(memory.voidIn.get(1)).toContain('herz');
    expect(memory.voidIn.has(2)).toBe(false);
  });

  it('does not deduce a trump void when the partner exemption lifted must-trump', () => {
    // Dave discards off-suit while his partner Bob is already winning the trick, which lifts
    // the obligation to ruff.
    const state = baseState({
      trickHistory: [
        trick(
          [
            play(0, card('kreuz', 'koenig', 1)),
            play(1, card('kreuz', 'ass')),
            play(2, card('kreuz', 'buabe')),
            play(3, card('bollen', 'buabe')),
          ],
          1
        ),
      ],
    });

    const memory = buildRoundMemory(state, 0);

    // Following suit still applied, so the lead-suit void is real...
    expect(memory.voidIn.get(3)).toContain('kreuz');
    // ...but he was free to keep his trump, so nothing is known about it.
    expect(memory.voidIn.get(3)?.has('herz')).toBe(false);
  });

  it('deduces a strength ceiling when a player follows suit without beating', () => {
    // Bob follows Kreuz with the Ober under Alice's Ass: must-beat was in force, so he holds
    // nothing in Kreuz above the Ass — i.e. nothing at all above it.
    const state = baseState({
      trickHistory: [
        trick(
          [
            play(0, card('kreuz', 'ass')),
            play(1, card('kreuz', 'ober')),
            play(2, card('kreuz', 'buabe')),
            play(3, card('kreuz', '10')),
          ],
          0
        ),
      ],
    });

    const memory = buildRoundMemory(state, 0);

    expect(memory.maxStrength.get(1)?.get('kreuz')).toBe(4); // Ass strength
    expect(memory.couldHoldAbove(1, 'kreuz', 4)).toBe(false);
    // Below the ceiling is still possible — the Kreuz König copies are unaccounted for.
    expect(memory.couldHoldAbove(1, 'kreuz', 1)).toBe(true);
  });

  it('folds the in-progress trick, not just completed ones', () => {
    const state = baseState({
      currentTrick: {
        cards: [play(0, card('kreuz', 'ass')), play(1, card('bollen', 'buabe'))],
        leadSuit: 'kreuz',
        winnerIndex: null,
      },
    });

    const memory = buildRoundMemory(state, 0);

    expect(memory.voidIn.get(1)).toContain('kreuz');
    expect(memory.voidIn.get(1)).toContain('herz');
  });

  it('counts unseen trump and reports zero when all trump is accounted for', () => {
    const full = buildRoundMemory(baseState(), 0);
    // 10 trump in the deck, one (herz-buabe-0) in our hand.
    expect(full.unseenTrump).toBe(9);

    const allTrumpPlayed = baseState({
      trickHistory: (['ass', '10', 'koenig', 'ober', 'buabe'] as Rank[]).flatMap((rank) =>
        ([0, 1] as const).map((copy) =>
          trick([play(1, card('herz', rank, copy)), play(2, card('kreuz', 'buabe', copy))], 1)
        )
      ),
    });

    const memory = buildRoundMemory(allTrumpPlayed, 0);
    // herz-buabe-0 is in our hand but was also "played" by this crude fixture; the count is
    // clamped per copy, so every trump is accounted for either way.
    expect(memory.unseenTrump).toBe(0);
  });

  it('locates cards an opponent declared in a meld and has not played', () => {
    const state = baseState({
      declaredMelds: new Map([
        [
          1 as PlayerIndex,
          [
            {
              type: 'paar' as const,
              cards: ['schippe-koenig-0', 'schippe-ober-0'],
              points: 20,
              suit: 'schippe' as Suit,
            },
          ],
        ],
      ]),
    });

    const memory = buildRoundMemory(state, 0);

    expect(memory.located.get(1)).toContain('schippe-koenig-0');
    expect(memory.located.get(1)).toContain('schippe-ober-0');
  });

  it('drops a melded card from located once it has been played', () => {
    const state = baseState({
      declaredMelds: new Map([
        [
          1 as PlayerIndex,
          [
            {
              type: 'paar' as const,
              cards: ['schippe-koenig-0', 'schippe-ober-0'],
              points: 20,
              suit: 'schippe' as Suit,
            },
          ],
        ],
      ]),
      trickHistory: [
        trick([play(1, card('schippe', 'koenig')), play(2, card('schippe', 'ass'))], 2),
      ],
    });

    const memory = buildRoundMemory(state, 0);

    expect(memory.located.get(1)?.has('schippe-koenig-0')).toBe(false);
    expect(memory.located.get(1)).toContain('schippe-ober-0');
  });
});

describe('buildRoundMemory — the layaway', () => {
  const layaway = [
    card('herz', 'koenig'), // trump: publicly announced
    card('kreuz', '10'),
    card('bollen', 'ober'),
    card('schippe', 'buabe'),
  ];

  function withLayaway(): GameState {
    return baseState({
      bidWinner: 1 as PlayerIndex,
      tricksTaken: new Map([[1 as PlayerIndex, [layaway]]]),
    });
  }

  it('lets the bid winner count their own layaway', () => {
    const memory = buildRoundMemory(withLayaway(), 1);

    for (const c of layaway) {
      expect(memory.gone).toContain(c.id);
    }
  });

  it('shows everyone else only the buried trump', () => {
    const memory = buildRoundMemory(withLayaway(), 0);

    // Burying a trump has to be announced, so this one is public.
    expect(memory.gone).toContain('herz-koenig-0');
    // The other three are face down. Reading them would be cheating.
    expect(memory.gone.has('kreuz-10-0')).toBe(false);
    expect(memory.gone.has('bollen-ober-0')).toBe(false);
    expect(memory.gone.has('schippe-buabe-0')).toBe(false);
  });
});

describe('buildRoundMemory — does not cheat', () => {
  /** Replace everything the view filter would hide from `self` with different cards. */
  function scramble(state: GameState, self: PlayerIndex): GameState {
    const hands = new Map(state.hands);
    for (const [index] of state.hands) {
      if (index !== self) {
        // Deliberately cards that appear nowhere else in the fixture.
        hands.set(index, [card('schippe', '10', 1), card('bollen', 'koenig', 1)]);
      }
    }

    // The bid winner's face-down layaway, and the dabb, are equally off limits.
    const tricksTaken = new Map(state.tricksTaken);
    if (state.bidWinner !== null && state.bidWinner !== self) {
      const existing = tricksTaken.get(state.bidWinner);
      if (existing && existing.length > 0) {
        tricksTaken.set(state.bidWinner, [
          [
            // Keep the trump card: that one is genuinely public.
            ...existing[0].filter((c) => c.suit === state.trump),
            card('kreuz', 'ober', 1),
            card('schippe', 'koenig', 1),
            card('bollen', 'buabe', 1),
          ],
          ...existing.slice(1),
        ]);
      }
    }

    return {
      ...state,
      hands,
      tricksTaken,
      dabb: [card('kreuz', 'ass', 1), card('herz', '10', 1)],
    };
  }

  function snapshot(state: GameState, self: PlayerIndex) {
    const memory = buildRoundMemory(state, self);
    return {
      gone: [...memory.gone].sort(),
      located: [...memory.located].map(([k, v]) => [k, [...v].sort()]),
      voidIn: [...memory.voidIn].map(([k, v]) => [k, [...v].sort()]),
      maxStrength: [...memory.maxStrength].map(([k, v]) => [k, [...v].sort()]),
      unseenTrump: memory.unseenTrump,
      unseenKreuzAss: memory.unseen('kreuz', 'ass'),
      unseenHerzZehn: memory.unseen('herz', '10'),
      couldBob: memory.couldHoldAbove(1, 'kreuz', 2),
      couldDave: memory.couldHoldAbove(3, 'herz', 0),
    };
  }

  it('produces identical knowledge when hidden state is replaced', () => {
    const state = baseState({
      bidWinner: 1 as PlayerIndex,
      tricksTaken: new Map([
        [
          1 as PlayerIndex,
          [
            [
              card('herz', 'koenig'),
              card('kreuz', '10'),
              card('bollen', 'ober'),
              card('schippe', 'buabe'),
            ],
          ],
        ],
      ]),
      declaredMelds: new Map([
        [
          1 as PlayerIndex,
          [
            {
              type: 'paar' as const,
              cards: ['schippe-koenig-0', 'schippe-ober-0'],
              points: 20,
              suit: 'schippe' as Suit,
            },
          ],
        ],
      ]),
      trickHistory: [
        trick(
          [
            play(0, card('kreuz', 'ass')),
            play(1, card('kreuz', 'ober')),
            play(2, card('bollen', 'buabe')),
            play(3, card('kreuz', 'buabe')),
          ],
          0
        ),
      ],
      currentTrick: {
        cards: [play(0, card('schippe', 'ass', 1))],
        leadSuit: 'schippe',
        winnerIndex: null,
      },
    });

    const honest = snapshot(state, 0);
    const cheated = snapshot(scramble(state, 0), 0);

    expect(cheated).toEqual(honest);
  });

  it('still reflects our own hand, so the test is not vacuous', () => {
    const state = baseState();
    const before = buildRoundMemory(state, 0).unseenTrump;

    const withMoreTrump = baseState({
      hands: new Map(state.hands).set(0 as PlayerIndex, [
        card('herz', 'buabe'),
        card('herz', 'ass'),
        card('herz', '10'),
      ]),
    });

    expect(buildRoundMemory(withMoreTrump, 0).unseenTrump).toBe(before - 2);
  });
});
