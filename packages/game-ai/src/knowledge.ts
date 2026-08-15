/**
 * What the AI is allowed to know about a round in progress.
 *
 * ## Why this is the only place that reads GameState
 *
 * All three drivers hand the AI an **unfiltered** state: `useAI` passes `applyEvents(rawEvents)`,
 * `SimulationEngine` and `OfflineGameEngine` pass their own `this.state`. `state.hands` therefore
 * holds every opponent's real cards, `state.dabb` holds the dabb, and `tricksTaken` holds the bid
 * winner's layaway. A card-counting AI that reads any of those is cheating, and the bug would be
 * invisible — it would simply look like a very strong bot.
 *
 * So every fact the AI uses about other hands is derived here, from public information only, and
 * `knowledge.test.ts` scrambles the hidden parts of the state and asserts the output is unchanged.
 * Read state anywhere else in the AI and that test cannot protect you.
 *
 * ## Why deduction rather than probability
 *
 * `getValidPlays` is strict: follow suit, beat the highest card of the lead suit if you can,
 * otherwise trump, otherwise beat the highest trump. Every card an opponent plays therefore
 * *proves* something about their hand — no guessing required. The partner exemption (4-player,
 * partner currently winning) lifts the beat and trump obligations but never the follow, so the
 * fold below replays each trick card by card to know which obligations were in force.
 *
 * ## Why it is recomputed rather than accumulated
 *
 * The AI used to track voids in an instance field. `useAI` builds a fresh `BinokelAIPlayer` for
 * every single decision, so online bots threw that away immediately and played with no memory at
 * all. A pure fold over `state.trickHistory` has the same answer in all three drivers.
 *
 * See docs/design/AI_STRATEGY_V2.md.
 */

import type { Card, CardId, GameState, PlayerIndex, Rank, Suit, Trick } from '@dabb/shared-types';
import { RANKS, SUITS } from '@dabb/shared-types';
import { CARD_STRENGTH, cardBeats, isPartnerWinning } from '@dabb/game-logic';

/** Copies of every card in the deck. */
const COPIES_PER_CARD = 2;

export interface RoundMemory {
  /** Cards that are out of play: played this round, plus any layaway this player may see. */
  gone: Set<CardId>;

  /**
   * Cards known to sit in a specific hand right now — this player's own cards, and cards an
   * opponent declared in a meld and has not played since. A declared meld does not remove a card
   * from circulation, it *locates* it, and that is public information the AI never used before.
   */
  located: Map<PlayerIndex, Set<CardId>>;

  /**
   * Suits a player is deduced to hold none of. Trump is a suit like any other here: a player in
   * `voidIn.get(p)` for the trump suit cannot ruff.
   */
  voidIn: Map<PlayerIndex, Set<Suit>>;

  /**
   * Strength ceiling per player and suit: they are known to hold nothing at or above this
   * strength in that suit, deduced from a must-beat obligation they failed to satisfy. Absent
   * means nothing is known. Valid for the rest of the round, since hands only shrink.
   */
  maxStrength: Map<PlayerIndex, Map<Suit, number>>;

  /** How many copies of this card are unaccounted for — in some other hand, or in the dabb. */
  unseen(suit: Suit, rank: Rank): number;

  /** Trump cards unaccounted for across all other hands. 0 means nobody can ruff. */
  unseenTrump: number;

  /** Whether `playerIndex` could still hold a card of `suit` that beats `strength`. */
  couldHoldAbove(playerIndex: PlayerIndex, suit: Suit, strength: number): boolean;
}

function addTo<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

/** Lower an existing ceiling, never raise it — a deduction made earlier stays true. */
function lowerCeiling(
  map: Map<PlayerIndex, Map<Suit, number>>,
  playerIndex: PlayerIndex,
  suit: Suit,
  strength: number
): void {
  let bySuit = map.get(playerIndex);
  if (!bySuit) {
    bySuit = new Map();
    map.set(playerIndex, bySuit);
  }
  const current = bySuit.get(suit);
  if (current === undefined || strength < current) {
    bySuit.set(suit, strength);
  }
}

/** The strongest card of `suit` played into `trick` so far, or null. */
function highestOfSuit(cards: Trick['cards'], suit: Suit): Card | null {
  let best: Card | null = null;
  for (const played of cards) {
    if (played.card.suit !== suit) {
      continue;
    }
    if (best === null || CARD_STRENGTH[played.card.rank] > CARD_STRENGTH[best.rank]) {
      best = played.card;
    }
  }
  return best;
}

/**
 * Fold one trick, in play order, recording what each opponent's card proves.
 *
 * `cards` may be a partial trick — the in-progress one is folded the same way, since a card
 * already on the table proves just as much as one in a finished trick.
 */
