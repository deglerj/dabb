/**
 * i18n Provider component
 */

import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { i18n, initI18n, persistLanguage } from '../config';
import type { SupportedLanguage } from '../types';

interface I18nProviderProps {
  children: ReactNode;
  /**
   * Initial language to use. If not provided, will be detected from storage or browser.
   */
  initialLanguage?: SupportedLanguage;
  /**
   * Callback when language changes
   */
  onLanguageChange?: (language: SupportedLanguage) => void;
}

/**
 * Provider component that initializes i18n and wraps the app
 */
export function I18nProvider({ children, initialLanguage, onLanguageChange }: I18nProviderProps) {
  const [isInitialized, setIsInitialized] = useState(i18n.isInitialized);

  useEffect(() => {
    if (!i18n.isInitialized) {
      initI18n(initialLanguage);
      setIsInitialized(true);
    }
  }, [initialLanguage]);

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      persistLanguage(lng as SupportedLanguage);
      onLanguageChange?.(lng as SupportedLanguage);
    };

    i18n.on('languageChanged', handleLanguageChanged);

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [onLanguageChange]);

  if (!isInitialized) {
    return null;
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
