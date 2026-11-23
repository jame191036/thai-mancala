/**
 * หมากขุม AI (GDD §6). Pure TypeScript: no Phaser, no DOM, so it runs in a Web Worker, in
 * unit tests, and later on a server. It only ever moves through the rules engine
 * (`applyMove`), so it cannot play by different rules than the game — both rulesets work.
 *
 * - easy   : 60% a random legal pit, 40% the pit that banks the most seeds right now.
 * - medium : the pit whose whole turn (following extra-turn chains) leaves the best position.
 * - hard   : minimax with alpha-beta and iterative deepening inside a time budget.
 */
import { otherPlayer, storeOf } from '../logic/board';
import { applyMove, legalMoves, seedsOnSide } from '../logic/rules';
import type { GameState, PitIndex, Player } from '../logic/types';

export type AiLevel = 'easy' | 'medium' | 'hard';
export const AI_LEVELS: readonly AiLevel[] = ['easy', 'medium', 'hard'];

export interface ChooseOptions {
  /** Randomness for easy/medium tie-breaks. Inject a seeded one for reproducible games. */
  rng?: () => number;
  /** Hard: stop deepening after this many ms (GDD: 400). */
  timeBudgetMs?: number;
  /** Hard: never search deeper than this many plies. */
  maxDepth?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
  /** Tuning: weight of a seed still on your side vs one in your store. Default 0: measured
   *  best — seeds on your side can still be captured (medium vs random: 100% at 0,
   *  83% at 0.5 under the video rules). */
  sideWeight?: number;
  /** Filled in by the hard search: deepest finished depth and nodes visited. */
  stats?: { depth: number; nodes: number };
}

export const DEFAULT_TIME_BUDGET_MS = 400;
const DEFAULT_MAX_DEPTH = 24;
/** Medium follows at most this many extra turns in a row. */
const MEDIUM_CHAIN_LIMIT = 4;
const WIN = 1000;
const DEFAULT_SIDE_WEIGHT = 0;

/** Pick a pit for `state.current`. Throws if there is no legal move. */
export function chooseMove(state: GameState, level: AiLevel, options: ChooseOptions = {}): PitIndex {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error('chooseMove: no legal move in this state');
  if (moves.length === 1) return moves[0];
  const rng = options.rng ?? Math.random;

  switch (level) {
    case 'easy':
      return rng() < 0.6 ? moves[Math.floor(rng() * moves.length)] : bestBy(moves, (m) => immediateGain(state, m), rng);
    case 'medium': {
      const me = state.current;
      const w = options.sideWeight;
      return bestBy(moves, (m) => afterOwnTurn(applyMove(state, m), me, MEDIUM_CHAIN_LIMIT, w), rng);
    }
    case 'hard':
      return searchBestMove(state, options);
  }
}

// ── Evaluation ───────────────────────────────────────────────────────────────

/**
 * How good `s` is for `me`: the store difference (seeds still on a side count
 * `sideWeight` each, 0 by default). A finished game is decisive.
 */
export function evaluate(s: GameState, me: Player, sideWeightOverride?: number): number {
  const opp = otherPlayer(me);
  const storeDiff = s.pits[storeOf(me)] - s.pits[storeOf(opp)];
  if (s.phase === 'gameOver') {
    if (s.winner === null) return storeDiff;
    return (s.winner === me ? WIN : -WIN) + storeDiff;
  }
  if (s.phase === 'roundOver') return storeDiff; // every seed is in a store
  const sideWeight = sideWeightOverride ?? DEFAULT_SIDE_WEIGHT;
  if (sideWeight === 0) return storeDiff;
  return storeDiff + sideWeight * (seedsOnSide(s.pits, me) - seedsOnSide(s.pits, opp));
}

function immediateGain(state: GameState, pit: PitIndex): number {
  const store = storeOf(state.current);
  return applyMove(state, pit).pits[store] - state.pits[store];
}

