/**
 * i18next configuration
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources } from './locales/index.js';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type SupportedLanguage } from './types.js';

const STORAGE_KEY = 'dabb-language';

/**
 * The language to start in: whatever was chosen last, else the browser's, else German.
 */
function detectLanguage(): SupportedLanguage {
  const stored = readStoredLanguage();
  if (stored !== null) {
    return stored;
  }

  const browserLang = globalThis.navigator?.language?.split('-')[0];
  if (browserLang !== undefined && SUPPORTED_LANGUAGES.includes(browserLang as SupportedLanguage)) {
    return browserLang as SupportedLanguage;
  }

  return DEFAULT_LANGUAGE;
}

function readStoredLanguage(): SupportedLanguage | null {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return stored !== null && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)
      ? (stored as SupportedLanguage)
      : null;
  } catch {
    // Storage can throw when cookies are blocked — fall back to detection.
    return null;
  }
}

/**
 * Persist language choice to storage
 */
export function persistLanguage(language: SupportedLanguage): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Initialize i18next instance. Returns a Promise that resolves when i18n is
 * fully initialized and the `t()` function is ready to use.
 */
export function initI18n(initialLanguage?: SupportedLanguage): Promise<typeof i18n> {
  const language = initialLanguage ?? detectLanguage();

  return i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: {
        escapeValue: false, // React already escapes values
      },
      react: {
        useSuspense: false,
      },
    })
    .then(() => i18n);
}

export { i18n };
