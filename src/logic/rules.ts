/**
 * หมากขุม rules engine. Source of truth: docs/GDD.md §3.1 (R1–R16, A1–A6).
 * Never substitute Kalah or Oware rules.
 *
 * Pure TypeScript and deterministic: no Phaser import, no randomness, no mutation of the
 * input state. Every move returns the new state AND the ordered list of steps (every seed
 * placed, every relay, capture, pass, round end) so the UI can animate it later.
 */

import {
  BOARD_SIZE,
  P1_STORE,
  P2_STORE,
  SEEDS_PER_PIT,
  isPitOf,
  isStore,
  nextPosition,
  opposite,
  otherPlayer,
  pitsOf,
  refillOrder,
  storeOf,
} from './board';
import type {
  GameEndReason,
  GameMode,
  GameState,
  MoveResult,
  PitIndex,
  Player,
  RoundResult,
  Step,
} from './types';

/**
 * Safety net only: GDD §3.6 proves a turn always ends (every lap past the mover's own store
 * banks a seed). Hitting this means a bug, so it throws instead of looping forever.
 */
export const MAX_DROPS_PER_TURN = 5000;

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

// ── Creating states ──────────────────────────────────────────────────────────

/** Round limits offered for a full game (R16). The UI shows these choices. */
export const FULL_GAME_ROUND_OPTIONS = [3, 5, 7] as const;
export const DEFAULT_FULL_GAME_ROUNDS = 3;

export interface GameOptions {
  /** Full game only: rounds to play before the seed count decides (R16). Default 3. */
  maxRounds?: number;
}

function resolveMaxRounds(mode: GameMode, maxRounds: number | undefined): number {
  if (mode === 'short') return 1;
  const n = maxRounds ?? DEFAULT_FULL_GAME_ROUNDS;
  if (!Number.isInteger(n) || n < 1) throw new RangeError(`maxRounds must be a whole number >= 1, got ${n}`);
  return n;
}

/**
 * A new game: 7 seeds in each of the 14 small pits, empty stores (R1, R2).
 * `firstPlayer` is chosen by the caller (R11 says random: use `randomPlayer()`), which keeps
 * the engine deterministic for tests, replays and a future online server.
 */
export function createGame(mode: GameMode, firstPlayer: Player, options: GameOptions = {}): GameState {
  const pits = Array.from({ length: BOARD_SIZE }, (_, i) => (isStore(i) ? 0 : SEEDS_PER_PIT));
  return {
    mode,
    pits,
    dead: new Array<boolean>(BOARD_SIZE).fill(false),
    current: firstPlayer,
    phase: 'playing',
    round: 1,
    maxRounds: resolveMaxRounds(mode, options.maxRounds),
    roundStarter: firstPlayer,
    lastRound: null,
    winner: null,
    endReason: null,
  };
}

export interface CustomStateOptions extends GameOptions {
  /** 16 slot values (pits and stores). Need not add up to 98: for tests and tutorials. */
  pits: readonly number[];
  current: Player;
  mode?: GameMode;
  /** Indices of dead pits (must be small pits holding 0 seeds). */
  dead?: readonly PitIndex[];
  round?: number;
  roundStarter?: Player;
}

/** A position set up by hand, e.g. a test fixture or a tutorial board. Always `playing`. */
export function createCustomState(options: CustomStateOptions): GameState {
  const { pits, current, mode = 'short', dead = [], round = 1, roundStarter = current } = options;
  const maxRounds = resolveMaxRounds(mode, options.maxRounds);
  if (!Number.isInteger(round) || round < 1 || round > maxRounds) {
    throw new RangeError(`round must be between 1 and ${maxRounds}, got ${round}`);
  }
  if (pits.length !== BOARD_SIZE) throw new RangeError(`pits must have ${BOARD_SIZE} slots, got ${pits.length}`);
  pits.forEach((n, i) => {
    if (!Number.isInteger(n) || n < 0) throw new RangeError(`pits[${i}] must be a whole number >= 0, got ${n}`);
  });
  const deadFlags = new Array<boolean>(BOARD_SIZE).fill(false);
  for (const i of dead) {
    if (isStore(i) || i < 0 || i >= BOARD_SIZE) throw new RangeError(`dead pit ${i} is not a small pit`);
    if (pits[i] !== 0) throw new RangeError(`dead pit ${i} must be empty, holds ${pits[i]}`);
    deadFlags[i] = true;
  }
  return {
    mode,
    pits: [...pits],
    dead: deadFlags,
    current,
    phase: 'playing',
    round,
    maxRounds,
    roundStarter,
    lastRound: null,
    winner: null,
    endReason: null,
  };
}

