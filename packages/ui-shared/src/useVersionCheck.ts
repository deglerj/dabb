import { useState, useEffect } from 'react';

interface UseVersionCheckOptions {
  currentVersion: string;
  serverBaseUrl: string;
}

interface UseVersionCheckResult {
  needsUpdate: boolean;
  isLoading: boolean;
  serverVersion: string | null;
}

export function useVersionCheck({
  currentVersion,
  serverBaseUrl,
}: UseVersionCheckOptions): UseVersionCheckResult {
  const [isLoading, setIsLoading] = useState(true);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [needsUpdate, setNeedsUpdate] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch(`${serverBaseUrl}/version`);
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { version: string };
        const fetchedVersion = data.version;
        setServerVersion(fetchedVersion);

        const clientMajor = parseInt(currentVersion.split('.')[0], 10);
        const serverMajor = parseInt(fetchedVersion.split('.')[0], 10);
        if (serverMajor > clientMajor) {
          setNeedsUpdate(true);
        }
      } catch {
        // Silently ignore version check failures — don't block the user
      } finally {
        setIsLoading(false);
      }
    };

    void check();
  }, [currentVersion, serverBaseUrl]);

  return { needsUpdate, isLoading, serverVersion };
}
