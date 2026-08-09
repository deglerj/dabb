import { describe, expect, it, vi } from 'vitest';
import type { PlayerIndex } from '@dabb/shared-types';

// The module graph reaches firebase/config, which builds a real Database at import time.
vi.mock('../../firebase/config.js', () => ({ db: {} }));

const { resolveConnectedPlayers } = await import('../useFirebaseGame.js');
type AISeat = import('../useFirebaseGame.js').AISeat;

const p = (n: number) => n as PlayerIndex;

describe('resolveConnectedPlayers', () => {
  // PLAYER_LEFT and PLAYER_RECONNECTED were never emitted by anything, so the reducer's
  // `connected` flag stayed true for the whole game and the "(offline)" badge in
  // OpponentZone could not render. Presence was written to Firebase and never read back.
  it('reports a seat whose presence says disconnected (regression)', () => {
    const presence = new Map([
      [p(0), true],
      [p(1), false],
      [p(2), true],
    ]);
    const connected = resolveConnectedPlayers(presence, [], p(0));
    expect(connected.has(p(1))).toBe(false);
    expect(connected.has(p(2))).toBe(true);
  });

  it('always counts the local player as connected', () => {
    // Own presence write has not landed yet — the seat is absent from the map entirely.
    const connected = resolveConnectedPlayers(new Map(), [], p(2));
    expect(connected.has(p(2))).toBe(true);
  });

  it('does not let a stale false mark the local player offline', () => {
    const connected = resolveConnectedPlayers(new Map([[p(1), false]]), [], p(1));
    expect(connected.has(p(1))).toBe(true);
  });

  // AI seats are driven by whichever client holds the cascade claim and never write
  // presence of their own, so a missing entry must not read as disconnected.
  it('counts AI seats as connected despite having no presence entry', () => {
    const aiSeats: AISeat[] = [
      { playerIndex: p(1), difficulty: 'medium' },
      { playerIndex: p(2), difficulty: 'hard' },
    ];
    const connected = resolveConnectedPlayers(new Map(), aiSeats, p(0));
    expect(connected).toEqual(new Set([p(0), p(1), p(2)]));
  });

  it('leaves a human who has not opened the game screen marked offline', () => {
    const connected = resolveConnectedPlayers(new Map([[p(0), true]]), [], p(0));
    expect(connected.has(p(1))).toBe(false);
  });
});
