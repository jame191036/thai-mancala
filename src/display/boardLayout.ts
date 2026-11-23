/**
 * Where everything sits on the 480×270 base canvas (GDD §7, §8). Pure: no Phaser import.
 *
 *   top bar      y 0–28
 *   board frame  x 26–454, y 62–208
 *   P2 store     x 34–78   (left, P2's right hand)     P1 store x 402–446 (right)
 *   pit cells    7 × 44 px from x 86 to 394; top row y≈106 (P2), bottom row y≈164 (P1)
 *   bottom bar   y 228–270
 */
import { P1_STORE, P2_STORE } from '../logic/board';
import type { PitIndex } from '../logic/types';

export const LAYOUT = {
  board: { x: 26, y: 62, width: 428, height: 146 },
  pitRadius: 15,
  /** Touch target per pit (AC-UI2: at least 44×44 base px). */
  cell: { width: 44, height: 52 },
  firstCellCenterX: 108,
  topRowY: 106,
  bottomRowY: 164,
  store: { width: 44, height: 120, centerY: 135, p2CenterX: 56, p1CenterX: 424 },
  /** The "hand" carrying seeds travels in the gap between the two rows. */
  handOffsetY: 24,
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

/** Where the seed-carrying hand hovers over a slot: in the gap between the rows. */
export function handPosition(index: PitIndex): Point {
  const p = slotPosition(index);
  if (index === P1_STORE || index === P2_STORE) return p;
  return { x: p.x, y: index <= 6 ? p.y - LAYOUT.handOffsetY : p.y + LAYOUT.handOffsetY };
}
