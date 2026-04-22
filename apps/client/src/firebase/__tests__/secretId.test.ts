import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

vi.mock('react-native-get-random-values', () => ({}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrCreateSecretId, hashSecretId } from '../secretId.js';

describe('secretId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates and stores a new secretId when none exists', async () => {
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    vi.mocked(AsyncStorage.setItem).mockResolvedValue(undefined);

    const id = await getOrCreateSecretId('session-abc');

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'dabb-secret-session-abc',
      expect.stringMatching(/^[0-9a-f-]{36}$/)
    );
  });

  it('returns existing secretId when already stored', async () => {
    const existing = 'existing-uuid-1234-5678-abcd';
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(existing);

    const id = await getOrCreateSecretId('session-abc');

    expect(id).toBe(existing);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('hashSecretId returns a 64-char hex string', async () => {
    const hash = await hashSecretId('test-secret-id');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('same input always produces same hash', async () => {
    const hash1 = await hashSecretId('test-secret-id');
    const hash2 = await hashSecretId('test-secret-id');
    expect(hash1).toBe(hash2);
  });

  it('different inputs produce different hashes', async () => {
    const hash1 = await hashSecretId('secret-a');
    const hash2 = await hashSecretId('secret-b');
    expect(hash1).not.toBe(hash2);
  });
});
