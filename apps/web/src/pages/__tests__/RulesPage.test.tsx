import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider, initI18n, i18n } from '@dabb/i18n';
import RulesPage from '../RulesPage';

// Ensure i18n is initialized for this test suite
initI18n('de');

const renderRulesPage = () => {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <RulesPage />
      </I18nProvider>
    </MemoryRouter>
  );
};

describe('RulesPage', () => {
  afterEach(() => {
    cleanup();
    i18n.changeLanguage('de');
  });

  it('renders the page title in German', () => {
    renderRulesPage();
    expect(screen.getByText('Spielregeln')).toBeInTheDocument();
  });

  it('renders German rules content', () => {
    renderRulesPage();
    expect(screen.getByText('Binokel Regeln')).toBeInTheDocument();
    expect(screen.getByText(/Kreuz, Schippe, Herz, Bollen/)).toBeInTheDocument();
  });

  it('renders key rule sections in German', () => {
    renderRulesPage();
    expect(screen.getByText('Reizen')).toBeInTheDocument();
    expect(screen.getByText('Melden')).toBeInTheDocument();
    expect(screen.getByText('Stiche')).toBeInTheDocument();
    expect(screen.getByText('Wertung')).toBeInTheDocument();
  });

  it('renders English rules when language is English', () => {
    i18n.changeLanguage('en');
    renderRulesPage();
    expect(screen.getByText('Game Rules')).toBeInTheDocument();
    expect(screen.getByText('Binokel Rules')).toBeInTheDocument();
    expect(screen.getByText(/Kreuz \(clubs\), Schippe \(spades\)/)).toBeInTheDocument();
  });

  it('renders a back button', () => {
    renderRulesPage();
    expect(screen.getByText('Zurück')).toBeInTheDocument();
  });
});
