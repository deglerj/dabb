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
  beforeEach(() => {
    vi.resetModules();
    connectDatabaseEmulatorMock.mockClear();
    getDatabaseMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not connect to the emulator by default', async () => {
    vi.stubEnv('EXPO_PUBLIC_USE_FIREBASE_EMULATOR', undefined);
    await import('../config.js');
    expect(connectDatabaseEmulatorMock).not.toHaveBeenCalled();
  });

  it('connects to the emulator when EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true', async () => {
    vi.stubEnv('EXPO_PUBLIC_USE_FIREBASE_EMULATOR', 'true');
    await import('../config.js');
    expect(connectDatabaseEmulatorMock).toHaveBeenCalledWith(
      getDatabaseMock.mock.results[0]?.value,
      'localhost',
      9000
    );
  });
});
