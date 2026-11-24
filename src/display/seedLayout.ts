/**
 * Where the marbles lie inside a pit or store (GDD §6). Pure: no Phaser import.
 *
 * Seed k of a slot always lies in the same place, so adding or taking one never reshuffles
 * the others. The bottom layer is rings around one in the middle; when it is full, smaller
 * layers lie on top of it. A slot with more seeds than it has places simply looks full —
 * the number beside it is always exact.
 */
import { isStore } from '../logic/board';
import type { PitIndex } from '../logic/types';
import { LAYOUT } from './boardLayout';

/** Marble diameter in base px (its sprite adds a shadow). */
export const SEED_SIZE = 6;
export const SEED_VARIANTS = 4;

export interface SeedSpot {
  /** Whole pixels from the slot's centre to the marble's centre. */
  dx: number;
  dy: number;
  /** 0 = lying in the bowl, 1+ = on top of the layer below. */
  layer: number;
  /** Which of the four marbles. */
  variant: number;
}

const RING_STEP = 6.7;
/** Marbles per ring: 1 in the middle, then as many as fit around it. */
const RINGS = [1, 6, 12, 18];
/** How many rings each layer has. */
const PIT_LAYERS = [3, 2];
const STORE_LAYERS = [4, 3, 2];

/** Seats of a ring, each one as far as possible from those already taken. */
function ringOrder(n: number): number[] {
  const order = [0];
  while (order.length < n) {
    let best = 0;
    let bestGap = -1;
    for (let seat = 0; seat < n; seat++) {
      const gap = Math.min(...order.map((o) => Math.min(Math.abs(seat - o), n - Math.abs(seat - o))));
      if (gap > bestGap) [best, bestGap] = [seat, gap];
    }
    order.push(best);
  }
  return order;
}

/** A repeatable number in [0, 1). */
function hash(a: number, b: number): number {
  let h = Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function build(index: PitIndex): SeedSpot[] {
  const layers = isStore(index) ? STORE_LAYERS : PIT_LAYERS;
  const spots: SeedSpot[] = [];
  layers.forEach((rings, layer) => {
    for (let r = 0; r < rings; r++) {
      const n = RINGS[r];
      const turn = hash(index, layer * 10 + r) * Math.PI * 2;
      for (const seat of ringOrder(n)) {
        const angle = turn + (seat / n) * Math.PI * 2;
        spots.push({
          dx: Math.round(Math.cos(angle) * r * RING_STEP),
          dy: Math.round(Math.sin(angle) * r * RING_STEP) - layer * 2,
          layer,
          variant: Math.floor(hash(index * 97 + 13, spots.length) * SEED_VARIANTS),
        });
      }
    }
  });
  return spots;
}

const cache = new Map<PitIndex, readonly SeedSpot[]>();

/** Places for the first seeds of a slot, in order; as many as can be shown. */
export function seedSpots(index: PitIndex): readonly SeedSpot[] {
  let spots = cache.get(index);
  if (!spots) {
    spots = build(index);
    cache.set(index, spots);
  }
  return spots;
}

/** How far a marble's centre may be from the slot's centre and still lie inside the bowl. */
export function bowlReach(index: PitIndex): number {
  return (isStore(index) ? LAYOUT.store.radius : LAYOUT.pitRadius) - SEED_SIZE / 2;
}
