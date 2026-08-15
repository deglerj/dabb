/**
 * CLI runner for AI-vs-AI game simulations.
 *
 * Usage:
 *   pnpm simulate -- --players 3 --games 100 --concurrency 4
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { formatEventLog } from '@dabb/game-logic';
import type { PlayerCount } from '@dabb/shared-types';

import { SimulationEngine, type SimulationResult } from './SimulationEngine.js';
import type { AIDifficulty } from '@dabb/game-ai';

interface RunnerOptions {
  players: PlayerCount;
  games: number;
  concurrency: number;
  targetScore: number;
  maxActions: number;
  timeout: number;
  outputDir: string;
  difficulty: AIDifficulty;
  /** Difficulty per seat, e.g. `--difficulties hard,easy`. Defaults to `--difficulty` in all. */
  difficulties: AIDifficulty[];
}

/**
 * Which bot sits in which seat for game `gameIndex`.
 *
 * The seats rotate by one per game so that seat-order advantage and deal luck are shared
 * evenly between the bots instead of being attributed to one of them. This is why the
 * simulation needs no seeded decks: `shuffleDeck` uses bare Math.random(), and threading a
 * seeded RNG through the deal is real work to buy variance reduction that rotation gives away.
 */
function rotateSeats(pattern: AIDifficulty[], gameIndex: number): AIDifficulty[] {
  const n = pattern.length;
  const offset = gameIndex % n;
  return pattern.map((_, seat) => pattern[(seat + offset) % n]);
}

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {
    players: 3,
    games: 10,
    concurrency: 1,
    targetScore: 1000,
    maxActions: 10000,
    timeout: 30000,
    outputDir: 'simulation-results',
    difficulty: 'hard',
    difficulties: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--':
        continue;
      case '--players':
        options.players = Number(next) as PlayerCount;
        i++;
        break;
      case '--games':
        options.games = Number(next);
        i++;
        break;
      case '--concurrency':
        options.concurrency = Number(next);
        i++;
        break;
      case '--target-score':
        options.targetScore = Number(next);
        i++;
        break;
      case '--max-actions':
        options.maxActions = Number(next);
        i++;
        break;
      case '--timeout':
        options.timeout = Number(next);
        i++;
        break;
      case '--output-dir':
        options.outputDir = next;
        i++;
        break;
      case '--difficulty':
        if (!['easy', 'medium', 'hard'].includes(next)) {
          console.error(`Invalid difficulty: ${next}. Must be easy, medium, or hard.`);
          process.exit(1);
        }
        options.difficulty = next as AIDifficulty;
        i++;
        break;
      case '--difficulties': {
        const parsed = (next ?? '').split(',').map((s) => s.trim());
        if (parsed.length === 0 || parsed.some((d) => !['easy', 'medium', 'hard'].includes(d))) {
          console.error(
            `Invalid difficulties: ${next}. Comma-separated easy/medium/hard, e.g. "hard,easy".`
          );
          process.exit(1);
        }
        options.difficulties = parsed as AIDifficulty[];
        i++;
        break;
      }
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  // Validate
  if (![2, 3, 4].includes(options.players)) {
    console.error(`Invalid player count: ${options.players}. Must be 2, 3, or 4.`);
    process.exit(1);
  }
  if (options.games < 1) {
    console.error(`Invalid game count: ${options.games}. Must be >= 1.`);
    process.exit(1);
  }

  if (options.difficulties.length === 0) {
    options.difficulties = Array<AIDifficulty>(options.players).fill(options.difficulty);
  }
  if (options.difficulties.length !== options.players) {
    console.error(
      `--difficulties needs one entry per player (${options.players}), got ${options.difficulties.length}.`
    );
    process.exit(1);
  }
  // 4-player games are scored per team, and the winner is a Team, not a seat. A team split
  // between two bots would make "which bot won" unanswerable, so require partners (seats 0/2
  // and 1/3) to share one.
  if (
    options.players === 4 &&
    (options.difficulties[0] !== options.difficulties[2] ||
      options.difficulties[1] !== options.difficulties[3])
  ) {
    console.error(
      'In 4-player games partners must share a difficulty: seats 0 and 2, and seats 1 and 3.'
    );
    process.exit(1);
  }

  return options;
}

function formatGameNumber(n: number, total: number): string {
  const digits = String(total).length;
  return String(n).padStart(digits, '0');
}

