/**
 * GameInterface — unified contract for online and offline game hooks.
 * Both useGame and useOfflineGame implement this interface.
 * GameScreen accepts it as a prop, unaware of transport layer.
 */
import type { CardId, EmoteKey, GameEvent, GameState, PlayerIndex, Suit } from '@dabb/shared-types';

export interface GameInterface {
  state: GameState;
  events: GameEvent[];
  /** True during the initial load / reconnect — suppresses sounds. */
  isInitialLoad: boolean;
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
