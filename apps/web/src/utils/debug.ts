/**
 * Debug utilities for exporting game state from the browser console
 */

import type { GameEvent, GameState, PlayerIndex } from '@dabb/shared-types';
import { formatEventLog } from '@dabb/game-logic';
import type { PlayerInfo } from '@dabb/game-logic';

interface DebugStore {
  events: GameEvent[];
  state: GameState | null;
  sessionCode: string | null;
  playerIndex: PlayerIndex | null;
}

const store: DebugStore = {
  events: [],
  state: null,
  sessionCode: null,
  playerIndex: null,
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
    exportLog: exportGameLog,
    copyLog: copyGameLog,
    downloadLog: downloadGameLog,
    printLog: printGameLog,
    getEvents: () => store.events,
    getState: () => store.state,
  };

  console.log(
    '%c🎴 Dabb Debug Commands Available',
    'font-size: 14px; font-weight: bold; color: #4a9eff'
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
