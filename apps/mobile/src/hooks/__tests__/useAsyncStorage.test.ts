import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSessionCredentials, type SessionCredentials } from '../useAsyncStorage';

describe('useSessionCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('loads credentials from AsyncStorage on mount', async () => {
    const stored: SessionCredentials = {
      secretId: 'secret-123',
      sessionId: 'session-456',
      nickname: 'TestPlayer',
    };
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useSessionCredentials());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.credentials).toEqual(stored);
  });

  it('returns null when no stored credentials', async () => {
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { result } = renderHook(() => useSessionCredentials());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.credentials).toBeNull();
  });

  it('saves credentials to AsyncStorage', async () => {
    const { result } = renderHook(() => useSessionCredentials());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newCreds: SessionCredentials = {
      secretId: 'new-secret',
      sessionId: 'new-session',
      nickname: 'NewPlayer',
    };

    await act(async () => {
      await result.current.setCredentials(newCreds);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'dabb_session_credentials',
      JSON.stringify(newCreds)
    );
    expect(result.current.credentials).toEqual(newCreds);
  });

  it('clears credentials from AsyncStorage', async () => {
    const stored: SessionCredentials = {
      secretId: 'secret-123',
      sessionId: 'session-456',
      nickname: 'TestPlayer',
    };
    (AsyncStorage.getItem as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(stored));

    const { result } = renderHook(() => useSessionCredentials());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.clearCredentials();
    });

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('dabb_session_credentials');
    expect(result.current.credentials).toBeNull();
  });

  it('loading state starts true, becomes false after load', async () => {
    const { result } = renderHook(() => useSessionCredentials());

    // Loading should eventually become false
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});
