import { describe, it, expect, beforeEach } from 'vitest';
import { getOrCreateSecretId, hashSecretId } from '../secretId.js';

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('secretId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and stores a new secretId when none exists', async () => {
    const id = await getOrCreateSecretId('session-abc');

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(localStorage.getItem('dabb-secret-session-abc')).toBe(id);
  });

  it('returns existing secretId when already stored', async () => {
    const existing = 'existing-uuid-1234-5678-abcd';
    localStorage.setItem('dabb-secret-session-abc', existing);

    const id = await getOrCreateSecretId('session-abc');

    expect(id).toBe(existing);
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
    const hash = await hashSecretId('test-secret-id');
    const expected = await sha256Hex('test-secret-id');
    expect(hash).toBe(expected);
  });
});
