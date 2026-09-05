import { GameError } from '@dabb/shared-types';

/**
 * Session failures carry a GAME_ERROR_CODES value, which has a `serverErrors.*` translation.
 * Anything else is a bug rather than a rejected action, so it falls back to the generic text
 * instead of putting a raw exception message on screen.
 */
export function sessionErrorText(err: unknown, t: (key: string) => string): string {
  if (err instanceof GameError) {
    return t(`serverErrors.${err.code}`);
  }
  return t('errors.unknownError');
}
