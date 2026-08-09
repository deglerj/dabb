import { useSearchParams } from 'react-router-dom';
import { useOfflineGame } from '../../hooks/useOfflineGame.js';
import GameScreen from '../../components/ui/GameScreen.js';
import type { PlayerIndex, PlayerCount } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';

export default function OfflineGameRoute() {
  const [searchParams] = useSearchParams();
  const playerCount = searchParams.get('playerCount');
  const difficulty = searchParams.get('difficulty');
  const nickname = searchParams.get('nickname');
  const isResume = searchParams.get('resume') === 'true';

  const game = useOfflineGame({
    playerCount: (Number(playerCount) || 3) as PlayerCount,
    difficulty: (difficulty as AIDifficulty) || 'medium',
    nickname: nickname || 'Ich',
    resume: isResume,
  });

  return <GameScreen game={game} playerIndex={0 as PlayerIndex} />;
}
