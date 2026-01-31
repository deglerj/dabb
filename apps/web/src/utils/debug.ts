/**
 * Debug utilities for exporting game state from the browser console
 *
 * ANTI-CHEAT: Using any debug command will terminate the current game
 * to prevent cheating through console access.
 */

import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import { formatEventLog } from '@dabb/game-logic';
import type { PlayerInfo } from '@dabb/game-logic';

interface DebugStore {
  events: GameEvent[];
  state: GameState | null;
  sessionCode: string | null;
  playerIndex: PlayerIndex | null;
  onTerminate: (() => void) | null;
}

const store: DebugStore = {
  events: [],
  state: null,
  sessionCode: null,
  playerIndex: null,
  onTerminate: null,
};

/**
 * Update the debug store with current game data
 */
export function updateDebugStore(
  events: GameEvent[],
  state: GameState,
  sessionCode: string,
  playerIndex: PlayerIndex
): void {
  store.events = events;
  store.state = state;
  store.sessionCode = sessionCode;
  store.playerIndex = playerIndex;
}

/**
 * Set the callback to terminate the game (anti-cheat)
 */
export function setTerminateCallback(callback: (() => void) | null): void {
  store.onTerminate = callback;
}

/**
 * Terminate the game and log a warning
 */
function terminateGameOnAccess(): void {
  if (store.onTerminate) {
    console.warn(
      '%c⚠️ ANTI-CHEAT: Game terminated due to console access',
      'font-size: 14px; font-weight: bold; color: #ff4444'
    );
    store.onTerminate();
    store.onTerminate = null; // Only terminate once
  }
}

/**
 * Wrap a function to terminate the game before executing
 */
function withTermination<T extends (...args: unknown[]) => unknown>(fn: T): T {
  return ((...args: unknown[]) => {
    terminateGameOnAccess();
    return fn(...args);
  }) as T;
}

/**
 * Export the current game event log as formatted text
 */
function exportGameLog(): string {
  if (store.events.length === 0) {
    return 'No game events to export. Join a game first.';
  }

  // Extract player info from state
  const players: PlayerInfo[] =
    store.state?.players.map((p) => ({
      playerIndex: p.playerIndex,
      nickname: p.nickname,
      team: p.team,
    })) ?? [];

  return formatEventLog(store.events, {
    sessionCode: store.sessionCode ?? undefined,
    players,
  });
}

/**
 * Copy game log to clipboard
 */
async function copyGameLog(): Promise<void> {
  const log = exportGameLog();
  await navigator.clipboard.writeText(log);
  console.log('Game log copied to clipboard!');
}

/**
 * Download game log as a text file
 */
function downloadGameLog(): void {
  const log = exportGameLog();
  const blob = new Blob([log], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dabb-game-log-${store.sessionCode ?? 'unknown'}-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('Game log downloaded!');
}

/**
 * Print game log to console
 */
function printGameLog(): void {
  const log = exportGameLog();
  console.log(log);
}

// Expose debug functions on window
declare global {
  interface Window {
    dabb: {
      exportLog: () => string;
      copyLog: () => Promise<void>;
      downloadLog: () => void;
      printLog: () => void;
      getEvents: () => GameEvent[];
      getState: () => GameState | null;
    };
  }
}

/**
 * Initialize debug utilities on window object
 */
export function initDebug(): void {
  window.dabb = {
    exportLog: withTermination(exportGameLog),
    copyLog: withTermination(copyGameLog),
    downloadLog: withTermination(downloadGameLog),
    printLog: withTermination(printGameLog),
    getEvents: withTermination(() => store.events),
    getState: withTermination(() => store.state),
  };

  console.log(
    '%c🎴 Dabb Debug Commands Available',
    'font-size: 14px; font-weight: bold; color: #4a9eff'
  );
  console.warn(
    '%c⚠️ WARNING: Using any of these commands will terminate your current game!',
    'font-size: 12px; font-weight: bold; color: #ff4444'
  );
  console.log(
    '%c  dabb.printLog()    - Print game event log to console\n' +
      '  dabb.copyLog()     - Copy game log to clipboard\n' +
      '  dabb.downloadLog() - Download game log as file\n' +
      '  dabb.exportLog()   - Get game log as string\n' +
      '  dabb.getEvents()   - Get raw event array\n' +
      '  dabb.getState()    - Get current game state',
    'color: #888'
  );
}
