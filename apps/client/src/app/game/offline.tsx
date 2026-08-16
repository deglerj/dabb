import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOfflineGame } from '../../hooks/useOfflineGame.js';
import GameScreen from '../../components/ui/GameScreen.js';
import type { RematchState } from '../../components/game/rematch.js';
import type { PlayerIndex, PlayerCount } from '@dabb/shared-types';
import type { AIDifficulty } from '@dabb/game-ai';

interface OfflineGameProps {
  playerCount: PlayerCount;
  difficulty: AIDifficulty;
  nickname: string;
  resume: boolean;
  rematch: RematchState;
}

function OfflineGame({ playerCount, difficulty, nickname, resume, rematch }: OfflineGameProps) {
  const game = useOfflineGame({ playerCount, difficulty, nickname, resume });

  return <GameScreen game={game} playerIndex={0 as PlayerIndex} rematch={rematch} />;
}

export default function OfflineGameRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const playerCount = searchParams.get('playerCount');
  const difficulty = searchParams.get('difficulty');
  const nickname = searchParams.get('nickname');
  const isResume = searchParams.get('resume') === 'true';
  const seed = searchParams.get('seed') ?? '';

  // Offline there is nobody to ask: the bots always agree, so the button just deals again.
  const restart = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set('resume', 'false');
    params.set('seed', String(Date.now()));
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const rematch = useMemo<RematchState>(
    () => ({
      myVote: null,
      waitingFor: [],
      declinedBy: [],
      onRematch: restart,
      onDecline: () => undefined,
    }),
    [restart]
  );

  return (
    // The engine is built once per mount, so a fresh game needs a fresh mount — the seed the
    // rematch button writes is what provides it.
    <OfflineGame
      key={seed}
      playerCount={(Number(playerCount) || 3) as PlayerCount}
      difficulty={(difficulty as AIDifficulty) || 'medium'}
      nickname={nickname || 'Ich'}
      resume={isResume}
      rematch={rematch}
    />
  );
}
