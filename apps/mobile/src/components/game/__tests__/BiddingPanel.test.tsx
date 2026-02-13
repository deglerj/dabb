import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BiddingPanel from '../BiddingPanel';

describe('BiddingPanel', () => {
  it('shows waiting message when not player turn', () => {
    render(<BiddingPanel currentBid={150} isMyTurn={false} onBid={vi.fn()} onPass={vi.fn()} />);
    expect(screen.getByText('Warte auf andere Spieler...')).toBeInTheDocument();
  });

  it('displays current bid', () => {
    render(<BiddingPanel currentBid={200} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />);
    expect(screen.getByText('Aktuelles Gebot: 200')).toBeInTheDocument();
  });

  it('displays dash when no current bid', () => {
    const { container } = render(
      <BiddingPanel currentBid={0} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />
    );
    expect(container.textContent).toContain('-');
  });

  it('shows preset bid buttons when it is player turn', () => {
    render(<BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />);

    // getMinBid(150) = 160, so buttons: 160, 170, 180, 210
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('170')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
    expect(screen.getByText('210')).toBeInTheDocument();
  });

  it('shows correct bid options for initial bid (0)', () => {
    render(<BiddingPanel currentBid={0} isMyTurn={true} onBid={vi.fn()} onPass={vi.fn()} />);

    // getMinBid(0) = 150, so buttons: 150, 160, 170, 200
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('160')).toBeInTheDocument();
    expect(screen.getByText('170')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('calls onBid with correct amount when bid button pressed', () => {
    const onBid = vi.fn();
    render(<BiddingPanel currentBid={150} isMyTurn={true} onBid={onBid} onPass={vi.fn()} />);

    fireEvent.click(screen.getByText('160'));
    expect(onBid).toHaveBeenCalledWith(160);

    fireEvent.click(screen.getByText('210'));
    expect(onBid).toHaveBeenCalledWith(210);
  });

  it('calls onPass when pass button pressed', () => {
    const onPass = vi.fn();
    render(<BiddingPanel currentBid={150} isMyTurn={true} onBid={vi.fn()} onPass={onPass} />);

    fireEvent.click(screen.getByText('Passen'));
    expect(onPass).toHaveBeenCalledOnce();
  });

  it('does not show bid buttons when not player turn', () => {
    render(<BiddingPanel currentBid={150} isMyTurn={false} onBid={vi.fn()} onPass={vi.fn()} />);

    expect(screen.queryByText('160')).not.toBeInTheDocument();
    expect(screen.queryByText('170')).not.toBeInTheDocument();
    expect(screen.queryByText('Passen')).not.toBeInTheDocument();
  });
});
