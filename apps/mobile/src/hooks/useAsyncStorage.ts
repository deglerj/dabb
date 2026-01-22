/**
 * AsyncStorage hooks for React Native
 */

import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SessionCredentials {
  secretId: string;
  sessionId: string;
  nickname: string;
}

const CREDENTIALS_KEY = 'dabb_session_credentials';

export function useSessionCredentials() {
  const [credentials, setCredentialsState] = useState<SessionCredentials | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const stored = await AsyncStorage.getItem(CREDENTIALS_KEY);
      if (stored) {
        setCredentialsState(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const setCredentials = useCallback(async (newCredentials: SessionCredentials | null) => {
    try {
      if (newCredentials) {
        await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(newCredentials));
      } else {
        await AsyncStorage.removeItem(CREDENTIALS_KEY);
      }
      setCredentialsState(newCredentials);
    } catch (error) {
      console.error('Failed to save credentials:', error);
    }
  }, []);

  const clearCredentials = useCallback(async () => {
    await setCredentials(null);
  }, [setCredentials]);

  return { credentials, setCredentials, clearCredentials, loading };
}
