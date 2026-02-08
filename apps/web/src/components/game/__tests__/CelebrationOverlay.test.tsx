import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { PlayerIndex } from '@dabb/shared-types';
import CelebrationOverlay from '../CelebrationOverlay';

// Mock useCelebration
vi.mock('@dabb/ui-shared', () => ({
  useCelebration: vi.fn(),
}));

// Mock Confetti and Fireworks
vi.mock('../Confetti', () => ({
  default: () => <div data-testid="confetti">Confetti</div>,
}));

vi.mock('../Fireworks', () => ({
  default: () => <div data-testid="fireworks">Fireworks</div>,
}));

import { useCelebration } from '@dabb/ui-shared';
const mockUseCelebration = vi.mocked(useCelebration);

describe('CelebrationOverlay', () => {
  it('renders nothing when no celebration is active', () => {
    mockUseCelebration.mockReturnValue({ showConfetti: false, showFireworks: false });

    const { container } = render(<CelebrationOverlay events={[]} playerIndex={0 as PlayerIndex} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders confetti when showConfetti is true', () => {
    mockUseCelebration.mockReturnValue({ showConfetti: true, showFireworks: false });

    const { getByTestId, queryByTestId } = render(
      <CelebrationOverlay events={[]} playerIndex={0 as PlayerIndex} />
    );

    expect(getByTestId('confetti')).toBeInTheDocument();
    expect(queryByTestId('fireworks')).not.toBeInTheDocument();
  });

  it('renders fireworks when showFireworks is true', () => {
    mockUseCelebration.mockReturnValue({ showConfetti: false, showFireworks: true });

    const { getByTestId, queryByTestId } = render(
      <CelebrationOverlay events={[]} playerIndex={0 as PlayerIndex} />
    );

    expect(getByTestId('fireworks')).toBeInTheDocument();
    expect(queryByTestId('confetti')).not.toBeInTheDocument();
  });

  it('renders both confetti and fireworks when both are active', () => {
    mockUseCelebration.mockReturnValue({ showConfetti: true, showFireworks: true });

    const { getByTestId } = render(
      <CelebrationOverlay events={[]} playerIndex={0 as PlayerIndex} />
    );

    expect(getByTestId('confetti')).toBeInTheDocument();
    expect(getByTestId('fireworks')).toBeInTheDocument();
  });

  it('renders nothing when playerIndex is null', () => {
    mockUseCelebration.mockReturnValue({ showConfetti: false, showFireworks: false });

    const { container } = render(<CelebrationOverlay events={[]} playerIndex={null} />);

    expect(container.innerHTML).toBe('');
  });
});
