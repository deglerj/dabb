import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const connectDatabaseEmulatorMock = vi.fn();
const getDatabaseMock = vi.fn(() => ({}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/database', () => ({
  getDatabase: getDatabaseMock,
  connectDatabaseEmulator: connectDatabaseEmulatorMock,
}));

describe('firebase config emulator connection', () => {
  const originalEnv = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;

  beforeEach(() => {
    vi.resetModules();
    connectDatabaseEmulatorMock.mockClear();
    getDatabaseMock.mockClear();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;
    } else {
      process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = originalEnv;
    }
  });

  it('does not connect to the emulator by default', async () => {
    delete process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR;
    await import('../config.js');
    expect(connectDatabaseEmulatorMock).not.toHaveBeenCalled();
  });

  it('connects to the emulator when EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true', async () => {
    process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR = 'true';
    await import('../config.js');
    expect(connectDatabaseEmulatorMock).toHaveBeenCalledWith(
      getDatabaseMock.mock.results[0]?.value,
      'localhost',
      9000
    );
  });
});
