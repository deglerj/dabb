/**
 * Turns the event log into the lines shown in the game log panel.
 *
 * Events used to be mapped into a GameLogEntry intermediate first, which the screen then
 * switched over a second time to produce text. Every entry kind mapped one-to-one to an
 * event type and had exactly one consumer, so the middle representation only bought a
 * second switch to keep in step with the first.
 */

import { useMemo } from 'react';
import { formatCard, formatSuit } from '@dabb/game-logic';
import { formatMeldName, SUIT_NAMES } from '@dabb/shared-types';
import type { Card, GameEvent, Meld, PlayerIndex, Rank, Suit, Team } from '@dabb/shared-types';

/** Translation function, passed in so this package stays independent of the i18n setup. */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface MeldDetail {
  name: string; // e.g. "Herz-Paar", "Binokel"
  cards: string[]; // e.g. ["Herz König", "Herz Ober"] — formatCard returns suit then rank
  points: number;
}

export interface LogLine {
  key: string;
  text: string;
  /** Only set for a player's own meld declaration. */
  detail?: MeldDetail[];
}

export interface GameLogResult {
  /** All lines in chronological order (oldest first). */
  entries: LogLine[];
  /**
   * One-line summary for the collapsed panel: the most recent thing worth reporting.
   * Consecutive meld declarations collapse into a single line.
   */
  collapsedSummary?: string;
}

/** Rebuild a Card from its `suit-rank-copy` ID, for events that carry only IDs. */
function cardFromId(cardId: string): Card {
  const [suit, rank, copy] = cardId.split('-');
  return { id: cardId, suit: suit as Suit, rank: rank as Rank, copy: Number(copy) as 0 | 1 };
}

function meldDetail(melds: Meld[]): MeldDetail[] {
  return melds.map((meld) => ({
    name: formatMeldName(meld, SUIT_NAMES),
    cards: meld.cards.map((cardId) => formatCard(cardFromId(cardId))),
    points: meld.points,
  }));
}

/** What the log is building up as it walks the events. */
interface Line extends LogLine {
  important: boolean;
  /** Set on meld declarations so consecutive ones can be merged for the collapsed view. */
  isMeld: boolean;
}