async function writeGameLog(
  outputDir: string,
  gameNum: string,
  result: SimulationResult
): Promise<void> {
  const players = [
    { playerIndex: 0, nickname: 'Alice' },
    { playerIndex: 1, nickname: 'Bob' },
    { playerIndex: 2, nickname: 'Charlie' },
    { playerIndex: 3, nickname: 'Diana' },
  ]
    .slice(0, result.events[0]?.type === 'PLAYER_JOINED' ? undefined : 0)
    .filter((_, i) => i < Object.keys(result.scores).length) as Array<{
    playerIndex: 0 | 1 | 2 | 3;
    nickname: string;
  }>;

  const log = formatEventLog(result.events, {
    sessionId: result.sessionId,
    players,
  });

  if (result.error) {
    const errorSuffix = [
      '',
      '================================================================================',
      'SIMULATION ERROR',
      '================================================================================',
      `Error: ${result.error}`,
      '',
      result.errorStack ?? '',
    ].join('\n');

    await writeFile(join(outputDir, `game-${gameNum}.error.log`), log + errorSuffix);
  } else {
    await writeFile(join(outputDir, `game-${gameNum}.log`), log);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  console.log('Binokel AI Simulation');
  console.log('=====================');
  console.log(`Players:      ${options.players}`);
  console.log(`Games:        ${options.games}`);
  console.log(`Concurrency:  ${options.concurrency}`);
  console.log(`Target Score: ${options.targetScore}`);
  console.log(`Max Actions:  ${options.maxActions}`);
  console.log(`Timeout:      ${options.timeout}ms`);
  console.log(`Difficulty:   ${options.difficulty}`);
  console.log(`Difficulties: ${options.difficulties.join(',')} (rotated one seat per game)`);
  console.log(`Output Dir:   ${options.outputDir}`);
  console.log('');

  await mkdir(options.outputDir, { recursive: true });

  const results: SimulationResult[] = [];
  let completed = 0;
  let errored = 0;

  // Run games in batches
  for (let batchStart = 0; batchStart < options.games; batchStart += options.concurrency) {
    const batchSize = Math.min(options.concurrency, options.games - batchStart);
    const batch: Promise<SimulationResult>[] = [];

    for (let j = 0; j < batchSize; j++) {
      const gameIndex = batchStart + j;
      const engine = new SimulationEngine({
        sessionId: `sim-${gameIndex}`,
        playerCount: options.players,
        targetScore: options.targetScore,
        maxActions: options.maxActions,
        timeoutMs: options.timeout,
        difficulty: options.difficulty,
        seats: rotateSeats(options.difficulties, gameIndex).map((difficulty) => ({ difficulty })),
      });
      batch.push(engine.run());
    }

    const settled = await Promise.allSettled(batch);

    for (let j = 0; j < settled.length; j++) {
      const gameIndex = batchStart + j;
      const gameNum = formatGameNumber(gameIndex + 1, options.games);
      const outcome = settled[j];

      let result: SimulationResult;
      if (outcome.status === 'fulfilled') {
        result = outcome.value;
      } else {
        // Unexpected rejection (shouldn't happen — engine catches errors internally)
        result = {
          sessionId: `sim-${gameIndex}`,
          events: [],
          rounds: 0,
          winner: null,
          scores: {},
          actionCount: 0,
          durationMs: 0,
          seatDifficulties: rotateSeats(options.difficulties, gameIndex),
          error: String(outcome.reason),
        };
      }

      results.push(result);
      await writeGameLog(options.outputDir, gameNum, result);

      if (result.error) {
        errored++;
        process.stdout.write('x');
      } else {
        completed++;
        process.stdout.write('.');
      }
    }
  }

  console.log('\n');

  // Summary stats (only from successfully completed games)
  const successful = results.filter((r) => !r.error);

  console.log('Results');
  console.log('=======');
  console.log(`Games:     ${options.games} total, ${completed} completed, ${errored} errored`);

  if (successful.length > 0) {
    const avgRounds = successful.reduce((sum, r) => sum + r.rounds, 0) / successful.length;
    const avgDuration = successful.reduce((sum, r) => sum + r.durationMs, 0) / successful.length;
    const avgActions = successful.reduce((sum, r) => sum + r.actionCount, 0) / successful.length;

    console.log(`Avg Rounds:   ${avgRounds.toFixed(1)}`);
    console.log(`Avg Duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`Avg Actions:  ${avgActions.toFixed(0)}`);

    // Win distribution. In 4-player games GAME_FINISHED carries a Team, not a seat, so there
    // are only ever two winners — listing four names put a flat 0 next to Charlie and Diana.
    const isTeamGame = options.players === 4;
    const sides = isTeamGame ? ['Team 0', 'Team 1'] : ['Alice', 'Bob', 'Charlie', 'Diana'];
    const sideCount = isTeamGame ? 2 : options.players;

    const wins: Record<number, number> = {};
    for (let i = 0; i < sideCount; i++) {
      wins[i] = 0;
    }
    for (const r of successful) {
      if (r.winner !== null) {
        wins[r.winner] = (wins[r.winner] || 0) + 1;
      }
    }

    console.log('');
    console.log('Win Distribution:');
    for (let i = 0; i < sideCount; i++) {
      const pct = ((wins[i] / successful.length) * 100).toFixed(1);
      console.log(`  ${sides[i]}: ${wins[i]} wins (${pct}%)`);
    }

    // The number that actually matters when comparing bots. Seats rotate per game, so this is
    // aggregated over the seat assignment rather than by seat.
    const distinct = [...new Set(options.difficulties)];
    if (distinct.length > 1) {
      const difficultyWins = new Map<AIDifficulty, number>(distinct.map((d) => [d, 0]));

      for (const r of successful) {
        if (r.winner === null) {
          continue;
        }
        // In 4-player games `winner` is a Team (0 or 1) and partners share a difficulty, so seat
        // `winner` is on the winning team either way — for 2 and 3 players it *is* the seat.
        const difficulty = r.seatDifficulties[r.winner];
        difficultyWins.set(difficulty, (difficultyWins.get(difficulty) ?? 0) + 1);
      }

      console.log('');
      console.log('Win Rate by Difficulty:');
      for (const difficulty of distinct) {
        const won = difficultyWins.get(difficulty) ?? 0;
        const pct = ((won / successful.length) * 100).toFixed(1);
        console.log(`  ${difficulty}: ${won} wins (${pct}%)`);
      }
    }
  }

  if (errored > 0) {
    console.log('');
    console.log(`Check ${options.outputDir}/*.error.log for error details.`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
