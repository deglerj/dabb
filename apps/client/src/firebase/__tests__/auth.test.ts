import { describe, expect, it, vi, beforeEach } from 'vitest';

const onAuthStateChangedMock = vi.fn();
const signInAnonymouslyMock = vi.fn();

vi.mock('../config.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: onAuthStateChangedMock,
  signInAnonymously: signInAnonymouslyMock,
}));

const { ensureAuthenticated } = await import('../auth.js');

describe('ensureAuthenticated', () => {
  beforeEach(() => {
    onAuthStateChangedMock.mockReset();
    signInAnonymouslyMock.mockReset();
  });

  it('signs in anonymously and resolves when Auth becomes ready', async () => {
    const unsubscribe = vi.fn();
    onAuthStateChangedMock.mockImplementation((_auth, callback: (user: unknown) => void) => {
      queueMicrotask(() => {
        callback(null);
        callback({ uid: 'anonymous-user' });
      });
      return unsubscribe;
    });
    signInAnonymouslyMock.mockResolvedValue({ user: { uid: 'anonymous-user' } });

    await expect(ensureAuthenticated()).resolves.toMatchObject({ uid: 'anonymous-user' });
    expect(signInAnonymouslyMock).toHaveBeenCalledOnce();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
