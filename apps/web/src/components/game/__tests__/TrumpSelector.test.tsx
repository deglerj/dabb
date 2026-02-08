import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@dabb/i18n';
import TrumpSelector from '../TrumpSelector';

// Mock SuitIcon
vi.mock('../../SuitIcon', () => ({
  default: ({ suit, size }: { suit: string; size: number }) => (
    <span data-testid={`suit-icon-${suit}`} data-size={size}>
      {suit}
    </span>
  ),
}));

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider initialLanguage="de">{ui}</I18nProvider>);
};

describe('TrumpSelector', () => {
  it('renders all four suit buttons', () => {
    renderWithI18n(<TrumpSelector onSelect={vi.fn()} />);

    expect(screen.getByText('Kreuz')).toBeInTheDocument();
    expect(screen.getByText('Schippe')).toBeInTheDocument();
    expect(screen.getByText('Herz')).toBeInTheDocument();
    expect(screen.getByText('Bollen')).toBeInTheDocument();
  });

  it('renders suit icons for all suits', () => {
    renderWithI18n(<TrumpSelector onSelect={vi.fn()} />);

    expect(screen.getByTestId('suit-icon-kreuz')).toBeInTheDocument();
    expect(screen.getByTestId('suit-icon-schippe')).toBeInTheDocument();
    expect(screen.getByTestId('suit-icon-herz')).toBeInTheDocument();
    expect(screen.getByTestId('suit-icon-bollen')).toBeInTheDocument();
  });

  it('calls onSelect with kreuz when Kreuz button is clicked', () => {
    const onSelect = vi.fn();
    renderWithI18n(<TrumpSelector onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Kreuz'));
    expect(onSelect).toHaveBeenCalledWith('kreuz');
  });

  it('calls onSelect with schippe when Schippe button is clicked', () => {
    const onSelect = vi.fn();
    renderWithI18n(<TrumpSelector onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Schippe'));
    expect(onSelect).toHaveBeenCalledWith('schippe');
  });

  it('calls onSelect with herz when Herz button is clicked', () => {
    const onSelect = vi.fn();
    renderWithI18n(<TrumpSelector onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Herz'));
    expect(onSelect).toHaveBeenCalledWith('herz');
  });

  it('calls onSelect with bollen when Bollen button is clicked', () => {
    const onSelect = vi.fn();
    renderWithI18n(<TrumpSelector onSelect={onSelect} />);

    fireEvent.click(screen.getByText('Bollen'));
    expect(onSelect).toHaveBeenCalledWith('bollen');
  });

  it('renders a heading for choosing trump', () => {
    renderWithI18n(<TrumpSelector onSelect={vi.fn()} />);

    // German: "Trumpf wählen"
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
});