/** R11 helper. Inject `rng` for reproducible games. */
export function randomPlayer(rng: () => number = Math.random): Player {
  return rng() < 0.5 ? 0 : 1;
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** Seeds on `player`'s side (small pits only; stores excluded). */
export function seedsOnSide(pits: readonly number[], player: Player): number {
  return pitsOf(player).reduce((sum, i) => sum + pits[i], 0);
}

export function totalSeeds(state: GameState): number {
  return state.pits.reduce((sum, n) => sum + n, 0);
}

/** Pits the current player may choose: own side, not dead, not empty (AC-R16). */
export function legalMoves(state: GameState): PitIndex[] {
  if (state.phase !== 'playing') return [];
  return pitsOf(state.current).filter((i) => !state.dead[i] && state.pits[i] > 0);
}

export function isLegalMove(state: GameState, pit: PitIndex): boolean {
  return (
    state.phase === 'playing' &&
    Number.isInteger(pit) &&
    isPitOf(pit, state.current) &&
    !state.dead[pit] &&
    state.pits[pit] > 0
  );
}

// ── Playing a turn ───────────────────────────────────────────────────────────

/**
 * The current player sows from `pit` (GDD §3.3). Returns the new state and every step.
 * Throws `IllegalMoveError` if the move is not allowed.
 */
export function playMove(state: GameState, pit: PitIndex): MoveResult {
  if (state.phase !== 'playing') throw new IllegalMoveError(`cannot move while phase is "${state.phase}"`);
  if (!isLegalMove(state, pit)) {
    throw new IllegalMoveError(`pit ${pit} is not a legal move for P${state.current + 1}`);
  }

  const player = state.current;
  const store = storeOf(player);
  const pits = [...state.pits];
  const steps: Step[] = [];

  let hand = pits[pit];
  pits[pit] = 0;
  steps.push({ kind: 'pickup', player, pit, seeds: hand });

  let pos = pit;
  let drops = 0;
  let extraTurn = false;

  for (;;) {
    // Sow one seed per slot, counter-clockwise (R3), into own store (R4), skipping the
    // opponent's store (R4) and dead pits (A2). The origin pit is not skipped (A1).
    while (hand > 0) {
      pos = nextPosition(pos, player, state.dead);
      pits[pos] += 1;
      hand -= 1;
      steps.push({ kind: 'drop', player, pit: pos, pitSeeds: pits[pos], handSeeds: hand });
      if (++drops > MAX_DROPS_PER_TURN) {
        throw new Error(`sowing exceeded ${MAX_DROPS_PER_TURN} drops: rules engine bug`);
      }
    }

    // Last seed in own store: move again (R8).
    if (pos === store) {
      extraTurn = true;
      steps.push({ kind: 'extraTurn', player });
      break;
    }

    // Last seed in a pit that already had seeds: pick them all up and keep sowing (R5).
    if (pits[pos] > 1) {
      hand = pits[pos];
      pits[pos] = 0;
      steps.push({ kind: 'relay', player, pit: pos, seeds: hand });
      continue;
    }

    // Last seed in an empty pit.
    if (isPitOf(pos, player)) {
      const opp = opposite(pos);
      if (!state.dead[opp] && pits[opp] > 0) {
        // Capture the opposite pit plus the last seed (R6).
        const captured = pits[opp];
        pits[opp] = 0;
        pits[pos] = 0;
        pits[store] += captured + 1;
        steps.push({ kind: 'capture', player, pit: pos, opposite: opp, captured, toStore: captured + 1 });
        steps.push({ kind: 'turnEnd', player, pit: pos, reason: 'captured' });
      } else {
        // Opposite pit empty or dead: nothing to capture, the seed stays (R6, A2).
        steps.push({ kind: 'turnEnd', player, pit: pos, reason: 'ownEmptyPit' });
      }
    } else {
      // Opponent's empty pit: the seed stays and the turn ends (R7).
      steps.push({ kind: 'turnEnd', player, pit: pos, reason: 'opponentEmptyPit' });
    }
    break;
  }

  return resolveNextTurn(state, pits, player, extraTurn, steps);
}

/** Decide who moves next, applying pass (R9, A6) and round end (R10). */
function resolveNextTurn(
  prev: GameState,
  pits: number[],
  mover: Player,
  extraTurn: boolean,
  steps: Step[],
): MoveResult {
  const candidate = extraTurn ? mover : otherPlayer(mover);
  if (seedsOnSide(pits, candidate) > 0) {
    return { state: { ...prev, pits, current: candidate }, steps };
  }
  const other = otherPlayer(candidate);
  if (seedsOnSide(pits, other) > 0) {
    steps.push({ kind: 'pass', player: candidate });
    return { state: { ...prev, pits, current: other }, steps };
  }
  return endRound(prev, pits, steps);
}

/** All small pits are empty, so every seed is in a store (R10). */
function endRound(prev: GameState, pits: number[], steps: Step[]): MoveResult {
  const stores: [number, number] = [pits[P1_STORE], pits[P2_STORE]];
  const roundWinner: Player | null = stores[0] === stores[1] ? null : stores[0] > stores[1] ? 0 : 1;
  const result: RoundResult = { round: prev.round, stores, winner: roundWinner };
  steps.push({ kind: 'roundEnd', ...result });

  const over = gameOverAfterRound(prev, stores, roundWinner);
  if (!over) {
    return { state: { ...prev, pits, phase: 'roundOver', lastRound: result, winner: null }, steps };
  }
  steps.push({ kind: 'gameOver', winner: over.winner, reason: over.reason });
  return {
    state: { ...prev, pits, phase: 'gameOver', lastRound: result, winner: over.winner, endReason: over.reason },
    steps,
  };
}

/** Does the game end after this round, and who won? `null` = play another round. */
function gameOverAfterRound(
  prev: GameState,
  stores: readonly [number, number],
  roundWinner: Player | null,
): { winner: Player | null; reason: GameEndReason } | null {
  // Short game: more seeds in the store wins; 49:49 is a draw.
  if (prev.mode === 'short') return { winner: roundWinner, reason: 'singleRound' };

  // Full game: a player who cannot fill even one pit loses at once (R15).
  const p1CanFill = stores[0] >= SEEDS_PER_PIT;
  const p2CanFill = stores[1] >= SEEDS_PER_PIT;
  if (!p1CanFill || !p2CanFill) {
    // Both short is impossible with 98 seeds; custom boards fall back to the round result.
    const winner = p1CanFill === p2CanFill ? roundWinner : p1CanFill ? 0 : 1;
    return { winner, reason: 'cannotFill' };
  }

  // Full game: after the last allowed round, more seeds wins; 49:49 is a draw (R16).
  if (prev.round >= prev.maxRounds) return { winner: roundWinner, reason: 'roundLimit' };

  return null;
}

// ── Between rounds (full game) ───────────────────────────────────────────────

/**
 * Full game, `phase === 'roundOver'`: each player refills their pits with 7 seeds from
 * their store, nearest the store first. Pits that cannot be filled are dead for the round,
 * and leftover seeds (< 7) stay in the store (R13, A3, A4). The loser of the last round
 * starts; after a tie, whoever did not start the last round starts (R14, A5).
 */
export function startNextRound(state: GameState): MoveResult {
  if (state.mode !== 'full' || state.phase !== 'roundOver' || !state.lastRound) {
    throw new IllegalMoveError('startNextRound() is only valid in a full game after a round ends');
  }
  const pits = [...state.pits];
  const dead = new Array<boolean>(BOARD_SIZE).fill(false);
  const steps: Step[] = [];

  for (const player of [0, 1] as const) {
    const store = storeOf(player);
    for (const pit of refillOrder(player)) {
      if (pits[store] >= SEEDS_PER_PIT) {
        pits[store] -= SEEDS_PER_PIT;
        pits[pit] += SEEDS_PER_PIT;
        steps.push({ kind: 'refill', player, pit, seeds: SEEDS_PER_PIT });
      } else {
        dead[pit] = true;
        steps.push({ kind: 'deadPit', player, pit });
      }
    }
  }

  const { winner } = state.lastRound;
  const starter: Player = winner === null ? otherPlayer(state.roundStarter) : otherPlayer(winner);
  const round = state.round + 1;
  steps.push({ kind: 'roundStart', round, starter });

  return {
    state: {
      ...state,
      pits,
      dead,
      current: starter,
      phase: 'playing',
      round,
      roundStarter: starter,
      winner: null,
    },
    steps,
  };
}
