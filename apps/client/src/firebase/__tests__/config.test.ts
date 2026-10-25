import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const connectDatabaseEmulatorMock = vi.fn();
const connectAuthEmulatorMock = vi.fn();
const getDatabaseMock = vi.fn(() => ({}));
const getAuthMock = vi.fn(() => ({}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}));

vi.mock('firebase/database', () => ({
  getDatabase: getDatabaseMock,
  connectDatabaseEmulator: connectDatabaseEmulatorMock,
}));

vi.mock('firebase/auth', () => ({
  getAuth: getAuthMock,
  connectAuthEmulator: connectAuthEmulatorMock,
}));

describe('firebase config emulator connection', () => {
  beforeEach(() => {
    vi.resetModules();
    connectDatabaseEmulatorMock.mockClear();
    connectAuthEmulatorMock.mockClear();
    getDatabaseMock.mockClear();
    getAuthMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not connect to the emulator by default', async () => {
    vi.stubEnv('EXPO_PUBLIC_USE_FIREBASE_EMULATOR', undefined);
    await import('../config.js');
    expect(connectDatabaseEmulatorMock).not.toHaveBeenCalled();
    expect(connectAuthEmulatorMock).not.toHaveBeenCalled();
  });

  it('connects to the emulator when EXPO_PUBLIC_USE_FIREBASE_EMULATOR=true', async () => {
    vi.stubEnv('EXPO_PUBLIC_USE_FIREBASE_EMULATOR', 'true');
    await import('../config.js');
    expect(connectDatabaseEmulatorMock).toHaveBeenCalledWith(
      getDatabaseMock.mock.results[0]?.value,
      'localhost',
      9000
    );
    expect(connectAuthEmulatorMock).toHaveBeenCalledWith(
      getAuthMock.mock.results[0]?.value,
      'http://localhost:9099',
      { disableWarnings: true }
    );
  });
});
