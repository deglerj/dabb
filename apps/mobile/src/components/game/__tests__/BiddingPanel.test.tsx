import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BiddingPanel from '../BiddingPanel';

describe('BiddingPanel', () => {
  it('shows waiting message when not player turn', () => {
    render(<BiddingPanel currentBid={150} isMyTurn={false} onBid={vi.fn()} onPass={vi.fn()} />);
    expect(screen.getByText('Warte auf andere Spieler...')).toBeInTheDocument();
  });

  it('shows bid controls when it is player turn', () => {
    render(<BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />);
    expect(screen.getByText('Dein Gebot')).toBeInTheDocument();
    expect(screen.getByText('Bieten')).toBeInTheDocument();
    expect(screen.getByText('Passen')).toBeInTheDocument();
  });

  it('displays current bid', () => {
    render(<BiddingPanel currentBid={200} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />);
    expect(screen.getByText('Aktuelles Gebot: 200')).toBeInTheDocument();
  });

  it('shows selected bid initialized to currentBid + 10', () => {
    render(<BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />);
    expect(screen.getByText('160')).toBeInTheDocument();
  });

  it('increment buttons increase selected bid', () => {
    render(<BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />);

    // Press +10 increment button (the one in incrementButtons, not the decrement button)
    const incrementButtons = screen.getAllByText('10');
    // There are multiple "10" texts; the increment +10 is the one inside incrementButtons
    fireEvent.click(incrementButtons[incrementButtons.length - 1]);
    expect(screen.getByText('170')).toBeInTheDocument();
  });

  it('bid button calls onBid with selected amount', () => {
    const onBid = vi.fn();
    render(<BiddingPanel currentBid={150} isMyTurn={true} onBid={onBid} onPass={vi.fn()} />);

    fireEvent.click(screen.getByText('Bieten'));
    expect(onBid).toHaveBeenCalledWith(160);
  });

  it('pass button calls onPass', () => {
    const onPass = vi.fn();
    render(<BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={onPass} />);

    fireEvent.click(screen.getByText('Passen'));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it('decrement button decreases selected bid (min: currentBid + 10)', () => {
    render(<BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />);

    // First increase by 20 to get to 180
    fireEvent.click(screen.getByText('20'));
    expect(screen.getByText('180')).toBeInTheDocument();

    // Then decrease by 10 (click the decrement button)
    // The decrement button has a minus icon and "10" text
    const allTens = screen.getAllByText('10');
    // The first "10" is the decrement button label
    fireEvent.click(allTens[0]);
    expect(screen.getByText('170')).toBeInTheDocument();
  });

  it('selectedBid does not update when currentBid prop increases (bug)', () => {
    // BUG: selectedBid is initialized with useState(currentBid + 10), which captures
    // the initial value. When currentBid increases from another player's bid,
    // selectedBid stays at the old value, potentially becoming <= currentBid.
    const { rerender } = render(
      <BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />
    );

    // Initially selectedBid should be 160
    expect(screen.getByText('160')).toBeInTheDocument();

    // Another player bids 200, so currentBid increases
    rerender(<BiddingPanel currentBid={200} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />);

    // BUG: selectedBid should now be at least 210 (currentBid + 10),
    // but it stays at 160 because useState only uses initial value
    expect(screen.getByText('160')).toBeInTheDocument();
  });
});
