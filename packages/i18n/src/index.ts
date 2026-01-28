/**
 * @dabb/i18n - Internationalization package for Dabb
 */

// Components
export { I18nProvider } from './components/I18nProvider.js';

// Config
export {
  i18n,
  initI18n,
  persistLanguage,
  setStorageAdapter,
  getStorageAdapter,
  detectLanguageAsync,
  type StorageAdapter,
} from './config.js';

// Types
export {
  DEFAULT_LANGUAGE,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type TranslationKeys,
  type TranslationResource,
} from './types.js';

// Locales
export { de, en, resources } from './locales/index.js';

// Re-export react-i18next hooks for convenience
export { useTranslation } from 'react-i18next';
