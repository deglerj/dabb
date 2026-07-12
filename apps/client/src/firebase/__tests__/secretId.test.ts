import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

vi.mock('react-native-get-random-values', () => ({}));

// Reference SHA-256 implementation for the mock and the regression test
// below — jsdom's Web Crypto API (crypto.subtle), already DOM-typed, no
// extra dependency needed. This is deliberately the exact API the old,
// broken hashSecretId used directly (crypto.subtle.digest), which doesn't
// exist on Hermes/React Native — only in browsers and Node/jsdom. Using it
// here purely as a test oracle is fine; production code no longer touches it.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// expo-crypto is a native module with no JS-only implementation, so it must
// be mocked in tests (same reasoning as react-native-get-random-values
// above). Mocked with a real SHA-256 implementation rather than a stub, so
// the hashing-correctness assertions below stay meaningful.
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn((_algorithm: string, data: string) => sha256Hex(data)),
}));

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

  it('matches the known SHA-256 digest of its input (regression)', async () => {
    // Locks in actual hashing correctness against a reference implementation,
    // not just internal consistency — this is the exact property that broke
    // in production on native Android/iOS when hashSecretId used
    // crypto.subtle.digest directly, which doesn't exist on Hermes/React
    // Native (only in browsers and Node/jsdom). The unit test environment
    // (jsdom) has crypto.subtle natively, so it never caught the gap;
    // expo-crypto is mocked above specifically so this suite exercises the
    // same code path real devices do.
    const hash = await hashSecretId('test-secret-id');
    const expected = await sha256Hex('test-secret-id');
    expect(hash).toBe(expected);
  });
});
