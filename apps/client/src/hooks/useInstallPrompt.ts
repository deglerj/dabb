/**
 * Captures the browser's `beforeinstallprompt` event so a custom UI element
 * can trigger the PWA install flow. Only Chromium browsers fire that event,
 * so for the rest (Safari, Firefox Android) this also detects the platform
 * to show manual instructions instead. Firefox desktop has no install
 * feature at all, so it gets neither path.
 */
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallInstructionsPlatform = 'ios-safari' | 'macos-safari' | 'android-firefox';

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectInstructionsPlatform(): InstallInstructionsPlatform | null {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) {
    return 'ios-safari';
  }
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium/.test(ua)) {
    return 'macos-safari';
  }
  if (/Firefox/.test(ua) && /Android/.test(ua)) {
    return 'android-firefox';
  }
  return null;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const onInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) {
      return;
    }
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const instructionsPlatform = installed ? null : detectInstructionsPlatform();

  return {
    canInstall: !installed && deferredPrompt !== null,
    promptInstall,
    instructionsPlatform,
  };
}
