/**
 * Checking a GameState that came back from storage (or, later, from the network).
 * Pure TypeScript: never trust saved data blindly — a corrupted or old save must be
 * rejected, not crash the game or let it play by broken rules.
 */
import { BOARD_SIZE, TOTAL_SEEDS, isStore } from './board';
import { legalMoves } from './rules';
import type { GameState, Player, RoundResult } from './types';

const isPlayer = (v: unknown): v is Player => v === 0 || v === 1;
const isWholeNumber = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function isRoundResult(v: unknown): v is RoundResult {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    isWholeNumber(r.round) &&
    Array.isArray(r.stores) &&
    r.stores.length === 2 &&
    r.stores.every(isWholeNumber) &&
    (r.winner === null || isPlayer(r.winner))
  );
}

/**
 * Returns the state if it is a well-formed game in progress (phase `playing`, 98 seeds,
 * consistent dead pits, a legal move available), otherwise `null`.
 */
export function parseGameState(raw: unknown): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;

  if (s.mode !== 'short' && s.mode !== 'full') return null;
  if (s.ruleset !== 'traditional' && s.ruleset !== 'video') return null;
  if (s.phase !== 'playing') return null;
  if (!isPlayer(s.current) || !isPlayer(s.roundStarter)) return null;
  if (s.winner !== null || s.endReason !== null) return null;
  if (!isWholeNumber(s.maxRounds) || s.maxRounds < 1 || (s.mode === 'short' && s.maxRounds !== 1)) return null;
  if (!isWholeNumber(s.round) || s.round < 1 || s.round > s.maxRounds) return null;
  if (s.lastRound !== null && !isRoundResult(s.lastRound)) return null;

  if (!Array.isArray(s.pits) || s.pits.length !== BOARD_SIZE || !s.pits.every(isWholeNumber)) return null;
  if ((s.pits as number[]).reduce((a, b) => a + b, 0) !== TOTAL_SEEDS) return null;

  if (!Array.isArray(s.dead) || s.dead.length !== BOARD_SIZE || !s.dead.every((d) => typeof d === 'boolean')) return null;
  const pits = s.pits as number[];
  const dead = s.dead as boolean[];
  if (dead.some((d, i) => d && (isStore(i) || pits[i] !== 0))) return null;

  const state: GameState = {
    mode: s.mode,
    ruleset: s.ruleset,
    pits: [...pits],
    dead: [...dead],
    current: s.current,
    phase: 'playing',
    round: s.round,
    maxRounds: s.maxRounds,
    roundStarter: s.roundStarter,
    lastRound: s.lastRound === null ? null : (s.lastRound as RoundResult),
    winner: null,
    endReason: null,
  };
  return legalMoves(state).length > 0 ? state : null;
}
