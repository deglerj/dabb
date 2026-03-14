import { useLocalSearchParams } from 'expo-router';
import GameScreen from '../../components/ui/GameScreen.js';
import type { PlayerIndex } from '@dabb/shared-types';

export default function GameRoute() {
  const params = useLocalSearchParams();
  const sessionId = params['id'] as string | undefined;
  const secretId = params['secretId'] as string | undefined;
  const piStr = params['playerIndex'] as string | undefined;
  const playerIndex = parseInt(piStr ?? '0', 10) as PlayerIndex;

  if (!sessionId || !secretId) {
    return null;
  }

  return <GameScreen sessionId={sessionId} secretId={secretId} playerIndex={playerIndex} />;
}