export function useGameLog(
  events: GameEvent[],
  nicknames: Map<PlayerIndex, string>,
  t: Translate
): GameLogResult {
  return useMemo(() => {
    const lines: Line[] = [];
    const nameOf = (idx: PlayerIndex) => nicknames.get(idx) ?? `P${idx}`;

    // Nicknames and teams as the log itself saw them, so a game replayed from events alone
    // can still name the winner without the caller's map.
    const joined = new Map<PlayerIndex, { nickname: string; team?: Team }>();
    // The buried-trump reveal is derived per client from the card IDs left readable by
    // filterCardsDiscarded, so the trump in force has to be carried forward as we go.
    let trump: Suit | null = null;

    const push = (key: string, text: string, opts: Partial<Line> = {}) => {
      lines.push({ key, text, important: false, isMeld: false, ...opts });
    };

    for (const event of events) {
      const id = event.id;

      switch (event.type) {
        case 'PLAYER_JOINED':
          joined.set(event.payload.playerIndex, {
            nickname: event.payload.nickname,
            ...(event.payload.team === undefined ? {} : { team: event.payload.team }),
          });
          break;

        case 'GAME_STARTED': {
          push(
            id,
            t('gameLog.gameStarted', {
              playerCount: event.payload.playerCount,
              targetScore: event.payload.targetScore,
            })
          );
          if (event.payload.playerCount === 4) {
            const namesOfTeam = (team: Team) =>
              [...joined.values()].filter((p) => p.team === team).map((p) => p.nickname);
            const team0 = namesOfTeam(0);
            const team1 = namesOfTeam(1);
            if (team0.length > 0 && team1.length > 0) {
              push(
                `${id}-teams`,
                t('gameLog.teamsAnnounced', {
                  team0: team0.join(', '),
                  team1: team1.join(', '),
                })
              );
            }
          }
          break;
        }

        case 'NEW_ROUND_STARTED':
          trump = null;
          push(id, t('gameLog.roundStarted', { round: event.payload.round }));
          break;

        case 'BID_PLACED':
          push(
            id,
            t('gameLog.bidPlaced', {
              name: nameOf(event.payload.playerIndex),
              amount: event.payload.amount,
            })
          );
          break;

        case 'PLAYER_PASSED':
          push(id, t('gameLog.playerPassed', { name: nameOf(event.payload.playerIndex) }));
          break;

        case 'BIDDING_WON':
          push(
            id,
            t('gameLog.biddingWon', {
              name: nameOf(event.payload.playerIndex),
              bid: event.payload.winningBid,
            })
          );
          break;

        case 'DABB_TAKEN':
          push(id, t('gameLog.dabbTaken', { name: nameOf(event.payload.playerIndex) }));
          break;

        case 'TRUMP_DECLARED':
          trump = event.payload.suit;
          push(
            id,
            t('gameLog.trumpDeclared', {
              name: nameOf(event.payload.playerIndex),
              suit: formatSuit(event.payload.suit),
            })
          );
          break;

        case 'GOING_OUT':
          trump = event.payload.suit;
          push(
            id,
            t('gameLog.goingOut', {
              name: nameOf(event.payload.playerIndex),
              suit: formatSuit(event.payload.suit),
            }),
            { important: true }
          );
          break;

        // The layaway is face down, but buried trump has to be announced. filterCardsDiscarded
        // leaves exactly those card IDs readable and replaces the rest with 'hidden'.
        case 'CARDS_DISCARDED': {
          if (trump === null) {
            break;
          }
          const trumpCards = event.payload.discardedCards.filter((cardId) =>
            cardId.startsWith(`${trump}-`)
          );
          if (trumpCards.length === 0) {
            break;
          }
          push(
            id,
            t('gameLog.trumpDiscarded', {
              name: nameOf(event.payload.playerIndex),
              cards: trumpCards.map((cardId) => formatCard(cardFromId(cardId))).join(', '),
            })
          );
          break;
        }

        case 'MELDS_DECLARED': {
          const name = nameOf(event.payload.playerIndex);
          const points = event.payload.totalPoints;
          push(
            id,
            points === 0
              ? t('gameLog.meldsNone', { name })
              : t('gameLog.meldsDeclared', { name, points }),
            { important: true, isMeld: true, detail: meldDetail(event.payload.melds) }
          );
          break;
        }

        case 'CARD_PLAYED':
          push(
            id,
            t('gameLog.cardPlayed', {
              name: nameOf(event.payload.playerIndex),
              card: formatCard(event.payload.card),
            })
          );
          break;

        case 'TRICK_WON':
          push(
            id,
            t('gameLog.trickWon', {
              name: nameOf(event.payload.winnerIndex),
              points: event.payload.points,
            }),
            { important: true }
          );
          break;

        case 'ROUND_SCORED':
          push(id, t('gameLog.roundScored'), { important: true });
          break;

        case 'GAME_FINISHED': {
          const winner = event.payload.winner;
          const asTeam = [...joined.values()].filter((p) => p.team === winner);
          const winnerNames =
            asTeam.length > 0
              ? asTeam.map((p) => p.nickname)
              : [joined.get(winner as PlayerIndex)?.nickname ?? String(winner)];
          push(id, t('gameLog.gameFinished', { name: winnerNames.join(' & ') }), {
            important: true,
          });
          break;
        }

        case 'GAME_TERMINATED':
          push(id, t('gameLog.gameTerminated', { name: nameOf(event.payload.terminatedBy) }));
          break;

        // Secret or uninteresting — nothing to show.
        case 'CARDS_DEALT':
        case 'MELDING_COMPLETE':
          break;
      }
    }

    return {
      entries: lines.map(({ key, text, detail }) =>
        detail ? { key, text, detail } : { key, text }
      ),
      collapsedSummary: summarise(lines),
    };
  }, [events, nicknames, t]);
}

/**
 * The most recent important line, with a run of meld declarations reported as one.
 *
 * Everyone melds at roughly the same moment, so showing only the last player's declaration
 * in the collapsed panel would hide the rest.
 */
function summarise(lines: Line[]): string | undefined {
  let last = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].important) {
      last = i;
      break;
    }
  }
  if (last === -1) {
    return undefined;
  }
  if (!lines[last].isMeld) {
    return lines[last].text;
  }

  let start = last;
  while (start > 0 && lines[start - 1].isMeld) {
    start--;
  }
  return lines
    .slice(start, last + 1)
    .map((line) => line.text)
    .join(', ');
}
