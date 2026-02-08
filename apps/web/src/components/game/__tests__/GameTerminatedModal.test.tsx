import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@dabb/i18n';
import GameTerminatedModal from '../GameTerminatedModal';

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider initialLanguage="de">{ui}</I18nProvider>);
};

describe('GameTerminatedModal', () => {
  it('renders the game terminated heading', () => {
    renderWithI18n(<GameTerminatedModal terminatedBy="Alice" onGoHome={vi.fn()} />);

    // German: "Spiel beendet"
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });

  it('shows who terminated the game', () => {
    renderWithI18n(<GameTerminatedModal terminatedBy="Alice" onGoHome={vi.fn()} />);

    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it('does not show termination reason when terminatedBy is null', () => {
    const { container } = renderWithI18n(
      <GameTerminatedModal terminatedBy={null} onGoHome={vi.fn()} />
    );

    // The paragraph with the player name should not be rendered
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(0);
  });

  it('calls onGoHome when the home button is clicked', () => {
    const onGoHome = vi.fn();
    renderWithI18n(<GameTerminatedModal terminatedBy="Alice" onGoHome={onGoHome} />);

    // German: "Zurück zum Menü"
    const homeButton = screen.getByRole('button');
    fireEvent.click(homeButton);
    expect(onGoHome).toHaveBeenCalledOnce();
  });

  it('renders a modal overlay', () => {
    const { container } = renderWithI18n(
      <GameTerminatedModal terminatedBy="Alice" onGoHome={vi.fn()} />
    );

    expect(container.querySelector('.modal-overlay')).toBeInTheDocument();
    expect(container.querySelector('.modal-content')).toBeInTheDocument();
  });
});
