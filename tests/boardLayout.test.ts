import { describe, expect, it } from 'vitest';
import { BASE_HEIGHT, BASE_WIDTH } from '../src/display/integerScale';
import { LAYOUT, handPosition, slotPosition } from '../src/display/boardLayout';
import { opposite } from '../src/logic/board';

const pits = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14];

describe('board layout (GDD §7/§8)', () => {
  it('AC-UI2: every pit has a touch target of at least 44×44 base px', () => {
    expect(LAYOUT.cell.width).toBeGreaterThanOrEqual(44);
    expect(LAYOUT.cell.height).toBeGreaterThanOrEqual(44);
  });

  it('pit touch targets never overlap', () => {
    for (const a of pits) {
      for (const b of pits) {
        if (a === b) continue;
        const pa = slotPosition(a);
        const pb = slotPosition(b);
        const apartX = Math.abs(pa.x - pb.x) >= LAYOUT.cell.width;
        const apartY = Math.abs(pa.y - pb.y) >= LAYOUT.cell.height;
        expect(apartX || apartY, `pits ${a} and ${b}`).toBe(true);
      }
    }
  });

  it('P1 row runs left→right (0→6) at the bottom, P2 row right→left (8→14) at the top', () => {
    expect([0, 6].map((i) => slotPosition(i).x)).toEqual([108, 372]);
    expect(slotPosition(8)).toEqual({ x: 372, y: LAYOUT.topRowY });
    expect(slotPosition(14)).toEqual({ x: 108, y: LAYOUT.topRowY });
    expect(slotPosition(3).y).toBe(LAYOUT.bottomRowY);
  });

  it('opposite pits sit in the same column', () => {
    for (let i = 0; i <= 6; i++) expect(slotPosition(opposite(i)).x).toBe(slotPosition(i).x);
  });

  it('each player store is on their right: P1 store right, P2 store left', () => {
    expect(slotPosition(7).x).toBeGreaterThan(slotPosition(6).x);
    expect(slotPosition(15).x).toBeLessThan(slotPosition(14).x);
  });

  it('everything fits inside the 480×270 canvas and the board frame', () => {
    const { board } = LAYOUT;
    for (let i = 0; i < 16; i++) {
      const p = slotPosition(i);
      expect(p.x).toBeGreaterThan(board.x);
      expect(p.x).toBeLessThan(board.x + board.width);
      expect(p.y).toBeGreaterThan(board.y);
      expect(p.y).toBeLessThan(board.y + board.height);
      const h = handPosition(i);
      expect(h.x).toBeLessThan(BASE_WIDTH);
      expect(h.y).toBeLessThan(BASE_HEIGHT);
    }
  });

  it('the hand travels in the gap between the rows', () => {
    for (const i of pits) {
      const y = handPosition(i).y;
      expect(y).toBeGreaterThan(LAYOUT.topRowY + LAYOUT.pitRadius);
      expect(y).toBeLessThan(LAYOUT.bottomRowY - LAYOUT.pitRadius);
    }
  });

  it('rejects slots that do not exist', () => {
    expect(() => slotPosition(16)).toThrow(RangeError);
    expect(() => slotPosition(-1)).toThrow(RangeError);
  });
});
