/**
 * Socket.IO event types
 */

import type { CardId, Suit } from './cards.js';
import type { GameEvent } from './events.js';
import type { Meld, PlayerIndex } from './game.js';

// Client -> Server events
export interface ClientToServerEvents {
  'game:start': () => void;
  'game:bid': (data: { amount: number }) => void;
  'game:pass': () => void;
  'game:takeDabb': () => void;
  'game:discard': (data: { cardIds: CardId[] }) => void;
  'game:goOut': (data: { suit: Suit }) => void;
  'game:declareTrump': (data: { suit: Suit }) => void;
  'game:declareMelds': (data: { melds: Meld[] }) => void;
  'game:playCard': (data: { cardId: CardId }) => void;
  'game:sync': (data: { lastEventSequence: number }) => void;
  'game:exit': () => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  'game:events': (data: { events: GameEvent[] }) => void;
  'game:state': (data: { events: GameEvent[] }) => void; // Full state sync
  'player:joined': (data: { playerIndex: PlayerIndex; nickname: string }) => void;
  'player:left': (data: { playerIndex: PlayerIndex }) => void;
  'player:reconnected': (data: { playerIndex: PlayerIndex }) => void;
  'session:terminated': (data: { message: string; terminatedBy?: string }) => void;
  error: (data: { message: string; code: string }) => void;
}

// Inter-server events (for scaling)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data (attached to socket)
export interface SocketData {
  sessionId: string;
  playerId: string;
  playerIndex: PlayerIndex;
  nickname: string;
  wasConnected: boolean;
}
