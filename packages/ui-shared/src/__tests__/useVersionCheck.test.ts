import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVersionCheck } from '../useVersionCheck.js';

function mockFetch(response: { ok: boolean; json?: () => Promise<unknown> }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    json: response.json ?? (() => Promise.resolve({})),
  });
}

describe('useVersionCheck', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in loading state', () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, json: () => new Promise(() => {}) }));
    const { result } = renderHook(() =>
      useVersionCheck({ currentVersion: '1.0.0', serverBaseUrl: 'http://localhost' })
    );
    expect(result.current.isLoading).toBe(true);
    expect(result.current.needsUpdate).toBe(false);
    expect(result.current.serverVersion).toBeNull();
  });

  it('sets serverVersion and needsUpdate=false when versions match major', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ ok: true, json: () => Promise.resolve({ version: '1.5.0' }) })
    );
    const { result } = renderHook(() =>
      useVersionCheck({ currentVersion: '1.0.0', serverBaseUrl: 'http://localhost' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.serverVersion).toBe('1.5.0');
    expect(result.current.needsUpdate).toBe(false);
  });

  it('sets needsUpdate=true when server major version is higher', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ ok: true, json: () => Promise.resolve({ version: '2.0.0' }) })
    );
    const { result } = renderHook(() =>
      useVersionCheck({ currentVersion: '1.0.0', serverBaseUrl: 'http://localhost' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.needsUpdate).toBe(true);
    expect(result.current.serverVersion).toBe('2.0.0');
  });

  it('does not set needsUpdate when client major version is higher than server', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ ok: true, json: () => Promise.resolve({ version: '1.0.0' }) })
    );
    const { result } = renderHook(() =>
      useVersionCheck({ currentVersion: '2.0.0', serverBaseUrl: 'http://localhost' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.needsUpdate).toBe(false);
  });

  it('finishes loading without crashing when response is not ok', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false }));
    const { result } = renderHook(() =>
      useVersionCheck({ currentVersion: '1.0.0', serverBaseUrl: 'http://localhost' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.needsUpdate).toBe(false);
    expect(result.current.serverVersion).toBeNull();
  });

  it('finishes loading without crashing when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    const { result } = renderHook(() =>
      useVersionCheck({ currentVersion: '1.0.0', serverBaseUrl: 'http://localhost' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.needsUpdate).toBe(false);
    expect(result.current.serverVersion).toBeNull();
  });

  it('calls fetch with the correct URL', async () => {
    const fetchMock = mockFetch({
      ok: true,
      json: () => Promise.resolve({ version: '1.0.0' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() =>
      useVersionCheck({ currentVersion: '1.0.0', serverBaseUrl: 'https://api.example.com' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/api/version');
  });
});
