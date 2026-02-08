import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@dabb/i18n';
import LanguageSwitcher from '../LanguageSwitcher';

const renderWithI18n = (ui: React.ReactElement, lang: 'de' | 'en' = 'de') => {
  return render(<I18nProvider initialLanguage={lang}>{ui}</I18nProvider>);
};

describe('LanguageSwitcher', () => {
  it('renders a select element', () => {
    renderWithI18n(<LanguageSwitcher />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders language options', () => {
    renderWithI18n(<LanguageSwitcher />);

    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThanOrEqual(2);

    // Check that Deutsch and English are options
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain('Deutsch');
    expect(optionTexts).toContain('English');
  });

  it('has the current language selected', () => {
    renderWithI18n(<LanguageSwitcher />, 'de');

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('de');
  });

  it('changes language when a new option is selected', () => {
    renderWithI18n(<LanguageSwitcher />, 'de');

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'en' } });
    expect(select.value).toBe('en');
  });
});
