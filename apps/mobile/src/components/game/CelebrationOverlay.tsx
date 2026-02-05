/**
 * Celebration overlay component for React Native
 * Shows confetti for round wins, fireworks for game wins
 */

import React from 'react';
import type { GameEvent, PlayerIndex } from '@dabb/shared-types';
import { useCelebration } from '@dabb/ui-shared';

import Confetti from './Confetti';
import Fireworks from './Fireworks';

interface CelebrationOverlayProps {
  events: GameEvent[];
  playerIndex: PlayerIndex | null;
}

function CelebrationOverlay({ events, playerIndex }: CelebrationOverlayProps) {
  const { showConfetti, showFireworks } = useCelebration(events, playerIndex);

  if (!showConfetti && !showFireworks) {
    return null;
  }

  return (
    <>
      {showConfetti && <Confetti />}
      {showFireworks && <Fireworks />}
    </>
  );
}

export default CelebrationOverlay;
