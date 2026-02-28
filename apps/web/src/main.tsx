import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { I18nProvider } from '@dabb/i18n';

import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initDebug } from './utils/debug';
import './styles.css';

// Initialize debug utilities for browser console
initDebug();

// Load Umami analytics script dynamically (no-op when env vars are not set)
const umamiUrl = import.meta.env.VITE_UMAMI_URL as string | undefined;
const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
if (umamiUrl && umamiWebsiteId) {
  const script = document.createElement('script');
  script.defer = true;
  script.src = `${umamiUrl}/script.js`;
  script.setAttribute('data-website-id', umamiWebsiteId);
  document.head.appendChild(script);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>
);
