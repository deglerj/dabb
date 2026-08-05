import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useOfflineGame } from '../../hooks/useOfflineGame.js';
import GameScreen from '../../components/ui/GameScreen.js';
import type { PlayerIndex, PlayerCount } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';

export default function OfflineGameRoute() {
  const { playerCount, difficulty, nickname, resume } = useLocalSearchParams<{
    playerCount?: string;
    difficulty?: string;
    nickname?: string;
    resume?: string;
  }>();

  const isResume = resume === 'true';

  const game = useOfflineGame({
    playerCount: (Number(playerCount) || 2) as PlayerCount,
    difficulty: (difficulty as AIDifficulty) || 'medium',
    nickname: nickname || 'Ich',
    resume: isResume,
  });

  return <GameScreen game={game} playerIndex={0 as PlayerIndex} />;
}
