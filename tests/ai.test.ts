/**
 * AI (GDD §6): always legal, deterministic when seeded, sensible tactics, respects its
 * time budget, and works under both rulesets.
 */
import { describe, expect, it } from 'vitest';
import { AI_LEVELS, chooseMove, evaluate, type AiLevel } from '../src/ai/ai';
import { createCustomState, createGame, isLegalMove, legalMoves, playMove } from '../src/logic/rules';
import type { GameState, Player, Ruleset } from '../src/logic/types';
import { board } from './helpers';

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

const P1: Player = 0;
const fastHard = { maxDepth: 3, timeBudgetMs: Infinity };

/** Positions reached by random play, for "always legal" checks. */
function samplePositions(ruleset: Ruleset, count: number, seed: number): GameState[] {
  const r = rng(seed);
  const out: GameState[] = [];
  let s = createGame('short', 0, { ruleset });
  while (out.length < count) {
    if (s.phase !== 'playing') s = createGame('short', r() < 0.5 ? 0 : 1, { ruleset });
    out.push(s);
    const m = legalMoves(s);
    s = playMove(s, m[Math.floor(r() * m.length)]).state;
  }
  return out;
}

describe('AI basics', () => {
  it.each(['traditional', 'video'] as const)('every level always picks a legal pit (%s)', (ruleset) => {
    for (const s of samplePositions(ruleset, 150, 42)) {
      for (const level of AI_LEVELS) {
        const pit = chooseMove(s, level, { rng: rng(1), ...fastHard });
        expect(isLegalMove(s, pit), `${level} picked ${pit}`).toBe(true);
      }
    }
  });

  it('with a single legal pit, every level takes it', () => {
    const s = createCustomState({ pits: board({ 3: 2, 10: 1 }), current: P1 });
    for (const level of AI_LEVELS) expect(chooseMove(s, level)).toBe(3);
  });

  it('refuses positions with no move to make', () => {
    const over = playMove(createCustomState({ pits: board({ 6: 1, 7: 48, 15: 49 }), current: P1 }), 6).state;
    expect(() => chooseMove(over, 'easy')).toThrow();
  });

  it('is reproducible with a seeded random source', () => {
    const s = createGame('short', 0);
    const run = (level: AiLevel) => Array.from({ length: 5 }, (_, i) => chooseMove(s, level, { rng: rng(i) }));
    expect(run('easy')).toEqual(run('easy'));
    expect(run('medium')).toEqual(run('medium'));
  });

  it('evaluation is zero-sum and a won game is decisive', () => {
    const s = createCustomState({ pits: board({ 2: 3, 7: 10, 9: 4, 15: 6 }), current: P1 });
    expect(evaluate(s, 0)).toBeCloseTo(-evaluate(s, 1));
    const won = playMove(createCustomState({ pits: board({ 6: 1, 7: 60, 15: 37 }), current: P1 }), 6).state;
    expect(won.phase).toBe('gameOver');
    expect(evaluate(won, 0)).toBeGreaterThan(500);
    expect(evaluate(won, 1)).toBeLessThan(-500);
  });
});

describe('AI tactics', () => {
  // P1 to move. Pit 2 → pit 3 (empty) captures pit 11 (9 seeds) = +10.
  // Pit 5 → pit 6 (empty), opposite pit 8 empty = nothing.
  const bigCapture = (ruleset: Ruleset) =>
    createCustomState({ pits: board({ 2: 1, 5: 1, 11: 9, 9: 1 }), current: P1, ruleset });

  it.each(['traditional', 'video'] as const)('medium and hard take the big capture (%s)', (ruleset) => {
    expect(chooseMove(bigCapture(ruleset), 'medium', { rng: rng(3) })).toBe(2);
    expect(chooseMove(bigCapture(ruleset), 'hard', fastHard)).toBe(2);
  });

  it('medium plays the extra turn first when the follow-up captures more', () => {
    // video rules (no relay). Pit 6 → own store (+1, go again), then pit 4 → pit 5 captures
    // pit 9 (8) = +9: 10 in total. Taking pit 4 straight away is only +9.
    const s = createCustomState({ pits: board({ 2: 1, 4: 1, 6: 1, 9: 8, 11: 2, 13: 1 }), current: P1, ruleset: 'video' });
    expect(chooseMove(s, 'medium', { rng: rng(1), sideWeight: 0 })).toBe(6);
  });
});

// ── Strength (fixed seeds → the same games every run) ────────────────────────

type Bot = AiLevel | 'random';

function playGame(bots: [Bot, Bot], first: Player, ruleset: Ruleset, r: () => number, depth: number): Player | null {
  let s = createGame('short', first, { ruleset });
  while (s.phase === 'playing') {
    const bot = bots[s.current];
    const moves = legalMoves(s);
    const pit = bot === 'random' ? moves[Math.floor(r() * moves.length)] : chooseMove(s, bot, { rng: r, maxDepth: depth, timeBudgetMs: Infinity });
    s = playMove(s, pit).state;
  }
  return s.winner;
}

/** Share of games bot A (as P1) wins; who moves first alternates. */
function winRate(a: Bot, b: Bot, games: number, ruleset: Ruleset, seed: number, hardDepth = 3): number {
  const r = rng(seed);
  let wins = 0;
  for (let g = 0; g < games; g++) if (playGame([a, b], (g % 2) as Player, ruleset, r, hardDepth) === 0) wins++;
  return wins / games;
}

describe('AI strength (GDD §13)', () => {
  it.each(['traditional', 'video'] as const)('AC-AI1: hard beats easy in at least 80%% of 200 games (%s)', { timeout: 60_000 }, (ruleset) => {
    expect(winRate('hard', 'easy', 200, ruleset, 1)).toBeGreaterThanOrEqual(0.8);
  });

  it.each(['traditional', 'video'] as const)('AC-AI2: medium beats random in at least 90%% of 200 games (%s)', { timeout: 60_000 }, (ruleset) => {
    expect(winRate('medium', 'random', 200, ruleset, 2)).toBeGreaterThanOrEqual(0.9);
  });

  it('video rules: hard beats medium most of the time', { timeout: 60_000 }, () => {
    // depth 4 here for speed; the real hard AI searches 10+ plies in its 400 ms budget
    expect(winRate('hard', 'medium', 40, 'video', 3, 4)).toBeGreaterThanOrEqual(0.7);
  });

  // Traditional rules: whoever moves first wins (relay + extra turns let the opener bank up
  // to 95 seeds in one turn), so hard vs medium is decided by the start, not by skill.
  // See GDD Appendix A. Not asserted as a strength test on purpose.
});

describe('AI time budget (AC-AI3 sanity check on this machine)', () => {
  it('hard answers within its budget plus a little slack', () => {
    const s = createGame('short', 0);
    const stats = { depth: 0, nodes: 0 };
    const t0 = performance.now();
    chooseMove(s, 'hard', { timeBudgetMs: 100, stats });
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(250);
    expect(stats.depth).toBeGreaterThanOrEqual(2);
  });

  it('a fake clock that has already run out still yields a legal move', () => {
    let t = 0;
    const s = createGame('short', 1);
    const pit = chooseMove(s, 'hard', { now: () => (t += 1000), timeBudgetMs: 1 });
    expect(isLegalMove(s, pit)).toBe(true);
  });
});
