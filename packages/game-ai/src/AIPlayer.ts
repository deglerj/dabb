/**
 * AI Player interface and factory
 */

import type { AIAction, AIDecisionContext } from '@dabb/shared-types';

import { BinokelAIPlayer } from './BinokelAIPlayer.js';

/**
 * Interface for AI player implementations
 */
export interface AIPlayer {
  /**
   * Make a decision based on the current game context
   */
  decide(context: AIDecisionContext): Promise<AIAction>;
}

export type AIDifficulty = 'easy' | 'medium' | 'hard';

/**
 * Which generation of the trick-play strategy to use.
 *
 * 1 — the original single-trick greedy play.
 * 2 — card counting: deduced voids, ducking and sacrifice leads (docs/design/AI_STRATEGY_V2.md).
 *
 * One switch for the whole generation rather than a flag per rule: the rules land in sequence
 * and are measured at each step, so a dozen booleans would only add combinations nobody sweeps.
 * It exists to run v1 against v2 in `pnpm simulate` and is deleted once v2 wins.
 */
export type AIStrategy = 1 | 2;

const MISTAKE_PROBABILITIES: Record<AIDifficulty, number> = {
  hard: 0,
  medium: 0.15,
  easy: 0.35,
};

/**
 * How much the mistake rate grows on top of the base rate while this AI is ahead —
 * the "rubber band". Cheating is not an option in a card game, so a leading AI is handicapped
 * by blundering more often instead. The base rate is the floor: falling behind only ever
 * restores the difficulty the player picked, it never plays better than that.
 */
const RUBBER_BAND_STRENGTH: Record<AIDifficulty, number> = {
  hard: 0,
  medium: 0.15,
  easy: 0.35,
};

/**
 * Whether the bot in `seatIndex` sits opposite a human, i.e. shares a team score with one.
 *
 * Lives here rather than in each driver because both the offline engine and the online
 * `useAI` need the same rule, and they identify humans differently (one knows the human seat,
 * the other knows which seats are bots).
 */
export function partnersHuman(
  playerCount: number,
  seatIndex: number,
  isHuman: (index: number) => boolean
): boolean {
  return playerCount === 4 && isHuman((seatIndex + 2) % 4);
}

/**
 * @param rubberBand - pass false to pin this AI to the flat base rate. Used for a bot that
 *   partners a human in a 4-player game: their scores are the same number, so banding it
 *   would sabotage the human's own teammate.
 * @param strategy - which trick-play generation to use. Only the simulation passes anything
 *   but the default; see AIStrategy.
 */
export function createAIPlayer(
  difficulty: AIDifficulty = 'medium',
  rubberBand = true,
  strategy: AIStrategy = 1
): AIPlayer {
  return new BinokelAIPlayer(
    MISTAKE_PROBABILITIES[difficulty],
    rubberBand ? RUBBER_BAND_STRENGTH[difficulty] : 0,
    strategy
  );
}
