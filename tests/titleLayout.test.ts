import { describe, expect, it } from 'vitest';
import { BOARD_SIZE, isStore } from '../src/logic/board';
import { TITLE_BOARD, TITLE_PIT_CAPACITY, TITLE_STORE_CAPACITY, titleCapacity, titleSlot, titleSpot } from '../src/display/titleLayout';

const slots = Array.from({ length: BOARD_SIZE }, (_, i) => i);

describe('title board layout', () => {
  it('lays the bowls out like the game board: opposite pits above each other', () => {
    for (let i = 0; i <= 6; i++) {
      expect(titleSlot(i).x).toBe(titleSlot(14 - i).x);
      expect(titleSlot(i).y).toBeGreaterThan(titleSlot(14 - i).y);
    }
    expect(titleSlot(7).x).toBeGreaterThan(titleSlot(6).x); // P1's store on the right
    expect(titleSlot(15).x).toBeLessThan(titleSlot(14).x);
    expect(() => titleSlot(16)).toThrow(RangeError);
  });

  it('keeps every marble inside its bowl', () => {
    for (const i of slots) {
      const c = titleSlot(i);
      const bowl = isStore(i) ? TITLE_BOARD.store : TITLE_BOARD.pit;
      for (let k = 0; k < titleCapacity(i); k++) {
        const s = titleSpot(i, k);
        // The marble's 5×5 body, 2 px either way of its centre.
        const far = Math.hypot((Math.abs(s.x - c.x) + 2) / bowl.rx, (Math.abs(s.y - c.y) + 2) / bowl.ry);
        expect(far, `slot ${i} marble ${k}`).toBeLessThanOrEqual(1.02);
      }
    }
  });

  it('gives marbles of one layer room, and always the same place', () => {
    for (const i of slots) {
      const spots = Array.from({ length: titleCapacity(i) }, (_, k) => titleSpot(i, k));
      expect(spots).toEqual(Array.from({ length: titleCapacity(i) }, (_, k) => titleSpot(i, k)));
      spots.forEach((a, k) => {
        for (const b of spots.slice(k + 1)) if (a.layer === b.layer && a.layer === 0) expect(Math.hypot(a.x - b.x, (a.y - b.y) / 0.74)).toBeGreaterThan(3.4);
      });
    }
  });

  it('has room for a starting pit many times over', () => {
    expect(TITLE_PIT_CAPACITY).toBe(26);
    expect(TITLE_STORE_CAPACITY).toBe(44);
    expect(() => titleSpot(0, TITLE_PIT_CAPACITY)).toThrow(RangeError);
  });
});
