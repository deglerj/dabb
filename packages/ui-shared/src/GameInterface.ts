/**
 * GameInterface — unified contract for online and offline game hooks.
 * Both useGame and useOfflineGame implement this interface.
 * GameScreen accepts it as a prop, unaware of transport layer.
 */
import type { CardId, EmoteKey, GameEvent, GameState, PlayerIndex, Suit } from '@dabb/shared-types';

export interface GameInterface {
  state: GameState;
  events: GameEvent[];
  /**
   * Ids of the events that were already in the log when this client joined — i.e. everything
   * that is only being replayed. Sounds, haptics and animations skip them, so a rejoin drops
   * the player into the current state instead of playing the round back at them.
   *
   * The driver knows this and nothing downstream can work it out: an "initial load" flag flips
   * on the first batch and Firebase can deliver old events in later batches, and event
   * timestamps come from whichever client wrote them, so a skewed clock or a slow connection
   * would misclassify. Membership in the join snapshot is exact.
   */
  replayedEventIds: Set<string>;
  /** Map from player index to display nickname. */
  nicknames: Map<PlayerIndex, string>;
  /** Whether the transport is connected (always true offline). */
  connected: boolean;
  /**
   * Seats currently reachable. AI seats count as connected — they are driven by whichever
   * client holds the cascade claim and never report presence of their own. Offline, every
   * seat is connected.
   */
  connectedPlayers: Set<PlayerIndex>;
  /**
   * Set once a remote player has ended an online game. `nickname` is null when the session
   * reported the termination without saying who did it. Always null offline.
   */
  terminatedBy: { nickname: string | null } | null;
  /**
   * Seats showing an emote right now. Emotes are ephemeral and never enter the event log,
   * so this map is not derived from `events` and does not survive a reload of its own accord.
   */
  emotes: Map<PlayerIndex, EmoteKey>;
  /** Sends an emote from the local player. */
  onSendEmote: (key: EmoteKey) => void;
  onBid: (amount: number) => void;
  onPass: () => void;
  onTakeDabb: () => void;
  onDiscard: (cardIds: CardId[]) => void;
  /** Trump is already declared when going out, so no suit is passed. */
  onGoOut: () => void;
  onDeclareTrump: (suit: Suit) => void;
  /** Declares every meld in the hand — the engine derives them, the caller passes nothing. */
  onDeclareMelds: () => void;
  onPlayCard: (cardId: CardId) => void;
  onExit: () => void;
}
