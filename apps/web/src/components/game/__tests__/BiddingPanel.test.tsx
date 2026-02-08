import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@dabb/i18n';
import BiddingPanel from '../BiddingPanel';

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider initialLanguage="de">{ui}</I18nProvider>);
};

describe('BiddingPanel', () => {
  it('displays the current bid', () => {
    renderWithI18n(
      <BiddingPanel currentBid={200} isMyTurn={false} onBid={vi.fn()} onPass={vi.fn()} />
    );

    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('displays dash when no current bid', () => {
    const { container } = renderWithI18n(
      <BiddingPanel currentBid={0} isMyTurn={false} onBid={vi.fn()} onPass={vi.fn()} />
    );

    expect(container.textContent).toContain('-');
  });

  it('shows bid buttons when it is my turn', () => {
    renderWithI18n(
      <BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />
    );

    // getMinBid(150) = 160, so buttons: 160, 170, 180, 210
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('170')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
    expect(screen.getByText('210')).toBeInTheDocument();
  });

  it('does not show bid buttons when not my turn', () => {
    renderWithI18n(
      <BiddingPanel currentBid={150} isMyTurn={false} onBid={vi.fn()} onPass={vi.fn()} />
    );

    expect(screen.queryByText('160')).not.toBeInTheDocument();
    expect(screen.queryByText('170')).not.toBeInTheDocument();
  });

  it('shows waiting message when not my turn', () => {
    renderWithI18n(
      <BiddingPanel currentBid={150} isMyTurn={false} onBid={vi.fn()} onPass={vi.fn()} />
    );

    // German: "Warte auf andere Spieler..."
    expect(screen.getByText(/Warte auf/)).toBeInTheDocument();
  });

  it('calls onBid with correct amount when bid button clicked', () => {
    const onBid = vi.fn();
    renderWithI18n(
      <BiddingPanel currentBid={150} isMyTurn={true} onBid={onBid} onPass={vi.fn()} />
    );

    fireEvent.click(screen.getByText('160'));
    expect(onBid).toHaveBeenCalledWith(160);

    fireEvent.click(screen.getByText('210'));
    expect(onBid).toHaveBeenCalledWith(210);
  });

  it('calls onPass when pass button is clicked', () => {
    const onPass = vi.fn();
    renderWithI18n(
      <BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={onPass} />
    );

    // Find the pass button (contains "Passen" in German)
    const passButton = screen.getByText(/Passen/);
    fireEvent.click(passButton);
    expect(onPass).toHaveBeenCalledOnce();
  });

  it('shows correct bid options for initial bid (0)', () => {
    renderWithI18n(
      <BiddingPanel currentBid={0} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />
    );

    // getMinBid(0) = 150, so buttons: 150, 160, 170, 200
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('170')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });
});
