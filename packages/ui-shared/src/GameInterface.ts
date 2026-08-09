/**
 * GameInterface — unified contract for online and offline game hooks.
 * Both useGame and useOfflineGame implement this interface.
 * GameScreen accepts it as a prop, unaware of transport layer.
 */
import type { CardId, GameEvent, GameState, PlayerIndex, Suit } from '@dabb/shared-types';

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
   * When a remote player terminates an online game this holds their nickname.
   * Always null offline.
   */
  terminatedByNickname: string | null;
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
