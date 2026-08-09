/**
 * Emotes — the fixed set of reactions a player can send instead of chatting.
 *
 * Deliberately tiny and closed: there is no free-text channel in this game, and a short
 * curated list is what keeps it that way. Emotes are ephemeral and never enter the event
 * log — see EMOTE_TTL_MS.
 */

export const EMOTE_KEYS = [
  'happy',
  'congrats',
  'impatient',
  'angry',
  'facepalm',
  'confused',
] as const;

export type EmoteKey = (typeof EMOTE_KEYS)[number];

export const EMOTE_GLYPH: Record<EmoteKey, string> = {
  happy: '😄',
  congrats: '👏',
  impatient: '⏳',
  angry: '😠',
  facepalm: '🤦',
  confused: '😕',
};

/**
 * How long an emote stays visible, and — for AI emotes — how young an event has to be to
 * still be worth reacting to.
 *
 * Both uses have to share this number. AI emotes are derived from the event log rather than
 * transported, so on a refresh or reconnect the whole log replays and would fire every
 * reaction again at once. Gating on the event's own wall-clock age is what stops that, and
 * an event older than the display window could never have produced a visible emote anyway.
 */
export const EMOTE_TTL_MS = 10_000;

/** An emote as stored/transported: which one, and when it was sent. */
export interface EmoteSignal {
  key: EmoteKey;
  at: number;
}
