import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { createServer, type Server as HttpServer } from 'http';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'net';
import type { PlayerIndex, Suit } from '@dabb/shared-types';

import { setupSocketHandlers } from '../socket/handlers.js';

// Mock services
vi.mock('../services/sessionService.js', () => ({
  getPlayerBySecretId: vi.fn(),
  updatePlayerConnection: vi.fn(),
}));

vi.mock('../services/eventService.js', () => ({
  getEvents: vi.fn(),
}));

vi.mock('../services/gameService.js', () => ({
  startGame: vi.fn(),
  placeBid: vi.fn(),
  passBid: vi.fn(),
  takeDabb: vi.fn(),
  discardCards: vi.fn(),
  declareTrump: vi.fn(),
  declareMelds: vi.fn(),
  playCard: vi.fn(),
}));

vi.mock('../utils/logger.js', () => ({
  socketLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@dabb/game-logic', () => ({
  filterEventsForPlayer: vi.fn((events: unknown[]) => events),
}));

import { getPlayerBySecretId, updatePlayerConnection } from '../services/sessionService.js';
import { getEvents } from '../services/eventService.js';
import {
  startGame,
  placeBid,
  passBid,
  takeDabb,
  discardCards,
  declareTrump,
  declareMelds,
  playCard,
} from '../services/gameService.js';

const mockedGetPlayerBySecretId = vi.mocked(getPlayerBySecretId);
const mockedUpdatePlayerConnection = vi.mocked(updatePlayerConnection);
const mockedGetEvents = vi.mocked(getEvents);
const mockedStartGame = vi.mocked(startGame);
const mockedPlaceBid = vi.mocked(placeBid);
const mockedPassBid = vi.mocked(passBid);
const mockedTakeDabb = vi.mocked(takeDabb);
const mockedDiscardCards = vi.mocked(discardCards);
const mockedDeclareTrump = vi.mocked(declareTrump);
const mockedDeclareMelds = vi.mocked(declareMelds);
const mockedPlayCard = vi.mocked(playCard);

