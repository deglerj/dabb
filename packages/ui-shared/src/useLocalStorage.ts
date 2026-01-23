/**
 * Local storage hook for persisting session credentials
 */

import { useState, useCallback, useEffect } from 'react';

interface SessionCredentials {
  secretId: string;
  playerId: string;
  playerIndex: number;
  sessionId?: string;
}

export function useSessionCredentials(sessionCode: string) {
  const storageKey = `dabb-${sessionCode}`;

  const [credentials, setCredentials] = useState<SessionCredentials | null>(() => {
    if (typeof window === 'undefined') {return null;}
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : null;
  });

  const saveCredentials = useCallback((creds: SessionCredentials) => {
    localStorage.setItem(storageKey, JSON.stringify(creds));
    setCredentials(creds);
  }, [storageKey]);

  const clearCredentials = useCallback(() => {
    localStorage.removeItem(storageKey);
    setCredentials(null);
  }, [storageKey]);

  // Sync with localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setCredentials(JSON.parse(stored));
    }
  }, [storageKey]);

  return {
    credentials,
    saveCredentials,
    clearCredentials,
    hasCredentials: credentials !== null,
  };
}
