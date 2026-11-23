import { BOARD_SIZE, storeOf } from '../src/logic/board';
import type { PitIndex, Step } from '../src/logic/types';

/** 16-slot board from a sparse map, e.g. `board({ 4: 3, 8: 1 })`; other slots are 0. */
export function board(values: Record<number, number>): number[] {
  const pits = new Array<number>(BOARD_SIZE).fill(0);
  for (const [k, v] of Object.entries(values)) pits[Number(k)] = v;
  return pits;
}

export const sum = (pits: readonly number[]): number => pits.reduce((a, b) => a + b, 0);

/** Pits where seeds were dropped, in order. */
export const dropPath = (steps: readonly Step[]): PitIndex[] =>
  steps.flatMap((s) => (s.kind === 'drop' ? [s.pit] : []));

export const kinds = (steps: readonly Step[]): string[] => steps.map((s) => s.kind);

/**
 * Re-applies the steps to the board they started from. If the result equals the engine's
 * new `pits`, the step list fully describes the move, which is what the sowing animation
 * relies on. Throws on any inconsistency (wrong counts, seeds left in hand, …).
 */
export function replaySteps(before: readonly number[], steps: readonly Step[]): number[] {
  const pits = [...before];
  let hand = 0;
  steps.forEach((s, n) => {
    const fail = (why: string) => {
      throw new Error(`step ${n} (${s.kind}): ${why}`);
    };
    switch (s.kind) {
      case 'pickup':
        if (hand !== 0) fail(`hand not empty (${hand})`);
        if (pits[s.pit] !== s.seeds) fail(`pit ${s.pit} holds ${pits[s.pit]}, step says ${s.seeds}`);
        pits[s.pit] = 0;
        hand = s.seeds;
        break;
      case 'drop':
        pits[s.pit] += 1;
        hand -= 1;
        if (pits[s.pit] !== s.pitSeeds) fail(`pit ${s.pit} holds ${pits[s.pit]}, step says ${s.pitSeeds}`);
        if (hand !== s.handSeeds) fail(`hand holds ${hand}, step says ${s.handSeeds}`);
        break;
      case 'relay':
        if (hand !== 0) fail(`relay with ${hand} seeds still in hand`);
        if (pits[s.pit] !== s.seeds) fail(`pit ${s.pit} holds ${pits[s.pit]}, step says ${s.seeds}`);
        pits[s.pit] = 0;
        hand = s.seeds;
        break;
      case 'capture':
        if (pits[s.pit] !== 1) fail(`capturing pit ${s.pit} should hold 1, holds ${pits[s.pit]}`);
        if (pits[s.opposite] !== s.captured) fail(`opposite ${s.opposite} holds ${pits[s.opposite]}`);
        if (s.toStore !== s.captured + 1) fail('toStore must be captured + 1');
        pits[s.pit] = 0;
        pits[s.opposite] = 0;
        pits[storeOf(s.player)] += s.toStore;
        break;
      case 'refill':
        pits[storeOf(s.player)] -= s.seeds;
        pits[s.pit] += s.seeds;
        break;
      case 'sweep':
        if (pits[s.pit] !== s.seeds) fail(`pit ${s.pit} holds ${pits[s.pit]}, sweep says ${s.seeds}`);
        pits[s.pit] = 0;
        pits[storeOf(s.player)] += s.seeds;
        break;
      default:
        break;
    }
  });
  if (hand !== 0) throw new Error(`${hand} seeds left in hand after the last step`);
  return pits;
}
