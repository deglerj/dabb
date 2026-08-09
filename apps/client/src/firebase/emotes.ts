import { ref, set, onValue, off } from 'firebase/database';
import { db } from './config.js';
import type { EmoteKey, EmoteSignal, PlayerIndex } from '@dabb/shared-types';

/**
 * Emote transport — one slot per seat, overwritten on every send.
 *
 * Emotes deliberately stay out of the append-only event log. They are ephemeral chatter, not
 * game state: putting them in the log would replay them on every reconnect, and would drag
 * them through the reducer, the view filter and the game log for no benefit.
 *
 * Only human emotes travel this way. AI emotes are derived on each client from the event log
 * (see useAIEmotes) and are never written here.
 */

export function sendEmote(
  sessionCode: string,
  playerIndex: PlayerIndex,
  key: EmoteKey
): Promise<void> {
  const signal: EmoteSignal = { key, at: Date.now() };
  return set(ref(db, `sessions/${sessionCode}/emotes/${playerIndex}`), signal);
}

export function subscribeToEmotes(
  sessionCode: string,
  callback: (signals: Map<PlayerIndex, EmoteSignal>) => void
): () => void {
  const emotesRef = ref(db, `sessions/${sessionCode}/emotes`);
  const handler = onValue(emotesRef, (snap) => {
    const raw = (snap.val() as Record<string, EmoteSignal> | null) ?? {};
    const map = new Map<PlayerIndex, EmoteSignal>();
    for (const [idx, signal] of Object.entries(raw)) {
      if (signal?.key) {
        map.set(Number(idx) as PlayerIndex, signal);
      }
    }
    callback(map);
  });
  return () => off(emotesRef, 'value', handler);
}
