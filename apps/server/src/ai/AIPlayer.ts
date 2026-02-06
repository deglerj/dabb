/**
 * AI Player interface and stub implementation
 */

import type { AIAction, AIDecisionContext } from '@dabb/shared-types';

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
 * Stub AI player that throws "not implemented" for all decisions.
 * This will be replaced with actual AI logic later.
 */
export class StubAIPlayer implements AIPlayer {
  async decide(_context: AIDecisionContext): Promise<AIAction> {
    throw new Error('AI decision logic not yet implemented');
  }
}

/**
 * Factory for creating stub AI players
 */
export class StubAIPlayerFactory implements AIPlayerFactory {
  create(_difficulty?: string): AIPlayer {
    return new StubAIPlayer();
  }
}

// Default factory instance
export const defaultAIPlayerFactory: AIPlayerFactory = new StubAIPlayerFactory();