describe('Socket Handlers Integration', () => {
  let httpServer: HttpServer;
  let ioServer: Server;
  let clientSocket: ClientSocket;
  let serverUrl: string;

  const mockSessionId = 'test-session-123';
  const mockPlayerId = 'player-1';
  const mockSecretId = 'secret-123';
  const mockPlayerIndex = 0 as PlayerIndex;

  const mockPlayer = {
    id: mockPlayerId,
    sessionId: mockSessionId,
    secretId: mockSecretId,
    nickname: 'TestPlayer',
    playerIndex: mockPlayerIndex,
    team: 0 as const,
    connected: false,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create HTTP server
    httpServer = createServer();

    // Create Socket.IO server
    ioServer = new Server(httpServer, {
      cors: { origin: '*' },
    });

    // Setup handlers
    setupSocketHandlers(ioServer);

    // Start server and get port
    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        const address = httpServer.address() as AddressInfo;
        serverUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Disconnect client if connected
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }

    // Close server
    await new Promise<void>((resolve) => {
      ioServer.close(() => {
        httpServer.close(() => resolve());
      });
    });
  });

  function createClient(auth: { secretId: string; sessionId: string }): ClientSocket {
    return ioc(serverUrl, {
      auth,
      transports: ['websocket'],
      forceNew: true,
    });
  }

  describe('Authentication Middleware', () => {
    it('rejects connection without authentication', async () => {
      const client = ioc(serverUrl, {
        transports: ['websocket'],
        forceNew: true,
      });

      await expect(
        new Promise((_, reject) => {
          client.on('connect_error', reject);
        })
      ).rejects.toThrow('Missing authentication');

      client.disconnect();
    });

    it('rejects connection with invalid secretId', async () => {
      mockedGetPlayerBySecretId.mockResolvedValue(null);

      const client = createClient({ secretId: 'invalid', sessionId: mockSessionId });

      await expect(
        new Promise((_, reject) => {
          client.on('connect_error', reject);
        })
      ).rejects.toThrow('Invalid credentials');

      client.disconnect();
    });

    it('rejects connection with mismatched sessionId', async () => {
      mockedGetPlayerBySecretId.mockResolvedValue({
        ...mockPlayer,
        sessionId: 'different-session',
      });

      const client = createClient({ secretId: mockSecretId, sessionId: mockSessionId });

      await expect(
        new Promise((_, reject) => {
          client.on('connect_error', reject);
        })
      ).rejects.toThrow('Invalid credentials');

      client.disconnect();
    });

    it('accepts valid authentication', async () => {
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer);
      mockedGetEvents.mockRejectedValue(new Error('No game'));
      mockedUpdatePlayerConnection.mockResolvedValue();

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionId });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      expect(clientSocket.connected).toBe(true);
      expect(mockedUpdatePlayerConnection).toHaveBeenCalledWith(mockPlayerId, true);
    });
  });

  describe('Connection Events', () => {
    beforeEach(() => {
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer);
      mockedUpdatePlayerConnection.mockResolvedValue();
    });

    it('sends game state on connection if game exists', async () => {
      const mockEvents = [
        {
          id: 'e1',
          type: 'GAME_STARTED',
          sessionId: mockSessionId,
          sequence: 1,
          payload: {},
          timestamp: Date.now(),
        },
      ];
      mockedGetEvents.mockResolvedValue(mockEvents as never);

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionId });

      const state = await new Promise<{ events: typeof mockEvents }>((resolve) => {
        clientSocket.on('game:state', resolve);
      });

      expect(state.events).toEqual(mockEvents);
    });

    it('notifies other players when someone connects', async () => {
      mockedGetEvents.mockRejectedValue(new Error('No game'));

      // Connect first client
      const client1 = createClient({ secretId: mockSecretId, sessionId: mockSessionId });
      await new Promise<void>((resolve) => {
        client1.on('connect', resolve);
      });

      // Setup second player
      const mockPlayer2 = { ...mockPlayer, id: 'player-2', playerIndex: 1 as PlayerIndex };
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer2);

      // Listener for reconnect event
      const reconnectPromise = new Promise<{ playerIndex: number }>((resolve) => {
        client1.on('player:reconnected', resolve);
      });

      // Connect second client
      const client2 = createClient({ secretId: 'secret-456', sessionId: mockSessionId });
      await new Promise<void>((resolve) => {
        client2.on('connect', resolve);
      });

      const event = await reconnectPromise;
      expect(event.playerIndex).toBe(1);

      client1.disconnect();
      client2.disconnect();
    });

    it('handles disconnect and notifies others', async () => {
      mockedGetEvents.mockRejectedValue(new Error('No game'));

      // Connect first client
      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionId });
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      // Setup second player and connect
      const mockPlayer2 = { ...mockPlayer, id: 'player-2', playerIndex: 1 as PlayerIndex };
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer2);

      const client2 = createClient({ secretId: 'secret-456', sessionId: mockSessionId });
      await new Promise<void>((resolve) => {
        client2.on('connect', resolve);
      });

      // Listen for leave event on first client
      const leftPromise = new Promise<{ playerIndex: number }>((resolve) => {
        clientSocket.on('player:left', resolve);
      });

      // Disconnect second client
      client2.disconnect();

      const event = await leftPromise;
      expect(event.playerIndex).toBe(1);
      expect(mockedUpdatePlayerConnection).toHaveBeenCalledWith('player-2', false);
    });
  });

  describe('Game Event Handlers', () => {
    beforeEach(async () => {
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer);
      mockedGetEvents.mockRejectedValue(new Error('No game'));
      mockedUpdatePlayerConnection.mockResolvedValue();

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionId });
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });
    });

    describe('game:start', () => {
      it('starts game and broadcasts events', async () => {
        const mockEvents = [
          {
            id: 'e1',
            type: 'GAME_STARTED',
            sessionId: mockSessionId,
            sequence: 1,
            payload: {},
            timestamp: Date.now(),
          },
        ];
        mockedStartGame.mockResolvedValue(mockEvents as never);

        const eventsPromise = new Promise<{ events: typeof mockEvents }>((resolve) => {
          clientSocket.on('game:events', resolve);
        });

        clientSocket.emit('game:start');

        const result = await eventsPromise;
        expect(result.events).toEqual(mockEvents);
        expect(mockedStartGame).toHaveBeenCalledWith(mockSessionId);
      });

      it('emits error on failure', async () => {
        mockedStartGame.mockRejectedValue(new Error('Not enough players'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:start');

        const error = await errorPromise;
        expect(error.message).toBe('Not enough players');
        expect(error.code).toBe('START_FAILED');
      });
    });

    describe('game:bid', () => {
      it('places bid and broadcasts events', async () => {
        const mockEvents = [
          {
            id: 'e1',
            type: 'BID_PLACED',
            sessionId: mockSessionId,
            sequence: 1,
            payload: { playerIndex: 0, amount: 160 },
            timestamp: Date.now(),
          },
        ];
        mockedPlaceBid.mockResolvedValue(mockEvents as never);

        const eventsPromise = new Promise<{ events: typeof mockEvents }>((resolve) => {
          clientSocket.on('game:events', resolve);
        });

        clientSocket.emit('game:bid', { amount: 160 });

        const result = await eventsPromise;
        expect(result.events).toEqual(mockEvents);
        expect(mockedPlaceBid).toHaveBeenCalledWith(mockSessionId, mockPlayerIndex, 160);
      });

      it('emits error on invalid bid', async () => {
        mockedPlaceBid.mockRejectedValue(new Error('Invalid bid amount'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:bid', { amount: 100 });

        const error = await errorPromise;
        expect(error.message).toBe('Invalid bid amount');
        expect(error.code).toBe('BID_FAILED');
      });
    });

    describe('game:pass', () => {
      it('passes bid and broadcasts events', async () => {
        const mockEvents = [
          {
            id: 'e1',
            type: 'PLAYER_PASSED',
            sessionId: mockSessionId,
            sequence: 1,
            payload: {},
            timestamp: Date.now(),
          },
        ];
        mockedPassBid.mockResolvedValue(mockEvents as never);

        const eventsPromise = new Promise<{ events: typeof mockEvents }>((resolve) => {
          clientSocket.on('game:events', resolve);
        });

        clientSocket.emit('game:pass');

        const result = await eventsPromise;
        expect(result.events).toEqual(mockEvents);
        expect(mockedPassBid).toHaveBeenCalledWith(mockSessionId, mockPlayerIndex);
      });

      it('emits error on failure', async () => {
        mockedPassBid.mockRejectedValue(new Error('Not your turn'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:pass');

        const error = await errorPromise;
        expect(error.message).toBe('Not your turn');
        expect(error.code).toBe('PASS_FAILED');
      });
    });

    describe('game:takeDabb', () => {
      it('takes dabb and broadcasts events', async () => {
        const mockEvents = [
          {
            id: 'e1',
            type: 'DABB_TAKEN',
            sessionId: mockSessionId,
            sequence: 1,
            payload: {},
            timestamp: Date.now(),
          },
        ];
        mockedTakeDabb.mockResolvedValue(mockEvents as never);

        const eventsPromise = new Promise<{ events: typeof mockEvents }>((resolve) => {
          clientSocket.on('game:events', resolve);
        });

        clientSocket.emit('game:takeDabb');

        const result = await eventsPromise;
        expect(result.events).toEqual(mockEvents);
        expect(mockedTakeDabb).toHaveBeenCalledWith(mockSessionId, mockPlayerIndex);
      });

      it('emits error on failure', async () => {
        mockedTakeDabb.mockRejectedValue(new Error('Only bid winner can take dabb'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:takeDabb');

        const error = await errorPromise;
        expect(error.message).toBe('Only bid winner can take dabb');
        expect(error.code).toBe('DABB_FAILED');
      });
    });

    describe('game:discard', () => {
      it('discards cards and broadcasts events', async () => {
        const cardIds = ['card-1', 'card-2', 'card-3', 'card-4'];
        const mockEvents = [
          {
            id: 'e1',
            type: 'CARDS_DISCARDED',
            sessionId: mockSessionId,
            sequence: 1,
            payload: { cardIds },
            timestamp: Date.now(),
          },
        ];
        mockedDiscardCards.mockResolvedValue(mockEvents as never);

        const eventsPromise = new Promise<{ events: typeof mockEvents }>((resolve) => {
          clientSocket.on('game:events', resolve);
        });

        clientSocket.emit('game:discard', { cardIds });

        const result = await eventsPromise;
        expect(result.events).toEqual(mockEvents);
        expect(mockedDiscardCards).toHaveBeenCalledWith(mockSessionId, mockPlayerIndex, cardIds);
      });

      it('emits error on failure', async () => {
        mockedDiscardCards.mockRejectedValue(new Error('Card not in hand'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:discard', { cardIds: ['invalid'] });

        const error = await errorPromise;
        expect(error.message).toBe('Card not in hand');
        expect(error.code).toBe('DISCARD_FAILED');
      });
    });

    describe('game:declareTrump', () => {
      it('declares trump and broadcasts events', async () => {
        const suit: Suit = 'herz';
        const mockEvents = [
          {
            id: 'e1',
            type: 'TRUMP_DECLARED',
            sessionId: mockSessionId,
            sequence: 1,
            payload: { suit },
            timestamp: Date.now(),
          },
        ];
        mockedDeclareTrump.mockResolvedValue(mockEvents as never);

        const eventsPromise = new Promise<{ events: typeof mockEvents }>((resolve) => {
          clientSocket.on('game:events', resolve);
        });

        clientSocket.emit('game:declareTrump', { suit });

        const result = await eventsPromise;
        expect(result.events).toEqual(mockEvents);
        expect(mockedDeclareTrump).toHaveBeenCalledWith(mockSessionId, mockPlayerIndex, suit);
      });

      it('emits error on failure', async () => {
        mockedDeclareTrump.mockRejectedValue(new Error('Only bid winner can declare trump'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:declareTrump', { suit: 'herz' });

        const error = await errorPromise;
        expect(error.message).toBe('Only bid winner can declare trump');
        expect(error.code).toBe('TRUMP_FAILED');
      });
    });

    describe('game:declareMelds', () => {
      it('declares melds and broadcasts events', async () => {
        const melds = [{ type: 'Paar', suit: 'herz', cardIds: ['c1', 'c2'] }];
        const mockEvents = [
          {
            id: 'e1',
            type: 'MELDS_DECLARED',
            sessionId: mockSessionId,
            sequence: 1,
            payload: { melds },
            timestamp: Date.now(),
          },
        ];
        mockedDeclareMelds.mockResolvedValue(mockEvents as never);

        const eventsPromise = new Promise<{ events: typeof mockEvents }>((resolve) => {
          clientSocket.on('game:events', resolve);
        });

        clientSocket.emit('game:declareMelds', { melds });

        const result = await eventsPromise;
        expect(result.events).toEqual(mockEvents);
        expect(mockedDeclareMelds).toHaveBeenCalledWith(mockSessionId, mockPlayerIndex, melds);
      });

      it('emits error on failure', async () => {
        mockedDeclareMelds.mockRejectedValue(new Error('Already declared melds'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:declareMelds', { melds: [] });

        const error = await errorPromise;
        expect(error.message).toBe('Already declared melds');
        expect(error.code).toBe('MELDS_FAILED');
      });
    });

    describe('game:playCard', () => {
      it('plays card and broadcasts events', async () => {
        const cardId = 'card-1';
        const mockEvents = [
          {
            id: 'e1',
            type: 'CARD_PLAYED',
            sessionId: mockSessionId,
            sequence: 1,
            payload: { cardId },
            timestamp: Date.now(),
          },
        ];
        mockedPlayCard.mockResolvedValue(mockEvents as never);

        const eventsPromise = new Promise<{ events: typeof mockEvents }>((resolve) => {
          clientSocket.on('game:events', resolve);
        });

        clientSocket.emit('game:playCard', { cardId });

        const result = await eventsPromise;
        expect(result.events).toEqual(mockEvents);
        expect(mockedPlayCard).toHaveBeenCalledWith(mockSessionId, mockPlayerIndex, cardId);
      });

      it('emits error on invalid play', async () => {
        mockedPlayCard.mockRejectedValue(new Error('Invalid play'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:playCard', { cardId: 'invalid' });

        const error = await errorPromise;
        expect(error.message).toBe('Invalid play');
        expect(error.code).toBe('PLAY_FAILED');
      });
    });

    describe('game:sync', () => {
      it('syncs game state from sequence', async () => {
        const mockEvents = [
          {
            id: 'e2',
            type: 'BID_PLACED',
            sessionId: mockSessionId,
            sequence: 2,
            payload: {},
            timestamp: Date.now(),
          },
        ];
        mockedGetEvents.mockResolvedValue(mockEvents as never);

        const eventsPromise = new Promise<{ events: typeof mockEvents }>((resolve) => {
          clientSocket.on('game:events', resolve);
        });

        clientSocket.emit('game:sync', { lastEventSequence: 1 });

        const result = await eventsPromise;
        expect(result.events).toEqual(mockEvents);
        expect(mockedGetEvents).toHaveBeenCalledWith(mockSessionId, 1);
      });

      it('emits error on sync failure', async () => {
        mockedGetEvents.mockRejectedValue(new Error('Database error'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:sync', { lastEventSequence: 0 });

        const error = await errorPromise;
        expect(error.message).toBe('Database error');
        expect(error.code).toBe('SYNC_FAILED');
      });
    });
  });

  describe('Event Filtering', () => {
    it('filters events per player using filterEventsForPlayer', async () => {
      const { filterEventsForPlayer } = await import('@dabb/game-logic');
      const mockedFilter = vi.mocked(filterEventsForPlayer);

      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer);
      mockedUpdatePlayerConnection.mockResolvedValue();

      const mockEvents = [
        {
          id: 'e1',
          type: 'CARDS_DEALT',
          sessionId: mockSessionId,
          sequence: 1,
          payload: {},
          timestamp: Date.now(),
        },
      ];
      mockedGetEvents.mockResolvedValue(mockEvents as never);

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionId });

      await new Promise<void>((resolve) => {
        clientSocket.on('game:state', resolve);
      });

      expect(mockedFilter).toHaveBeenCalledWith(mockEvents, mockPlayerIndex);
    });
  });
});
