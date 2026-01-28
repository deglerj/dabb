/**
 * i18next configuration
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources } from './locales/index.js';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from './types.js';

const STORAGE_KEY = 'dabb-language';

/**
 * Storage adapter interface for cross-platform support
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}

/**
 * Default web storage adapter using localStorage
 */
const webStorageAdapter: StorageAdapter = {
  getItem: (key: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
};

let storageAdapter: StorageAdapter = webStorageAdapter;

/**
 * Set custom storage adapter (e.g., AsyncStorage for React Native)
 */
export function setStorageAdapter(adapter: StorageAdapter): void {
  storageAdapter = adapter;
}

/**
 * Get the storage adapter
 */
export function getStorageAdapter(): StorageAdapter {
  return storageAdapter;
}

/**
 * Detect language from storage or browser settings (sync)
 */
function detectLanguageSync(): SupportedLanguage {
  // Check localStorage (works in web)
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      return stored as SupportedLanguage;
    }
  }

  // Check browser language
  if (typeof navigator !== 'undefined' && navigator.language) {
    const browserLang = navigator.language.split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(browserLang as SupportedLanguage)) {
      return browserLang as SupportedLanguage;
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Detect language from storage or browser settings (async, for mobile)
 */
export async function detectLanguageAsync(): Promise<SupportedLanguage> {
  try {
    const stored = await storageAdapter.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) {
      return stored as SupportedLanguage;
    }
  } catch {
    // Ignore storage errors
  }

  // Check browser language if available
  if (typeof navigator !== 'undefined' && navigator.language) {
    const browserLang = navigator.language.split('-')[0];
    if (SUPPORTED_LANGUAGES.includes(browserLang as SupportedLanguage)) {
      return browserLang as SupportedLanguage;
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * Persist language choice to storage
 */
export function persistLanguage(language: SupportedLanguage): void {
  try {
    storageAdapter.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Initialize i18next instance
 */
export function initI18n(initialLanguage?: SupportedLanguage): typeof i18n {
  const language = initialLanguage ?? detectLanguageSync();

  i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  });

  return i18n;
}

export { i18n };
