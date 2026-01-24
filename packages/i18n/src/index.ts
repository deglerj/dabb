/**
 * @dabb/i18n - Internationalization package for Dabb
 */

// Components
export { I18nProvider } from './components/I18nProvider';

// Config
export {
  i18n,
  initI18n,
  persistLanguage,
  setStorageAdapter,
  getStorageAdapter,
  detectLanguageAsync,
  type StorageAdapter,
} from './config';

// Types
export {
  DEFAULT_LANGUAGE,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type TranslationKeys,
  type TranslationResource,
} from './types';

// Locales
export { de, en, resources } from './locales';

// Re-export react-i18next hooks for convenience
export { useTranslation } from 'react-i18next';