function foldTrick(
  cards: Trick['cards'],
  state: GameState,
  self: PlayerIndex,
  trump: Suit,
  voidIn: Map<PlayerIndex, Set<Suit>>,
  maxStrength: Map<PlayerIndex, Map<Suit, number>>
): void {
  if (cards.length === 0) {
    return;
  }
  const leadSuit = cards[0].card.suit;

  for (let i = 1; i < cards.length; i++) {
    const { playerIndex, card } = cards[i];
    // Our own cards teach us nothing we do not already know from our hand.
    if (playerIndex === self) {
      continue;
    }

    const soFar = cards.slice(0, i);
    // The obligations in force are the ones that applied when this card was played, so the
    // trick has to be reconstructed as it stood at that moment.
    const partial: Trick = { cards: soFar, leadSuit, winnerIndex: null };
    const exempt = isPartnerWinning(partial, trump, playerIndex, state.players);

    if (card.suit !== leadSuit) {
      // Following suit is required even under the partner exemption, so an off-suit card
      // always proves the player had none of the lead suit.
      addTo(voidIn, playerIndex, leadSuit);

      if (card.suit !== trump && !exempt) {
        // Must-trump was in force and they did not, so they hold no trump either. Under the
        // exemption they were free to discard, and this proves nothing about their trump.
        addTo(voidIn, playerIndex, trump);
      }

      if (card.suit === trump && !exempt) {
        // They ruffed, but had to beat the highest trump already down and did not.
        const highestTrump = highestOfSuit(soFar, trump);
        if (highestTrump && !cardBeats(card, highestTrump, leadSuit, trump)) {
          lowerCeiling(maxStrength, playerIndex, trump, CARD_STRENGTH[highestTrump.rank]);
        }
      }
      continue;
    }

    // Followed suit. Under the exemption they were free to play low; otherwise, failing to beat
    // the highest card of the lead suit proves they held nothing higher in it.
    if (!exempt) {
      const highestLead = highestOfSuit(soFar, leadSuit);
      if (highestLead && !cardBeats(card, highestLead, leadSuit, trump)) {
        lowerCeiling(maxStrength, playerIndex, leadSuit, CARD_STRENGTH[highestLead.rank]);
      }
    }
  }
}

/**
 * Everything `playerIndex` may legitimately know about the current round.
 *
 * Reads only: their own hand, the trick history and the trick on the table, the declared melds,
 * and the publicly announced trump layaway. Never `state.hands` for anybody else, never
 * `state.dabb`, never another player's face-down layaway.
 */
export function buildRoundMemory(state: GameState, playerIndex: PlayerIndex): RoundMemory {
  const trump = state.trump;
  const myHand = state.hands.get(playerIndex) ?? [];

  const gone = new Set<CardId>();
  const located = new Map<PlayerIndex, Set<CardId>>();
  const voidIn = new Map<PlayerIndex, Set<Suit>>();
  const maxStrength = new Map<PlayerIndex, Map<Suit, number>>();

  const playedThisRound: Card[] = [];
  for (const trick of state.trickHistory) {
    for (const played of trick.cards) {
      gone.add(played.card.id);
      playedThisRound.push(played.card);
    }
  }
  for (const played of state.currentTrick.cards) {
    gone.add(played.card.id);
    playedThisRound.push(played.card);
  }

  // The bid winner's layaway. They know their own four; everyone else knows only the trump
  // among them, because burying a trump has to be announced (filterCardsDiscarded in views.ts
  // leaves trump-suited IDs readable). Reading the rest here would be cheating — and it is not
  // state.hands, so the scramble test would not catch it either.
  if (state.bidWinner !== null && trump !== null) {
    const layaway = state.tricksTaken.get(state.bidWinner)?.[0] ?? [];
    for (const card of layaway) {
      if (state.bidWinner === playerIndex || card.suit === trump) {
        gone.add(card.id);
      }
    }
  }

  // Declared melds locate cards rather than removing them: melded cards go back to the hand.
  for (const [owner, melds] of state.declaredMelds) {
    for (const meld of melds) {
      for (const cardId of meld.cards) {
        if (!gone.has(cardId)) {
          addTo(located, owner, cardId);
        }
      }
    }
  }
  for (const card of myHand) {
    addTo(located, playerIndex, card.id);
  }

  if (trump !== null) {
    for (const trick of state.trickHistory) {
      foldTrick(trick.cards, state, playerIndex, trump, voidIn, maxStrength);
    }
    foldTrick(state.currentTrick.cards, state, playerIndex, trump, voidIn, maxStrength);
  }

  // Copies of each card that are neither ours nor accounted for as played.
  const unseenCounts = new Map<string, number>();
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      let remaining = COPIES_PER_CARD;
      for (let copy = 0; copy < COPIES_PER_CARD; copy++) {
        const id = `${suit}-${rank}-${copy}`;
        if (gone.has(id) || myHand.some((c) => c.id === id)) {
          remaining--;
        }
      }
      unseenCounts.set(`${suit}-${rank}`, remaining);
    }
  }

  const unseen = (suit: Suit, rank: Rank): number => unseenCounts.get(`${suit}-${rank}`) ?? 0;

  let unseenTrump = 0;
  if (trump !== null) {
    for (const rank of RANKS) {
      unseenTrump += unseen(trump, rank);
    }
  }

  const couldHoldAbove = (target: PlayerIndex, suit: Suit, strength: number): boolean => {
    if (target === playerIndex) {
      return myHand.some((c) => c.suit === suit && CARD_STRENGTH[c.rank] > strength);
    }
    if (voidIn.get(target)?.has(suit)) {
      return false;
    }
    const ceiling = maxStrength.get(target)?.get(suit);
    if (ceiling !== undefined && ceiling <= strength) {
      return false;
    }
    return RANKS.some((rank) => CARD_STRENGTH[rank] > strength && unseen(suit, rank) > 0);
  };

  return {
    gone,
    located,
    voidIn,
    maxStrength,
    unseen,
    unseenTrump,
    couldHoldAbove,
  };
}
