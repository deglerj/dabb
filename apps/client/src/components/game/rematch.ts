/**
 * Where a rematch vote stands, resolved for display in the end-of-game modal.
 */
import type { PlayerIndex } from '@dabb/shared-types';

/**
 * What the end-of-game modal needs to offer a rematch. Offline there is nobody to ask, so
 * `myVote` stays null, both name lists stay empty and `onDecline` does nothing — the same
 * two buttons then simply start the next game or leave.
 */
export interface RematchState {
  /** null = not answered, true = agreed and waiting on the others, false = declined. */
  myVote: boolean | null;
  /** Nicknames of the humans still to answer. */
  waitingFor: string[];
  /** Nicknames of the humans who said no. */
  declinedBy: string[];
  onRematch: () => void;
  onDecline: () => void;
}

export interface RematchStatus {
  /** `agreed` means every human seat answered yes — bots are counted as yes without asking. */
  status: 'pending' | 'agreed' | 'declined';
  /** Human seats that have not answered yet. */
  waitingFor: PlayerIndex[];
  /** Human seats that answered no. One is enough to end it for everyone. */
  declinedBy: PlayerIndex[];
}

/**
 * AI seats never vote: `pickAIEmote`'s rule applies here too — a bot's answer is derived on
 * every client rather than transported, and the answer is always yes. So only human seats are
 * passed in, and everyone missing from the list is already agreed.
 *
 * An empty seat list is `pending`, not `agreed`: the seats arrive with the session meta a
 * moment after the game screen mounts, and reading "nobody objected" out of "nobody is known
 * yet" would start a rematch the instant the game ended, before anyone was asked.
 */
export function resolveRematchStatus(
  votes: Record<string, boolean>,
  humanSeats: PlayerIndex[]
): RematchStatus {
  const declinedBy = humanSeats.filter((seat) => votes[String(seat)] === false);
  const waitingFor = humanSeats.filter((seat) => votes[String(seat)] === undefined);

  let status: RematchStatus['status'];
  if (declinedBy.length > 0) {
    status = 'declined';
  } else if (humanSeats.length === 0 || waitingFor.length > 0) {
    status = 'pending';
  } else {
    status = 'agreed';
  }

  return { status, waitingFor, declinedBy };
}
