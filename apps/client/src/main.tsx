import './global.css';
import './assets/fonts/fonts.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
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
      if (gameActivity.inProgress) {
        setTimeout(tryPrompt, 30_000);
        return;
      }
      if (window.confirm('A new version of Dabb is available. Reload now?')) {
        void updateSW(true);
      }
    };
    tryPrompt();
  },
});
