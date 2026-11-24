/** Marbles inside the bowls (GDD §6): always inside, never on top of each other, never reshuffled. */
import { describe, expect, it } from 'vitest';
import { SEED_SIZE, SEED_VARIANTS, bowlReach, seedSpots } from '../src/display/seedLayout';

const slots = [...Array(16).keys()];

describe('seed layout', () => {
  it.each(slots)('slot %i: every marble lies inside its bowl', (i) => {
    for (const s of seedSpots(i)) expect(Math.hypot(s.dx, s.dy), JSON.stringify(s)).toBeLessThanOrEqual(bowlReach(i));
  });

  it.each(slots)('slot %i: marbles of one layer do not cover each other', (i) => {
    const spots = seedSpots(i);
    for (let a = 0; a < spots.length; a++) {
      for (let b = a + 1; b < spots.length; b++) {
        if (spots[a].layer !== spots[b].layer) continue;
        expect(Math.hypot(spots[a].dx - spots[b].dx, spots[a].dy - spots[b].dy)).toBeGreaterThanOrEqual(SEED_SIZE - 1);
      }
    }
  });

  it('whole pixels only, and only the four marbles that exist', () => {
    for (const i of slots) {
      for (const s of seedSpots(i)) {
        expect(Number.isInteger(s.dx) && Number.isInteger(s.dy)).toBe(true);
        expect(s.variant).toBeGreaterThanOrEqual(0);
        expect(s.variant).toBeLessThan(SEED_VARIANTS);
      }
    }
  });

  it('a pit shows at least 25 marbles, a store at least 60', () => {
    expect(seedSpots(3).length).toBeGreaterThanOrEqual(25);
    expect(seedSpots(7).length).toBeGreaterThanOrEqual(60);
  });

  it('the first marbles are balanced around the middle (7 = a full first ring)', () => {
    for (const i of slots) {
      const seven = seedSpots(i).slice(0, 7);
      expect(Math.abs(seven.reduce((n, s) => n + s.dx, 0))).toBeLessThanOrEqual(3);
      expect(Math.abs(seven.reduce((n, s) => n + s.dy, 0))).toBeLessThanOrEqual(3);
    }
  });

  it('a half-full outer ring is spread all around, not lined up on one side', () => {
    for (const i of slots) {
      const ring = seedSpots(i).slice(7, 13); // first 6 of the outer ring of 12
      const angles = ring.map((s) => Math.atan2(s.dy, s.dx)).sort((a, b) => a - b);
      const gaps = angles.map((a, k) => (k ? a - angles[k - 1] : a + Math.PI * 2 - angles[angles.length - 1]));
      expect(Math.max(...gaps)).toBeLessThan((Math.PI * 2) / 3);
    }
  });

  it('the same seed always lies in the same place', () => {
    expect(seedSpots(5)).toBe(seedSpots(5));
  });
});
