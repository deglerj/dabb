import { describe, it, expect, vi } from 'vitest';

vi.mock('../config.js', () => ({ db: {} }));
vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  onValue: vi.fn(),
  off: vi.fn(),
  onDisconnect: vi.fn(),
}));

const { LOBBY_TTL_MS, toFreshEntries, toStaleCodes } = await import('../lobby.js');

const NOW = 1_700_000_000_000;

function entry(createdAt: number) {
  return { host: 'Hans', playerCount: 3 as const, taken: 1, createdAt };
}

describe('lobby TTL', () => {
  it('keeps entries younger than the TTL, newest first', () => {
    const fresh = toFreshEntries(
      { old: entry(NOW - LOBBY_TTL_MS + 1000), young: entry(NOW - 1000) },
      NOW
    );
    expect(fresh.map((e) => e.code)).toEqual(['young', 'old']);
  });

  it('drops entries the TTL has expired', () => {
    const raw = { stale: entry(NOW - LOBBY_TTL_MS - 1), live: entry(NOW - 1000) };
    expect(toFreshEntries(raw, NOW).map((e) => e.code)).toEqual(['live']);
    expect(toStaleCodes(raw, NOW)).toEqual(['stale']);
  });

  it('treats an empty lobby as empty rather than throwing', () => {
    expect(toFreshEntries(null, NOW)).toEqual([]);
    expect(toStaleCodes(null, NOW)).toEqual([]);
  });
});
