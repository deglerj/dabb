/**
 * Event log formatting for human-readable export
 */

import type { GameEvent, PlayerIndex, Team } from '@dabb/shared-types';
import { formatCard, formatCards, formatSuit, formatMeld } from './cardFormatter.js';

export interface PlayerInfo {
  playerIndex: PlayerIndex;
  nickname: string;
  team?: Team;
}

export interface EventLogOptions {
  sessionCode?: string;
  sessionId?: string;
  players?: PlayerInfo[];
  terminated?: boolean;
}

interface GroupedEvents {
  round: number;
  dealer: PlayerIndex;
  events: GameEvent[];
}

const DIVIDER = '================================================================================';

/**
 * Format a timestamp as HH:MM:SS
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toTimeString().slice(0, 8);
}

/**
 * Format a player reference
 */
function formatPlayer(playerIndex: PlayerIndex, players: Map<PlayerIndex, PlayerInfo>): string {
  const player = players.get(playerIndex);
  if (player) {
    return `${player.nickname} [${playerIndex}]`;
  }
  return `Player ${playerIndex}`;
}

/**
 * Group events by round
 */
function groupEventsByRound(events: GameEvent[]): GroupedEvents[] {
  const groups: GroupedEvents[] = [];
  let currentGroup: GroupedEvents | null = null;

  for (const event of events) {
    if (event.type === 'GAME_STARTED') {
      currentGroup = {
        round: 1,
        dealer: event.payload.dealer,
        events: [event],
      };
      groups.push(currentGroup);
    } else if (event.type === 'NEW_ROUND_STARTED') {
      currentGroup = {
        round: event.payload.round,
        dealer: event.payload.dealer,
        events: [event],
      };
      groups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.events.push(event);
    }
  }

  return groups;
}

/**
 * Format a single event
 */
function formatEvent(
  event: GameEvent,
  sequenceNum: number,
  players: Map<PlayerIndex, PlayerInfo>
): string {
  const seqStr = String(sequenceNum).padStart(3, '0');
  const time = formatTime(event.timestamp);
  const header = `[${seqStr}] ${time} | ${event.type}`;

  const lines: string[] = [header];

  switch (event.type) {
    case 'GAME_STARTED':
      lines.push(
        `      ${event.payload.playerCount} players, target score: ${event.payload.targetScore}`
      );
      break;

    case 'PLAYER_JOINED':
      lines.push(
        `      ${event.payload.nickname} joined as Player ${event.payload.playerIndex}${event.payload.team !== undefined ? ` (Team ${event.payload.team})` : ''}`
      );
      break;

    case 'PLAYER_LEFT':
      lines.push(`      ${formatPlayer(event.payload.playerIndex, players)} left`);
      break;

    case 'PLAYER_RECONNECTED':
      lines.push(`      ${formatPlayer(event.payload.playerIndex, players)} reconnected`);
      break;

    case 'CARDS_DEALT': {
      const hands = event.payload.hands;
      for (const [idx, cards] of Object.entries(hands)) {
        const playerIdx = Number(idx) as PlayerIndex;
        lines.push(`      Player ${playerIdx}: ${formatCards(cards)}`);
      }
      lines.push(`      Dabb: ${formatCards(event.payload.dabb)}`);
      break;
    }

    case 'BID_PLACED':
      lines.push(
        `      ${formatPlayer(event.payload.playerIndex, players)} bid ${event.payload.amount}`
      );
      break;

    case 'PLAYER_PASSED':
      lines.push(`      ${formatPlayer(event.payload.playerIndex, players)} passed`);
      break;

    case 'BIDDING_WON':
      lines.push(
        `      ${formatPlayer(event.payload.playerIndex, players)} won bidding with ${event.payload.winningBid}`
      );
      break;

    case 'DABB_TAKEN':
      lines.push(
        `      ${formatPlayer(event.payload.playerIndex, players)} took dabb: ${formatCards(event.payload.dabbCards)}`
      );
      break;

    case 'CARDS_DISCARDED':
      lines.push(
        `      ${formatPlayer(event.payload.playerIndex, players)} discarded: ${event.payload.discardedCards.join(', ')}`
      );
      break;

    case 'TRUMP_DECLARED':
      lines.push(
        `      ${formatPlayer(event.payload.playerIndex, players)} declared ${formatSuit(event.payload.suit)} as trump`
      );
      break;

    case 'MELDS_DECLARED': {
      const melds = event.payload.melds;
      lines.push(
        `      ${formatPlayer(event.payload.playerIndex, players)} declared melds (${event.payload.totalPoints} points):`
      );
      for (const meld of melds) {
        lines.push(`        ${formatMeld(meld)}`);
      }
      break;
    }

    case 'MELDING_COMPLETE':
      lines.push('      All players have declared melds');
      for (const [idx, score] of Object.entries(event.payload.meldScores)) {
        lines.push(`        Player ${idx}: ${score} points`);
      }
      break;

    case 'CARD_PLAYED':
      lines.push(
        `      ${formatPlayer(event.payload.playerIndex, players)} played ${formatCard(event.payload.card)}`
      );
      break;

    case 'TRICK_WON':
      lines.push(
        `      ${formatPlayer(event.payload.winnerIndex, players)} won trick (${event.payload.points} pts)`
      );
      break;

    case 'ROUND_SCORED':
      lines.push('      Round scores:');
      for (const [idx, score] of Object.entries(event.payload.scores)) {
        const scoreData = score as {
          melds: number;
          tricks: number;
          total: number;
          bidMet: boolean;
        };
        lines.push(
          `        ${idx}: melds=${scoreData.melds}, tricks=${scoreData.tricks}, total=${scoreData.total}${scoreData.bidMet ? '' : ' (bid not met)'}`
        );
      }
      break;

    case 'GAME_FINISHED':
      lines.push(`      Winner: ${event.payload.winner}`);
      lines.push('      Final scores:');
      for (const [idx, score] of Object.entries(event.payload.finalScores)) {
        lines.push(`        ${idx}: ${score}`);
      }
      break;

    case 'NEW_ROUND_STARTED':
      // No additional info needed, header in round section
      break;
  }

  return lines.join('\n');
}

