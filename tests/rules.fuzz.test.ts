/**
 * AC-R14 / AC-R15: thousands of random games with a fixed seed (reproducible, never flaky).
 * Every move must conserve the 98 seeds, be fully described by its steps, and never drop
 * into the opponent's store or a dead pit. Every round must finish.
 *
 * Checks run as plain comparisons (not `expect` per seed) to keep the suite fast; the first
 * failure is reported with enough context to reproduce it.
 */
import { describe, expect, it } from 'vitest';
import { TOTAL_SEEDS, storeOf } from '../src/logic/board';
import { applyMove, createGame, legalMoves, playMove, startNextRound } from '../src/logic/rules';
import type { GameMode, GameState, MoveResult, Ruleset } from '../src/logic/types';
import { replaySteps, sum } from './helpers';

/** mulberry32: tiny deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_TURNS_PER_ROUND = 2000; // AC-R15

const sameBoard = (a: readonly number[], b: readonly number[]) => a.every((v, i) => v === b[i]);

/** Returns a description of the first broken invariant, or null. */
function checkTransition(before: GameState, result: MoveResult): string | null {
  const after = result.state;
  if (sum(after.pits) !== TOTAL_SEEDS) return `seed total is ${sum(after.pits)}, expected 98`;
  let replayed: number[];
  try {
    replayed = replaySteps(before.pits, result.steps);
  } catch (e) {
    return `steps do not replay: ${(e as Error).message}`;
  }
  if (!sameBoard(replayed, after.pits)) return 'replaying the steps does not give the new board';
  const forbidden = storeOf(before.current === 0 ? 1 : 0);
  for (const s of result.steps) {
    if (s.kind !== 'drop') continue;
    if (s.pit === forbidden) return `seed dropped into the opponent store ${s.pit}`;
    if (before.dead[s.pit]) return `seed dropped into dead pit ${s.pit}`;
  }
  if (after.dead.some((d, i) => d && after.pits[i] !== 0)) return 'a dead pit holds seeds';

  // Each ruleset only uses its own steps.
  const kinds = new Set(result.steps.map((s) => s.kind));
  if (before.ruleset === 'traditional' && (kinds.has('sideEmpty') || kinds.has('sweep'))) {
    return 'sideEmpty/sweep under the traditional ruleset';
  }
  if (before.ruleset === 'video') {
    if (kinds.has('pass')) return 'pass step under the video ruleset';
    if (kinds.has('relay')) return 'relay under the video ruleset (only the store gives another go)';
    // R17: while the round goes on, both sides always hold seeds.
    if (after.phase === 'playing' && (sum(after.pits.slice(0, 7)) === 0 || sum(after.pits.slice(8, 15)) === 0)) {
      return 'still playing with an empty side under the video ruleset';
    }
  }
  return null;
}

interface Totals {
  games: number;
  finished: number;
  rounds: number;
  roundsWithDeadPits: number;
  maxTurnsInRound: number;
  failure: string | null;
}

function runRandomGames(
  mode: GameMode,
  games: number,
  maxRounds: number,
  seed: number,
  ruleset: Ruleset = 'traditional',
): Totals {
  const random = rng(seed);
  const t: Totals = { games, finished: 0, rounds: 0, roundsWithDeadPits: 0, maxTurnsInRound: 0, failure: null };

  for (let g = 0; g < games && !t.failure; g++) {
    let state = createGame(mode, random() < 0.5 ? 0 : 1, { maxRounds, ruleset });
    let rounds = 1;
    let turns = 0;
    t.rounds += 1;

    while (state.phase !== 'gameOver' && !t.failure) {
      if (state.phase === 'roundOver') {
        if (rounds >= state.maxRounds) {
          t.failure = `game ${g}: round ${rounds} of ${state.maxRounds} ended without gameOver (R16)`;
          break;
        }
        const next = startNextRound(state);
        const problem = checkTransition({ ...state, current: 0 }, next);
        if (problem) t.failure = `game ${g} refill before round ${rounds + 1}: ${problem}`;
        state = next.state;
        if (state.dead.some(Boolean)) t.roundsWithDeadPits += 1;
        rounds += 1;
        t.rounds += 1;
        turns = 0;
        continue;
      }

      const moves = legalMoves(state);
      if (moves.length === 0) {
        t.failure = `game ${g}: phase "playing" but P${state.current + 1} has no legal move`;
        break;
      }
      const pit = moves[Math.floor(random() * moves.length)];
      const result = playMove(state, pit);
      // The AI's fast path must reach exactly the same state.
      if (!t.failure && JSON.stringify(applyMove(state, pit)) !== JSON.stringify(result.state)) {
        t.failure = `game ${g}: applyMove and playMove disagree on pit ${pit}`;
      }
      const problem = checkTransition(state, result);
      if (problem) t.failure = `game ${g}, round ${rounds}, P${state.current + 1} pit ${pit}: ${problem}`;
      state = result.state;

      turns += 1;
      t.maxTurnsInRound = Math.max(t.maxTurnsInRound, turns);
      if (turns > MAX_TURNS_PER_ROUND) t.failure = `game ${g}, round ${rounds}: more than ${MAX_TURNS_PER_ROUND} turns`;
    }
    if (state.phase === 'gameOver') t.finished += 1;
  }
  return t;
}

describe('random play (fixed seed)', () => {
  it('10,000 short games: all finish, every invariant holds', { timeout: 60_000 }, () => {
    const t = runRandomGames('short', 10_000, 1, 20261123);
    expect(t.failure).toBeNull();
    expect(t.finished).toBe(10_000);
    expect(t.maxTurnsInRound).toBeLessThanOrEqual(MAX_TURNS_PER_ROUND);
  });

  it.each([3, 5, 7])('1,000 full games of %i rounds: all finish, every invariant holds', { timeout: 60_000 }, (rounds) => {
    const t = runRandomGames('full', 1_000, rounds, 98 + rounds);
    expect(t.failure).toBeNull();
    expect(t.finished).toBe(1_000); // R16 guarantees the end
    expect(t.rounds).toBeLessThanOrEqual(1_000 * rounds);
    expect(t.roundsWithDeadPits).toBeGreaterThan(0); // the dead-pit path really ran
  });

  it('300 long full games (20 rounds) stress refills and dead pits', { timeout: 60_000 }, () => {
    const t = runRandomGames('full', 300, 20, 2026);
    expect(t.failure).toBeNull();
    expect(t.finished).toBe(300);
  });
});

describe('random play, R17 "video" ruleset (fixed seed)', () => {
  it('10,000 short games: all finish, every invariant holds', { timeout: 60_000 }, () => {
    const t = runRandomGames('short', 10_000, 1, 1723, 'video');
    expect(t.failure).toBeNull();
    expect(t.finished).toBe(10_000);
  });

  it.each([3, 7])('1,000 full games of %i rounds: all finish, refills keep invariants', { timeout: 60_000 }, (rounds) => {
    const t = runRandomGames('full', 1_000, rounds, 4000 + rounds, 'video');
    expect(t.failure).toBeNull();
    expect(t.finished).toBe(1_000);
    expect(t.roundsWithDeadPits).toBeGreaterThan(0);
  });
});
