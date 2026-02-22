import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { createServer, type Server as HttpServer } from 'http';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'net';
import type { PlayerIndex, Suit } from '@dabb/shared-types';
import { GameError, SERVER_ERROR_CODES } from '@dabb/shared-types';

import { setupSocketHandlers } from '../socket/handlers.js';

// Mock services
vi.mock('../services/sessionService.js', () => ({
  getPlayerBySecretId: vi.fn(),
  getSessionByCode: vi.fn(),
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

vi.mock('../services/aiControllerService.js', () => ({
  checkAndTriggerAI: vi.fn().mockResolvedValue(undefined),
  cleanupSession: vi.fn(),
  initializeAIPlayersFromSession: vi.fn().mockResolvedValue(undefined),
}));

import {
  checkAndTriggerAI,
  initializeAIPlayersFromSession,
} from '../services/aiControllerService.js';

import {
  getPlayerBySecretId,
  getSessionByCode,
  updatePlayerConnection,
} from '../services/sessionService.js';
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
const mockedGetSessionByCode = vi.mocked(getSessionByCode);
const mockedUpdatePlayerConnection = vi.mocked(updatePlayerConnection);
const mockedGetEvents = vi.mocked(getEvents);
const mockedCheckAndTriggerAI = vi.mocked(checkAndTriggerAI);
const mockedInitializeAIPlayersFromSession = vi.mocked(initializeAIPlayersFromSession);
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

  const mockSessionId = 'test-session-uuid-123'; // UUID in database
  const mockSessionCode = 'test-session-123'; // Code passed from frontend
  const mockPlayerId = 'player-1';
  const mockSecretId = 'secret-123';
  const mockPlayerIndex = 0 as PlayerIndex;

  const mockSession = {
    id: mockSessionId,
    code: mockSessionCode,
    playerCount: 4 as const,
    status: 'waiting' as const,
    targetScore: 1000,
    createdAt: new Date(),
  };

  const mockPlayer = {
    id: mockPlayerId,
    sessionId: mockSessionId, // UUID matching mockSession.id
    secretId: mockSecretId,
    nickname: 'TestPlayer',
    playerIndex: mockPlayerIndex,
    team: 0 as const,
    connected: false,
    isAI: false,
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

      const client = createClient({ secretId: 'invalid', sessionId: mockSessionCode });

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
        sessionId: 'different-session-uuid', // Player belongs to different session
      });
      mockedGetSessionByCode.mockResolvedValue(mockSession); // Session exists

      const client = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });

      await expect(
        new Promise((_, reject) => {
          client.on('connect_error', reject);
        })
      ).rejects.toThrow('Invalid credentials');

      client.disconnect();
    });

    it('rejects connection with non-existent session code', async () => {
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer);
      mockedGetSessionByCode.mockResolvedValue(null); // Session doesn't exist

      const client = createClient({ secretId: mockSecretId, sessionId: 'non-existent-code' });

      await expect(
        new Promise((_, reject) => {
          client.on('connect_error', reject);
        })
      ).rejects.toThrow('Invalid credentials');

      client.disconnect();
    });

    it('accepts valid authentication', async () => {
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer);
      mockedGetSessionByCode.mockResolvedValue(mockSession);
      mockedGetEvents.mockRejectedValue(new Error('No game'));
      mockedUpdatePlayerConnection.mockResolvedValue();

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      expect(clientSocket.connected).toBe(true);
      expect(mockedUpdatePlayerConnection).toHaveBeenCalledWith(mockPlayerId, true);
    });

    // Regression test: Frontend passes session CODE (e.g., "schnell-fuchs-42") but
    // player.sessionId in DB is the session UUID. Previously this comparison failed
    // because we compared code !== UUID directly. Now we look up session by code
    // and compare UUIDs correctly.
    it('authenticates when session code differs from session UUID (regression)', async () => {
      // Simulate real scenario: code and UUID are different strings
      const realSessionUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const realSessionCode = 'schnell-fuchs-42';

      const playerWithUuid = {
        ...mockPlayer,
        sessionId: realSessionUuid, // Player stores UUID reference
      };
      const sessionWithCode = {
        ...mockSession,
        id: realSessionUuid,
        code: realSessionCode,
      };

      mockedGetPlayerBySecretId.mockResolvedValue(playerWithUuid);
      mockedGetSessionByCode.mockResolvedValue(sessionWithCode);
      mockedGetEvents.mockRejectedValue(new Error('No game'));
      mockedUpdatePlayerConnection.mockResolvedValue();

      // Frontend connects using CODE from URL, not UUID
      clientSocket = createClient({ secretId: mockSecretId, sessionId: realSessionCode });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      expect(clientSocket.connected).toBe(true);
      expect(mockedGetSessionByCode).toHaveBeenCalledWith(realSessionCode);
    });
  });

  describe('Connection Events', () => {
    beforeEach(() => {
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer);
      mockedGetSessionByCode.mockResolvedValue(mockSession);
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

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });

      const state = await new Promise<{ events: typeof mockEvents }>((resolve) => {
        clientSocket.on('game:state', resolve);
      });

      expect(state.events).toEqual(mockEvents);
    });

    it('notifies other players when a new player joins', async () => {
      mockedGetEvents.mockRejectedValue(new Error('No game'));

      // Connect first client
      const client1 = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });
      await new Promise<void>((resolve) => {
        client1.on('connect', resolve);
      });

      // Setup second player (new player, not previously connected)
      const mockPlayer2 = {
        ...mockPlayer,
        id: 'player-2',
        playerIndex: 1 as PlayerIndex,
        nickname: 'Player2',
        connected: false,
      };
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer2);

      // Listener for join event
      const joinPromise = new Promise<{ playerIndex: number; nickname: string }>((resolve) => {
        client1.on('player:joined', resolve);
      });

      // Connect second client
      const client2 = createClient({ secretId: 'secret-456', sessionId: mockSessionCode });
      await new Promise<void>((resolve) => {
        client2.on('connect', resolve);
      });

      const event = await joinPromise;
      expect(event.playerIndex).toBe(1);
      expect(event.nickname).toBe('Player2');

      client1.disconnect();
      client2.disconnect();
    });

    it('notifies other players when someone reconnects', async () => {
      mockedGetEvents.mockRejectedValue(new Error('No game'));

      // Connect first client
      const client1 = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });
      await new Promise<void>((resolve) => {
        client1.on('connect', resolve);
      });

      // Setup second player (previously connected, now reconnecting)
      const mockPlayer2 = {
        ...mockPlayer,
        id: 'player-2',
        playerIndex: 1 as PlayerIndex,
        connected: true,
      };
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer2);

      // Listener for reconnect event
      const reconnectPromise = new Promise<{ playerIndex: number }>((resolve) => {
        client1.on('player:reconnected', resolve);
      });

      // Connect second client
      const client2 = createClient({ secretId: 'secret-456', sessionId: mockSessionCode });
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
      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });

      // Setup second player and connect
      const mockPlayer2 = { ...mockPlayer, id: 'player-2', playerIndex: 1 as PlayerIndex };
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer2);

      const client2 = createClient({ secretId: 'secret-456', sessionId: mockSessionCode });
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
      mockedGetSessionByCode.mockResolvedValue(mockSession);
      mockedGetEvents.mockRejectedValue(new Error('No game'));
      mockedUpdatePlayerConnection.mockResolvedValue();

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });
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
        mockedStartGame.mockRejectedValue(
          new GameError(SERVER_ERROR_CODES.NOT_ENOUGH_PLAYERS, { required: 4 })
        );

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:start');

        const error = await errorPromise;
        expect(error.message).toBe(SERVER_ERROR_CODES.NOT_ENOUGH_PLAYERS);
        expect(error.code).toBe(SERVER_ERROR_CODES.NOT_ENOUGH_PLAYERS);
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
        mockedPlaceBid.mockRejectedValue(new GameError(SERVER_ERROR_CODES.INVALID_BID_AMOUNT));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:bid', { amount: 100 });

        const error = await errorPromise;
        expect(error.message).toBe(SERVER_ERROR_CODES.INVALID_BID_AMOUNT);
        expect(error.code).toBe(SERVER_ERROR_CODES.INVALID_BID_AMOUNT);
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
        mockedPassBid.mockRejectedValue(new GameError(SERVER_ERROR_CODES.NOT_YOUR_TURN));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:pass');

        const error = await errorPromise;
        expect(error.message).toBe(SERVER_ERROR_CODES.NOT_YOUR_TURN);
        expect(error.code).toBe(SERVER_ERROR_CODES.NOT_YOUR_TURN);
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
        mockedTakeDabb.mockRejectedValue(
          new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_TAKE_DABB)
        );

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:takeDabb');

        const error = await errorPromise;
        expect(error.message).toBe(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_TAKE_DABB);
        expect(error.code).toBe(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_TAKE_DABB);
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
        mockedDiscardCards.mockRejectedValue(new GameError(SERVER_ERROR_CODES.CARD_NOT_IN_HAND));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:discard', { cardIds: ['invalid'] });

        const error = await errorPromise;
        expect(error.message).toBe(SERVER_ERROR_CODES.CARD_NOT_IN_HAND);
        expect(error.code).toBe(SERVER_ERROR_CODES.CARD_NOT_IN_HAND);
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
        mockedDeclareTrump.mockRejectedValue(
          new GameError(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_DECLARE_TRUMP)
        );

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:declareTrump', { suit: 'herz' });

        const error = await errorPromise;
        expect(error.message).toBe(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_DECLARE_TRUMP);
        expect(error.code).toBe(SERVER_ERROR_CODES.ONLY_BID_WINNER_CAN_DECLARE_TRUMP);
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
        mockedDeclareMelds.mockRejectedValue(
          new GameError(SERVER_ERROR_CODES.ALREADY_DECLARED_MELDS)
        );

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:declareMelds', { melds: [] });

        const error = await errorPromise;
        expect(error.message).toBe(SERVER_ERROR_CODES.ALREADY_DECLARED_MELDS);
        expect(error.code).toBe(SERVER_ERROR_CODES.ALREADY_DECLARED_MELDS);
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
        mockedPlayCard.mockRejectedValue(new GameError(SERVER_ERROR_CODES.INVALID_PLAY));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:playCard', { cardId: 'invalid' });

        const error = await errorPromise;
        expect(error.message).toBe(SERVER_ERROR_CODES.INVALID_PLAY);
        expect(error.code).toBe(SERVER_ERROR_CODES.INVALID_PLAY);
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
        // Sync failures from non-GameError exceptions get UNKNOWN_ERROR
        mockedGetEvents.mockRejectedValue(new Error('Database error'));

        const errorPromise = new Promise<{ message: string; code: string }>((resolve) => {
          clientSocket.on('error', resolve);
        });

        clientSocket.emit('game:sync', { lastEventSequence: 0 });

        const error = await errorPromise;
        expect(error.message).toBe(SERVER_ERROR_CODES.UNKNOWN_ERROR);
        expect(error.code).toBe(SERVER_ERROR_CODES.UNKNOWN_ERROR);
      });
    });
  });

  // Regression: After a server restart, AI player instances (stored only in-memory) are
  // lost. Previously, initializeAIPlayersFromSession was only called on game:start, so
  // reconnecting to an active game left AI players unregistered — they would silently
  // stop acting because checkAndTriggerAI returned early when the in-memory Map was empty.
  describe('AI player restoration on reconnect to active game (regression)', () => {
    beforeEach(() => {
      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer);
      mockedGetSessionByCode.mockResolvedValue(mockSession);
      mockedUpdatePlayerConnection.mockResolvedValue();
    });

    it('re-initializes AI players and triggers AI turn check when connecting to an active game', async () => {
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

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });

      // Wait for game:state, then allow server-side async steps to complete
      await new Promise<void>((resolve) => {
        clientSocket.on('game:state', () => setTimeout(resolve, 50));
      });

      expect(mockedInitializeAIPlayersFromSession).toHaveBeenCalledWith(mockSessionId);
      expect(mockedCheckAndTriggerAI).toHaveBeenCalledWith(mockSessionId, expect.anything());
    });

    it('does not call AI initialization when no active game exists yet', async () => {
      mockedGetEvents.mockRejectedValue(new Error('Game not started'));

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', () => setTimeout(resolve, 50));
      });

      expect(mockedInitializeAIPlayersFromSession).not.toHaveBeenCalled();
      expect(mockedCheckAndTriggerAI).not.toHaveBeenCalled();
    });
  });

  describe('Event Filtering', () => {
    it('filters events per player using filterEventsForPlayer', async () => {
      const { filterEventsForPlayer } = await import('@dabb/game-logic');
      const mockedFilter = vi.mocked(filterEventsForPlayer);

      mockedGetPlayerBySecretId.mockResolvedValue(mockPlayer);
      mockedGetSessionByCode.mockResolvedValue(mockSession);
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

      clientSocket = createClient({ secretId: mockSecretId, sessionId: mockSessionCode });

      await new Promise<void>((resolve) => {
        clientSocket.on('game:state', resolve);
      });

      expect(mockedFilter).toHaveBeenCalledWith(mockEvents, mockPlayerIndex);
    });
  });
});
