/**
 * Records and statistics (GDD §4 Scoring, §7 Result / Stats).
 *
 * - `GameRecords`: the best of ONE game (biggest capture, longest relay chain), shown on
 *   the result screen and kept in the save so a resumed game still has them.
 * - `PlayerStats`: every finished game on this device, kept in localStorage and shown on
 *   the Stats screen. Guarded like settings.ts: storage may be unavailable, and anything
 *   unreadable is replaced by empty stats rather than crashing the menu.
 *
 * No Phaser import: the pure parts are unit-tested (tests/stats.test.ts).
 */
import type { GameMode, Player, Step } from './logic/types';
import { OPPONENTS, type Opponent } from './types/scenes';

// ── One game ────────────────────────────────────────────────────────────────

export interface GameRecords {
  /** Most seeds a single capture put into the store (R6: captured + the last seed), [P1, P2]. */
  maxCapture: [number, number];
  /** Longest relay chain (R5, number of relays) in a single move, [P1, P2]. */
  maxRelay: [number, number];
}

export function emptyGameRecords(): GameRecords {
  return { maxCapture: [0, 0], maxRelay: [0, 0] };
}

/** Fold one move (`steps` of `playMove`, played by `mover`) into the game's records. */
export function addMoveToRecords(records: GameRecords, mover: Player, steps: readonly Step[]): GameRecords {
  const maxCapture: [number, number] = [...records.maxCapture];
  const maxRelay: [number, number] = [...records.maxRelay];
  let relays = 0;
  for (const step of steps) {
    if (step.kind === 'relay') relays += 1;
    else if (step.kind === 'capture') maxCapture[step.player] = Math.max(maxCapture[step.player], step.toStore);
  }
  maxRelay[mover] = Math.max(maxRelay[mover], relays);
  return { maxCapture, maxRelay };
}

/** Records from a save; anything malformed becomes empty records. */
export function parseGameRecords(raw: unknown): GameRecords {
  if (typeof raw !== 'object' || raw === null) return emptyGameRecords();
  const r = raw as Record<string, unknown>;
  const pair = (v: unknown): [number, number] | null =>
    Array.isArray(v) && v.length === 2 && v.every(isCount) ? [v[0] as number, v[1] as number] : null;
  const maxCapture = pair(r.maxCapture);
  const maxRelay = pair(r.maxRelay);
  return maxCapture && maxRelay ? { maxCapture, maxRelay } : emptyGameRecords();
}

// ── Every game on this device ───────────────────────────────────────────────

/** Results for one opponent and mode. Against the AI, P1 is the person (`p1` = wins). */
export interface Tally {
  p1: number;
  p2: number;
  draw: number;
}

export const GAME_MODES: readonly GameMode[] = ['short', 'full'];

export interface PlayerStats {
  results: Record<Opponent, Record<GameMode, Tally>>;
  /** Records by a PERSON (the AI's moves never count). */
  bestCapture: number;
  longestRelay: number;
  /** Largest store difference in a game a person won (resignations excluded). */
  biggestWin: number;
}

export interface FinishedGame {
  opponent: Opponent;
  mode: GameMode;
  winner: Player | null;
  stores: readonly [number, number];
  records: GameRecords;
  resigned: boolean;
}

export function emptyStats(): PlayerStats {
  const results = {} as Record<Opponent, Record<GameMode, Tally>>;
  for (const o of OPPONENTS) results[o] = { short: { p1: 0, p2: 0, draw: 0 }, full: { p1: 0, p2: 0, draw: 0 } };
  return { results, bestCapture: 0, longestRelay: 0, biggestWin: 0 };
}

/** Players who are people: both in a two-player game, only P1 against the AI. */
export function humanPlayers(opponent: Opponent): Player[] {
  return opponent === 'human' ? [0, 1] : [0];
}

/** `stats` with one more finished game counted (returns a new object). */
export function recordGame(stats: PlayerStats, game: FinishedGame): PlayerStats {
  const next: PlayerStats = JSON.parse(JSON.stringify(stats)) as PlayerStats;
  const tally = next.results[game.opponent][game.mode];
  if (game.winner === null) tally.draw += 1;
  else if (game.winner === 0) tally.p1 += 1;
  else tally.p2 += 1;

  const people = humanPlayers(game.opponent);
  for (const p of people) {
    next.bestCapture = Math.max(next.bestCapture, game.records.maxCapture[p]);
    next.longestRelay = Math.max(next.longestRelay, game.records.maxRelay[p]);
  }
  if (!game.resigned && game.winner !== null && people.includes(game.winner)) {
    next.biggestWin = Math.max(next.biggestWin, Math.abs(game.stores[0] - game.stores[1]));
  }
  return next;
}

/** Stats from storage; every field is checked and anything malformed counts as zero. */
export function parseStats(raw: unknown): PlayerStats {
  const stats = emptyStats();
  if (typeof raw !== 'object' || raw === null) return stats;
  const r = raw as Record<string, unknown>;
  if (r.version !== STATS_VERSION) return stats;
  const results = (r.results ?? {}) as Record<string, unknown>;
  for (const o of OPPONENTS) {
    const byMode = (results[o] ?? {}) as Record<string, unknown>;
    for (const m of GAME_MODES) {
      const t = (byMode[m] ?? {}) as Record<string, unknown>;
      stats.results[o][m] = { p1: count(t.p1), p2: count(t.p2), draw: count(t.draw) };
    }
  }
  stats.bestCapture = count(r.bestCapture);
  stats.longestRelay = count(r.longestRelay);
  stats.biggestWin = count(r.biggestWin);
  return stats;
}

export function totalGames(stats: PlayerStats): number {
  let n = 0;
  for (const o of OPPONENTS) for (const m of GAME_MODES) n += stats.results[o][m].p1 + stats.results[o][m].p2 + stats.results[o][m].draw;
  return n;
}

// ── Storage ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'thai-mancala:stats';
const STATS_VERSION = 1;

export function loadStats(): PlayerStats {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? parseStats(JSON.parse(raw)) : emptyStats();
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: PlayerStats): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ version: STATS_VERSION, ...stats }));
  } catch {
    /* storage unavailable: stats only last for this visit */
  }
}

/** Count a finished game and store the result. */
export function saveFinishedGame(game: FinishedGame): void {
  saveStats(recordGame(loadStats(), game));
}

export function clearStats(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

function isCount(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1e9;
}

function count(v: unknown): number {
  return isCount(v) ? (v as number) : 0;
}
