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
