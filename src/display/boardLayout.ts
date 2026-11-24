/**
 * Where everything sits on the 480×270 base canvas (GDD §7, §8). Pure: no Phaser import.
 * The bowls are painted into public/assets/board.png by tools/art/board.cjs: keep both in sync.
 *
 *   top bar      y 0–28
 *   P2 counts    y 76 (above the board)
 *   board image  x 0–480, y 75–195 (the boat itself: x 5–474, y 85–190)
 *   P2 store     circle r 29 at (52, 135)  (left, P2's right hand)     P1 store at (428, 135)
 *   pits         circles r 20 in 7 cells of 44 px; top row y 112 (P2), bottom row y 158 (P1)
 *   P1 counts    y 200 (below the board)
 *   bottom bar   y 228–270
 */
import { P1_STORE, P2_STORE } from '../logic/board';
import type { PitIndex } from '../logic/types';

export const LAYOUT = {
  board: { x: 0, y: 75, width: 480, height: 120 },
  pitRadius: 20,
  /** Touch target per pit (AC-UI2: at least 44×44 base px). */
  cell: { width: 44, height: 46 },
  firstCellCenterX: 108,
  topRowY: 112,
  bottomRowY: 158,
  store: { radius: 29, centerY: 135, p2CenterX: 52, p1CenterX: 428 },
  /** Seed counts sit outside the board, so they never cover the marbles. */
  count: { p2Y: 76, p1Y: 200, storeP2Y: 74, storeP1Y: 196 },
  /** The hand hovers at the inner edge of the pit it is dropping into. */
  handOffsetY: 16,
} as const;

export interface Point {
  x: number;
  y: number;
}

/** Centre of a pit or store on screen. P2's pits 8→14 run right→left along the top row. */
export function slotPosition(index: PitIndex): Point {
  if (index === P1_STORE) return { x: LAYOUT.store.p1CenterX, y: LAYOUT.store.centerY };
  if (index === P2_STORE) return { x: LAYOUT.store.p2CenterX, y: LAYOUT.store.centerY };
  if (Number.isInteger(index) && index >= 0 && index <= 6) {
    return { x: LAYOUT.firstCellCenterX + LAYOUT.cell.width * index, y: LAYOUT.bottomRowY };
  }
  if (Number.isInteger(index) && index >= 8 && index <= 14) {
    return { x: LAYOUT.firstCellCenterX + LAYOUT.cell.width * (14 - index), y: LAYOUT.topRowY };
  }
  throw new RangeError(`no board slot ${index}`);
}

/** Where the number of seeds of a slot is written: above the board for P2, below for P1. */
export function countPosition(index: PitIndex): Point {
  const { x } = slotPosition(index);
  const { count } = LAYOUT;
  if (index === P1_STORE) return { x, y: count.storeP1Y };
  if (index === P2_STORE) return { x, y: count.storeP2Y };
  return { x, y: index <= 6 ? count.p1Y : count.p2Y };
}

/** Where the seed-carrying hand hovers over a slot: toward the middle of the board. */
export function handPosition(index: PitIndex): Point {
  const p = slotPosition(index);
  if (index === P1_STORE || index === P2_STORE) return p;
  return { x: p.x, y: index <= 6 ? p.y - LAYOUT.handOffsetY : p.y + LAYOUT.handOffsetY };
}
