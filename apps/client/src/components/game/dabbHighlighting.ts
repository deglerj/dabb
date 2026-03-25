import type { GamePhase } from '@dabb/shared-types';

export function computeHighlightedDabbIds(phase: GamePhase, dabbCardIds: string[]): Set<string> {
  const active =
    (phase === 'dabb' || phase === 'trump' || phase === 'melding') && dabbCardIds.length > 0;
  return active ? new Set(dabbCardIds) : new Set<string>();
}
