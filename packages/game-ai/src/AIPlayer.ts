/**
 * AI Player interface and default factory
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

const MISTAKE_PROBABILITIES: Record<AIDifficulty, number> = {
  hard: 0,
  medium: 0.15,
  easy: 0.35,
};

/**
 * Factory interface for creating AI players
 */
export interface AIPlayerFactory {
  /**
   * Create a new AI player instance
   */
  create(difficulty?: AIDifficulty): AIPlayer;
}

/**
 * Factory that creates BinokelAIPlayer instances with the given difficulty
 */
export class DefaultAIPlayerFactory implements AIPlayerFactory {
  create(difficulty: AIDifficulty = 'medium'): AIPlayer {
    return new BinokelAIPlayer(MISTAKE_PROBABILITIES[difficulty]);
  }
}

// Default factory instance
export const defaultAIPlayerFactory: AIPlayerFactory = new DefaultAIPlayerFactory();
