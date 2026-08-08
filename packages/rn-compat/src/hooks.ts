import { useEffect, useState } from 'react';

function getWindowSize() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
}

/**
 * Mirrors RN's useWindowDimensions. Prefers visualViewport (stable across mobile Safari's
 * toolbar show/hide) and coalesces resize bursts onto a single rAF instead of re-rendering
 * per event — mobile Safari fires resize repeatedly while the toolbar animates.
 */
export function useWindowDimensions() {
  const [size, setSize] = useState(getWindowSize);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setSize(getWindowSize()));
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  return size;
}

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ZERO_INSETS: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function readInsets(): SafeAreaInsets {
  if (typeof document === 'undefined') {
    return ZERO_INSETS;
  }
  const computed = getComputedStyle(document.documentElement);
  const read = (name: string) => parseFloat(computed.getPropertyValue(name)) || 0;
  return {
    top: read('--rn-safe-area-top'),
    right: read('--rn-safe-area-right'),
    bottom: read('--rn-safe-area-bottom'),
    left: read('--rn-safe-area-left'),
  };
}

/** Replaces react-native-safe-area-context: reads the env(safe-area-inset-*) CSS variables
 * registered on :root (see baseCss.ts) instead of relying on a React context provider. */
export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState(readInsets);

  useEffect(() => {
    const onResize = () => setInsets(readInsets());
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, []);

  return insets;
}