/** Medium: value once `me`'s turn is over, taking the best follow-up on each extra turn. */
function afterOwnTurn(s: GameState, me: Player, chainLeft: number, w?: number): number {
  if (s.phase !== 'playing' || s.current !== me || chainLeft === 0) return evaluate(s, me, w);
  let best = -Infinity;
  for (const m of legalMoves(s)) best = Math.max(best, afterOwnTurn(applyMove(s, m), me, chainLeft - 1, w));
  return best;
}

/** Highest score wins; ties are broken at random so easy/medium do not look robotic. */
function bestBy(moves: PitIndex[], score: (m: PitIndex) => number, rng: () => number): PitIndex {
  let best: PitIndex[] = [];
  let bestScore = -Infinity;
  for (const m of moves) {
    const v = score(m);
    if (v > bestScore + 1e-9) {
      bestScore = v;
      best = [m];
    } else if (Math.abs(v - bestScore) <= 1e-9) {
      best.push(m);
    }
  }
  return best[Math.floor(rng() * best.length)];
}

// ── Hard: alpha-beta with iterative deepening ────────────────────────────────

class TimeUp extends Error {}

interface Search {
  me: Player;
  deadline: number;
  now: () => number;
  nodes: number;
  /** Did any line stop because of the depth limit (so deeper search could change things)? */
  hitDepthLimit: boolean;
  sideWeight?: number;
}

/** Pits nearer the mover's store first: those moves more often end in the store or capture. */
function orderedMoves(s: GameState, first?: PitIndex): PitIndex[] {
  const moves = legalMoves(s).sort((a, b) => b - a);
  if (first !== undefined && moves.includes(first)) return [first, ...moves.filter((m) => m !== first)];
  return moves;
}

function searchBestMove(state: GameState, options: ChooseOptions): PitIndex {
  const now = options.now ?? (() => performance.now());
  const budget = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const search: Search = { me: state.current, deadline: now() + budget, now, nodes: 0, hitDepthLimit: false, sideWeight: options.sideWeight };
  if (options.stats) options.stats.depth = 0;

  let best = orderedMoves(state)[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    search.hitDepthLimit = false;
    try {
      best = searchRoot(state, depth, search, best);
      if (options.stats) options.stats.depth = depth;
    } catch (e) {
      if (e instanceof TimeUp) break; // keep the best move of the last finished depth
      throw e;
    }
    if (!search.hitDepthLimit) break; // the whole game tree was searched: nothing more to learn
  }
  if (options.stats) options.stats.nodes = search.nodes;
  return best;
}

function searchRoot(state: GameState, depth: number, search: Search, previousBest: PitIndex): PitIndex {
  let best = previousBest;
  let alpha = -Infinity;
  for (const m of orderedMoves(state, previousBest)) {
    const v = minimax(applyMove(state, m), depth - 1, alpha, Infinity, search);
    if (v > alpha) {
      alpha = v;
      best = m;
    }
  }
  return best;
}

/** Value for `search.me`. An extra turn keeps the same player to move, so no sign flip. */
function minimax(s: GameState, depth: number, alpha: number, beta: number, search: Search): number {
  if ((++search.nodes & 1023) === 0 && search.now() > search.deadline) throw new TimeUp();
  if (s.phase !== 'playing') return evaluate(s, search.me, search.sideWeight);
  if (depth === 0) {
    search.hitDepthLimit = true;
    return evaluate(s, search.me, search.sideWeight);
  }

  if (s.current === search.me) {
    let value = -Infinity;
    for (const m of orderedMoves(s)) {
      value = Math.max(value, minimax(applyMove(s, m), depth - 1, alpha, beta, search));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  }
  let value = Infinity;
  for (const m of orderedMoves(s)) {
    value = Math.min(value, minimax(applyMove(s, m), depth - 1, alpha, beta, search));
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return value;
}
