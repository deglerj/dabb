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

interface RunnerOptions {
  players: PlayerCount;
  games: number;
  concurrency: number;
  targetScore: number;
  maxActions: number;
  timeout: number;
  outputDir: string;
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

    // Win distribution
    const wins: Record<number, number> = {};
    for (let i = 0; i < options.players; i++) {
      wins[i] = 0;
    }
    for (const r of successful) {
      if (r.winner !== null) {
        wins[r.winner] = (wins[r.winner] || 0) + 1;
      }
    }

    const names = ['Alice', 'Bob', 'Charlie', 'Diana'];
    console.log('');
    console.log('Win Distribution:');
    for (let i = 0; i < options.players; i++) {
      const pct = ((wins[i] / successful.length) * 100).toFixed(1);
      console.log(`  ${names[i]}: ${wins[i]} wins (${pct}%)`);
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
