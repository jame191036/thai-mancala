/**
 * Board geometry for หมากขุม (GDD §3.2). Pure TypeScript: never import Phaser here.
 *
 *          [14] [13] [12] [11] [10]  [9]  [8]     <- P2 pits
 *   [15]                                         [7]
 *  P2 store                                    P1 store
 *          [0]  [1]  [2]  [3]  [4]  [5]  [6]      <- P1 pits
 *
 *  Both players sow counter-clockwise (R3): P1 0→6→7→8→14→(skip 15)→0,
 *  P2 8→14→15→0→6→(skip 7)→8. Each player's store is on their right.
 */

import type { PitIndex, Player } from './types';

export const PITS_PER_SIDE = 7;
export const SEEDS_PER_PIT = 7;
export const BOARD_SIZE = 16;
export const TOTAL_SEEDS = PITS_PER_SIDE * 2 * SEEDS_PER_PIT; // 98

export const P1: Player = 0;
export const P2: Player = 1;
export const P1_STORE: PitIndex = 7;
export const P2_STORE: PitIndex = 15;

export function otherPlayer(player: Player): Player {
  return player === 0 ? 1 : 0;
}

export function storeOf(player: Player): PitIndex {
  return player === 0 ? P1_STORE : P2_STORE;
}

export function isStore(index: PitIndex): boolean {
  return index === P1_STORE || index === P2_STORE;
}

function firstPitOf(player: Player): PitIndex {
  return player === 0 ? 0 : 8;
}

/** The 7 small pits of `player`, in sowing order. */
export function pitsOf(player: Player): PitIndex[] {
  const first = firstPitOf(player);
  return Array.from({ length: PITS_PER_SIDE }, (_, i) => first + i);
}

export function isPitOf(index: PitIndex, player: Player): boolean {
  const first = firstPitOf(player);
  return index >= first && index < first + PITS_PER_SIDE;
}

/** The small pit directly across the board (R6). */
export function opposite(index: PitIndex): PitIndex {
  if (!Number.isInteger(index) || index < 0 || index > 14 || index === P1_STORE) {
    throw new RangeError(`opposite() needs a small pit index, got ${index}`);
  }
  return 14 - index;
}

/**
 * The next slot a seed goes into when `mover` sows from `index`: one step counter-clockwise,
 * skipping the opponent's store (R4) and dead pits (A2). The origin pit is NOT skipped (A1).
 * Always terminates because the mover's own store is never skipped.
 */
export function nextPosition(index: PitIndex, mover: Player, dead: readonly boolean[]): PitIndex {
  const skipStore = storeOf(otherPlayer(mover));
  let next = index;
  do {
    next = (next + 1) % BOARD_SIZE;
  } while (next === skipStore || dead[next]);
  return next;
}

/** Order in which a player refills pits between rounds: nearest own store first (R13). */
export function refillOrder(player: Player): PitIndex[] {
  return pitsOf(player).reverse();
}
