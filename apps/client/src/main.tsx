import './global.css';
import './assets/fonts/fonts.css';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { i18n } from '@dabb/i18n';
import App from './App.js';
import { gameActivity } from './gameActivity.js';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}
createRoot(container).render(<App />);

// registerType:'prompt' — never auto-reloads. Defer the prompt while a game is in progress,
// since skipWaiting mid-game would destroy the live session.
const updateSW = registerSW({
  onNeedRefresh() {
    const tryPrompt = () => {
      // i18n is initialized by I18nProvider in an effect, so it may not be ready yet.
      if (gameActivity.inProgress || !i18n.isInitialized) {
        setTimeout(tryPrompt, 30_000);
        return;
      }
      if (window.confirm(i18n.t('common.updateAvailable'))) {
        void updateSW(true);
      }
    };
    tryPrompt();
  },
});
