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

/**
 * Factory interface for creating AI players
 */
export interface AIPlayerFactory {
  /**
   * Create a new AI player instance
   */
  create(difficulty?: string): AIPlayer;
}

/**
 * Factory that creates BinokelAIPlayer instances
 */
export class DefaultAIPlayerFactory implements AIPlayerFactory {
  create(_difficulty?: string): AIPlayer {
    return new BinokelAIPlayer();
  }
}

// Default factory instance
export const defaultAIPlayerFactory: AIPlayerFactory = new DefaultAIPlayerFactory();