/**
 * Format a group of events for a round
 */
function formatRoundEvents(group: GroupedEvents, players: Map<PlayerIndex, PlayerInfo>): string {
  const lines: string[] = [];
  const playerName = players.get(group.dealer)?.nickname ?? `Player ${group.dealer}`;

  lines.push('');
  lines.push(DIVIDER);
  lines.push(`ROUND ${group.round} - Dealer: ${playerName} [${group.dealer}]`);
  lines.push(DIVIDER);

  // Track the current phase for section headers
  let currentSection = '';

  for (const event of group.events) {
    const section = getEventSection(event.type);
    if (section && section !== currentSection) {
      currentSection = section;
      lines.push('');
      lines.push(`--- ${section} ---`);
    }

    lines.push(formatEvent(event, event.sequence, players));
  }

  return lines.join('\n');
}

/**
 * Determine the section for an event type
 */
function getEventSection(type: GameEvent['type']): string | null {
  switch (type) {
    case 'GAME_STARTED':
    case 'NEW_ROUND_STARTED':
      return null; // Part of round header
    case 'CARDS_DEALT':
      return 'DEALING';
    case 'BID_PLACED':
    case 'PLAYER_PASSED':
    case 'BIDDING_WON':
      return 'BIDDING';
    case 'DABB_TAKEN':
    case 'CARDS_DISCARDED':
      return 'DABB';
    case 'TRUMP_DECLARED':
    case 'MELDS_DECLARED':
    case 'MELDING_COMPLETE':
      return 'TRUMP & MELDS';
    case 'CARD_PLAYED':
    case 'TRICK_WON':
      return 'TRICKS';
    case 'ROUND_SCORED':
      return 'SCORING';
    case 'GAME_FINISHED':
      return 'GAME END';
    case 'PLAYER_JOINED':
    case 'PLAYER_LEFT':
    case 'PLAYER_RECONNECTED':
      return 'PLAYERS';
    default:
      return null;
  }
}

/**
 * Extract player info from PLAYER_JOINED events
 */
function extractPlayersFromEvents(events: GameEvent[]): Map<PlayerIndex, PlayerInfo> {
  const players = new Map<PlayerIndex, PlayerInfo>();

  for (const event of events) {
    if (event.type === 'PLAYER_JOINED') {
      players.set(event.payload.playerIndex, {
        playerIndex: event.payload.playerIndex,
        nickname: event.payload.nickname,
        team: event.payload.team,
      });
    }
  }

  return players;
}

/**
 * Format a complete event log
 */
export function formatEventLog(events: GameEvent[], options: EventLogOptions = {}): string {
  const lines: string[] = [];
  const now = new Date().toISOString();

  // Extract players from events if not provided
  const playersMap = options.players
    ? new Map(options.players.map((p) => [p.playerIndex, p]))
    : extractPlayersFromEvents(events);

  // Header
  lines.push(DIVIDER);
  lines.push('DABB GAME EVENT LOG');
  lines.push(DIVIDER);

  if (options.terminated) {
    lines.push('⚠️  SESSION TERMINATED AFTER EXPORT');
    lines.push('');
  }

  if (options.sessionCode || options.sessionId) {
    const sessionInfo = [options.sessionCode, options.sessionId ? `(${options.sessionId})` : '']
      .filter(Boolean)
      .join(' ');
    lines.push(`Session: ${sessionInfo}`);
  }

  lines.push(`Export Time: ${now}`);
  lines.push(`Total Events: ${events.length}`);

  // Players section
  if (playersMap.size > 0) {
    lines.push('');
    lines.push('PLAYERS:');
    for (const [idx, player] of playersMap) {
      const teamInfo = player.team !== undefined ? ` (Team ${player.team})` : '';
      lines.push(`  [${idx}] ${player.nickname}${teamInfo}`);
    }
  }

  // Group events by round
  const groups = groupEventsByRound(events);

  // Format each round
  for (const group of groups) {
    lines.push(formatRoundEvents(group, playersMap));
  }

  // Footer
  lines.push('');
  lines.push(DIVIDER);
  lines.push('END OF LOG');
  lines.push(DIVIDER);

  return lines.join('\n');
}
