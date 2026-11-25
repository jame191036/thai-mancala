/**
 * The small board on the title screen (GDD §7): where its bowls are and where each marble lies
 * in them. Pure: no Phaser import. The board is painted into title-board.png by
 * tools/art/titleboard.cjs: keep both in sync.
 */
import { P1_STORE, P2_STORE, isStore } from '../logic/board';
import type { PitIndex } from '../logic/types';

export const TITLE_BOARD = {
  /** Top edge of title-board.png (480 wide: the board and its shadow). */
  imageY: 188,
  centerX: 240,
  cellWidth: 34,
  topRowY: 210,
  bottomRowY: 238,
  pit: { rx: 15, ry: 11 },
  store: { rx: 21, ry: 17, y: 224, p2X: 92, p1X: 388 },
} as const;

export const TITLE_SEED_VARIANTS = 4;
/** The board is seen at an angle: circles of marbles are this much flatter. */
const FLAT = 0.74;

export interface TitleSpot {
  x: number;
  y: number;
  variant: number;
  /** 0 lies in the bowl, 1 lies on the others. */
  layer: 0 | 1;
}

/** Centre of a pit or store. P2's pits 8→14 run right→left along the top row. */
export function titleSlot(i: PitIndex): { x: number; y: number } {
  const b = TITLE_BOARD;
  if (i === P1_STORE) return { x: b.store.p1X, y: b.store.y };
  if (i === P2_STORE) return { x: b.store.p2X, y: b.store.y };
  if (i >= 0 && i <= 6) return { x: b.centerX + (i - 3) * b.cellWidth, y: b.bottomRowY };
  if (i >= 8 && i <= 14) return { x: b.centerX + (11 - i) * b.cellWidth, y: b.topRowY };
  throw new RangeError(`no title slot ${i}`);
}

interface Ring {
  count: number;
  r: number;
  turn: number;
  layer: 0 | 1;
  lift: number;
}
/** One marble in the middle, then rings: touching marbles, a second layer, the outer ring. */
const PIT_RINGS: readonly Ring[] = [
  { count: 6, r: 5.2, turn: 0, layer: 0, lift: 0 },
  { count: 7, r: 3, turn: 0.4, layer: 1, lift: -2 },
  { count: 12, r: 10, turn: 0.2, layer: 0, lift: 0 },
];
const STORE_RINGS: readonly Ring[] = [
  { count: 6, r: 5.6, turn: 0, layer: 0, lift: 0 },
  { count: 12, r: 10.4, turn: 0.4, layer: 0, lift: 0 },
  { count: 18, r: 15, turn: 0.1, layer: 0, lift: 0 },
  { count: 7, r: 4, turn: 0.4, layer: 1, lift: -3 },
];
const total = (rings: readonly Ring[]) => 1 + rings.reduce((n, r) => n + r.count, 0);
export const TITLE_PIT_CAPACITY = total(PIT_RINGS);
export const TITLE_STORE_CAPACITY = total(STORE_RINGS);

export function titleCapacity(i: PitIndex): number {
  return isStore(i) ? TITLE_STORE_CAPACITY : TITLE_PIT_CAPACITY;
}

/** Where the k-th marble of slot `i` lies (always the same place). */
export function titleSpot(i: PitIndex, k: number): TitleSpot {
  const c = titleSlot(i);
  const variant = (i * 3 + k * 5) % TITLE_SEED_VARIANTS;
  if (k === 0) return { ...c, variant, layer: 0 };
  let n = k - 1;
  for (const ring of isStore(i) ? STORE_RINGS : PIT_RINGS) {
    if (n < ring.count) {
      const a = (n / ring.count) * Math.PI * 2 + ring.turn + (ring.layer === 0 ? i * 0.7 : 0);
      return { x: c.x + Math.cos(a) * ring.r, y: c.y + Math.sin(a) * ring.r * FLAT + ring.lift, variant, layer: ring.layer };
    }
    n -= ring.count;
  }
  throw new RangeError(`slot ${i} has no place for marble ${k}`);
}
