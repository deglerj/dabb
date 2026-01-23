import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use default values when optional env vars are not set', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    // NODE_ENV defaults to 'test' when running in vitest
    process.env.NODE_ENV = 'development';

    const { env } = await import('../config/env.js');

    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.CLIENT_URL).toBe('http://localhost:5173');
    expect(env.RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(env.RATE_LIMIT_MAX_REQUESTS).toBe(100);
  });

  it('should use custom values when env vars are set', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    process.env.PORT = '4000';
    process.env.NODE_ENV = 'production';
    process.env.CLIENT_URL = 'https://example.com';

    const { env } = await import('../config/env.js');

    expect(env.PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('production');
    expect(env.CLIENT_URL).toBe('https://example.com');
  });
});
