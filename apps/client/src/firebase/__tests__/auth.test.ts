import { describe, expect, it, vi, beforeEach } from 'vitest';

const onAuthStateChangedMock = vi.fn();
const signInAnonymouslyMock = vi.fn();

vi.mock('../config.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: onAuthStateChangedMock,
  signInAnonymously: signInAnonymouslyMock,
}));

let ensureAuthenticated: typeof import('../auth.js').ensureAuthenticated;

describe('ensureAuthenticated', () => {
  beforeEach(async () => {
    vi.resetModules();
    onAuthStateChangedMock.mockReset();
    signInAnonymouslyMock.mockReset();
    ({ ensureAuthenticated } = await import('../auth.js'));
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

  it('rejects bootstrap failures and retries after the failure is cleared', async () => {
    const firstUnsubscribe = vi.fn();
    onAuthStateChangedMock.mockImplementationOnce((_auth, callback: (user: unknown) => void) => {
      queueMicrotask(() => callback(null));
      return firstUnsubscribe;
    });
    signInAnonymouslyMock.mockRejectedValueOnce(new Error('Auth unavailable'));

    await expect(ensureAuthenticated()).rejects.toThrow('Auth unavailable');
    expect(firstUnsubscribe).toHaveBeenCalledOnce();

    const secondUnsubscribe = vi.fn();
    onAuthStateChangedMock.mockImplementationOnce((_auth, callback: (user: unknown) => void) => {
      queueMicrotask(() => callback({ uid: 'anonymous-user' }));
      return secondUnsubscribe;
    });

    await expect(ensureAuthenticated()).resolves.toMatchObject({ uid: 'anonymous-user' });
    expect(onAuthStateChangedMock).toHaveBeenCalledTimes(2);
  });
});
