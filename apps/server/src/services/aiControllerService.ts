/**
 * AI Controller Service
 *
 * Manages AI players in game sessions:
 * - Registers/unregisters AI players
 * - Triggers AI decisions when it's their turn
 * - Executes AI actions through game service
 */

import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  GameEvent,
  InterServerEvents,
  PlayerIndex,
  ServerToClientEvents,
  SocketData,
} from '@dabb/shared-types';
import { filterEventsForPlayer } from '@dabb/game-logic';

import { defaultAIPlayerFactory, type AIPlayer } from '../ai/index.js';
import { sessionSockets } from '../socket/handlers.js';
import {
  declareMelds,
  declareTrump,
  discardCards,
  getGameState,
  goOut,
  passBid,
  placeBid,
  playCard,
  takeDabb,
} from './gameService.js';
import { getSessionPlayers } from './sessionService.js';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Map of sessionId -> Map of playerIndex -> AIPlayer instance
const aiPlayers = new Map<string, Map<PlayerIndex, AIPlayer>>();

// Pending AI actions (to prevent duplicate triggers)
const pendingAIActions = new Set<string>();

/**
 * Register an AI player for a session
 */
export function registerAIPlayer(sessionId: string, playerIndex: PlayerIndex): void {
  if (!aiPlayers.has(sessionId)) {
    aiPlayers.set(sessionId, new Map());
  }

  const sessionAIs = aiPlayers.get(sessionId)!;
  if (!sessionAIs.has(playerIndex)) {
    const ai = defaultAIPlayerFactory.create();
    sessionAIs.set(playerIndex, ai);
  }
}

/**
 * Unregister an AI player from a session
 */
export function unregisterAIPlayer(sessionId: string, playerIndex: PlayerIndex): void {
  const sessionAIs = aiPlayers.get(sessionId);
  if (sessionAIs) {
    sessionAIs.delete(playerIndex);
    if (sessionAIs.size === 0) {
      aiPlayers.delete(sessionId);
    }
  }
}

/**
 * Cleanup all AI players for a session
 */
export function cleanupSession(sessionId: string): void {
  aiPlayers.delete(sessionId);
  // Clean up any pending actions for this session
  for (const key of pendingAIActions) {
    if (key.startsWith(`${sessionId}:`)) {
      pendingAIActions.delete(key);
    }
  }
}

/**
 * Check if a player is an AI
 */
export function isAIPlayer(sessionId: string, playerIndex: PlayerIndex): boolean {
  const sessionAIs = aiPlayers.get(sessionId);
  return sessionAIs?.has(playerIndex) ?? false;
}

/**
 * Broadcast events to all connected sockets in a session
 */
function broadcastEvents(_io: GameServer, sessionId: string, events: GameEvent[]): void {
  const sockets = sessionSockets.get(sessionId);
  if (!sockets) {
    return;
  }

  for (const socket of sockets) {
    const filteredEvents = filterEventsForPlayer(events, socket.data.playerIndex);
    socket.emit('game:events', { events: filteredEvents });
  }
}

/**
 * Check if it's an AI's turn and trigger their decision
 * Called after each game event to check if AI needs to act
 * @param afterTrickWon - if true, adds extra delay to allow clients to display the completed trick
 */
export async function checkAndTriggerAI(
  sessionId: string,
  io: GameServer,
  afterTrickWon: boolean = false
): Promise<void> {
  const sessionAIs = aiPlayers.get(sessionId);
  if (!sessionAIs || sessionAIs.size === 0) {
    return;
  }

  try {
    const state = await getGameState(sessionId);

    // Determine which player needs to act based on phase
    let activePlayer: PlayerIndex | null = null;

    switch (state.phase) {
      case 'bidding':
        activePlayer = state.currentBidder;
        break;
      case 'dabb':
      case 'trump':
        activePlayer = state.bidWinner;
        break;
      case 'melding':
        // Find first player who hasn't declared melds yet
        for (let i = 0; i < state.playerCount; i++) {
          const idx = i as PlayerIndex;
          if (!state.declaredMelds.has(idx)) {
            // Skip bid winner if they went out
            if (state.wentOut && idx === state.bidWinner) {
              continue;
            }
            activePlayer = idx;
            break;
          }
        }
        break;
      case 'tricks':
        activePlayer = state.currentPlayer;
        break;
      default:
        // No action needed in other phases
        return;
    }

    if (activePlayer === null || !sessionAIs.has(activePlayer)) {
      return;
    }

    // Check if we already have a pending action for this player
    const actionKey = `${sessionId}:${activePlayer}:${state.phase}`;
    if (pendingAIActions.has(actionKey)) {
      return;
    }

    pendingAIActions.add(actionKey);

    // Schedule AI action with a small delay for more natural feel
    // After a trick is won, add extra delay so clients can display the completed trick
    const delay = afterTrickWon
      ? 3000 + 500 + Math.random() * 500 // 3500-4000ms (trick display pause + normal delay)
      : 500 + Math.random() * 500; // 500-1000ms
    setTimeout(async () => {
      try {
        await executeAIAction(sessionId, activePlayer!, io);
      } finally {
        pendingAIActions.delete(actionKey);
      }
    }, delay);
  } catch (error) {
    console.error('Error in checkAndTriggerAI:', error);
  }
}

/**
 * Execute an AI player's action
 */
async function executeAIAction(
  sessionId: string,
  playerIndex: PlayerIndex,
  io: GameServer
): Promise<void> {
  const sessionAIs = aiPlayers.get(sessionId);
  const ai = sessionAIs?.get(playerIndex);
  if (!ai) {
    return;
  }

  try {
    const state = await getGameState(sessionId);

    // Call AI to get decision
    const action = await ai.decide({
      gameState: state,
      playerIndex,
      sessionId,
    });

    // Execute the action through game service
    let events: GameEvent[] = [];

    switch (action.type) {
      case 'bid':
        events = await placeBid(sessionId, playerIndex, action.amount);
        break;
      case 'pass':
        events = await passBid(sessionId, playerIndex);
        break;
      case 'takeDabb':
        events = await takeDabb(sessionId, playerIndex);
        break;
      case 'discard':
        events = await discardCards(sessionId, playerIndex, action.cardIds);
        break;
      case 'goOut':
        events = await goOut(sessionId, playerIndex, action.suit);
        break;
      case 'declareTrump':
        events = await declareTrump(sessionId, playerIndex, action.suit);
        break;
      case 'declareMelds':
        events = await declareMelds(sessionId, playerIndex, action.melds);
        break;
      case 'playCard':
        events = await playCard(sessionId, playerIndex, action.cardId);
        break;
    }

    // Broadcast events to all players
    broadcastEvents(io, sessionId, events);

    // Clear pending action before recursive check so the same player
    // can act again in the same phase (e.g. takeDabb then discard)
    pendingAIActions.delete(`${sessionId}:${playerIndex}:${state.phase}`);

    // Check if another AI needs to act
    // If a trick was just won, delay the next AI action to allow clients to display the trick
    const trickWasWon = events.some((e) => e.type === 'TRICK_WON');
    await checkAndTriggerAI(sessionId, io, trickWasWon);
  } catch (error) {
    console.error(`AI action failed for player ${playerIndex} in session ${sessionId}:`, error);
    // AI failed to act - log and continue (next trigger will retry)
  }
}

/**
 * Initialize AI players for a session based on player data
 */
export async function initializeAIPlayersFromSession(sessionId: string): Promise<void> {
  const players = await getSessionPlayers(sessionId);
  for (const player of players) {
    if (player.isAI) {
      registerAIPlayer(sessionId, player.playerIndex);
    }
  }
}
