import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TrumpSelector from '../TrumpSelector';
import { SUIT_NAMES } from '@dabb/shared-types';

describe('TrumpSelector', () => {
  it('renders all 4 suit buttons', () => {
    render(<TrumpSelector onSelect={vi.fn()} />);
    expect(screen.getByText(SUIT_NAMES.kreuz)).toBeInTheDocument();
    expect(screen.getByText(SUIT_NAMES.schippe)).toBeInTheDocument();
    expect(screen.getByText(SUIT_NAMES.herz)).toBeInTheDocument();
    expect(screen.getByText(SUIT_NAMES.bollen)).toBeInTheDocument();
  });

  it('calls onSelect with correct suit when pressed', () => {
    const onSelect = vi.fn();
    render(<TrumpSelector onSelect={onSelect} />);

    fireEvent.click(screen.getByText(SUIT_NAMES.herz));
    expect(onSelect).toHaveBeenCalledWith('herz');

    fireEvent.click(screen.getByText(SUIT_NAMES.kreuz));
    expect(onSelect).toHaveBeenCalledWith('kreuz');
  });

  it('title is hardcoded German instead of using i18n (bug)', () => {
    // BUG: The title "Trumpf wählen" is hardcoded in German instead of using
    // t('game.chooseTrump'). This means it won't be translated when the user
    // switches language. The component doesn't use useTranslation() at all.
    render(<TrumpSelector onSelect={vi.fn()} />);

    // The hardcoded German text exists
    expect(screen.getByText('Trumpf wählen')).toBeInTheDocument();
  });
});
