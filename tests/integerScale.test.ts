import { describe, expect, it } from 'vitest';
import { computeIntegerScale } from '../src/display/integerScale';

// AC-UI1 (docs/acceptance-criteria.md): the displayed size times dpr is always a whole
// multiple of 480×270, and these reference viewports give these k values.
describe('integer scale (device pixels)', () => {
  it.each([
    // [viewport CSS w, h, dpr, expected k]
    [844, 390, 3, 4], // iPhone landscape, PWA full screen
    [1920, 1080, 1, 4], // desktop full screen
    [1366, 657, 1, 2], // 1366×768 laptop with browser chrome
    [1920, 969, 1, 3], // FHD desktop with browser chrome
    [915, 412, 2.625, 4], // Android landscape full screen
    [844, 340, 3, 3], // iPhone Safari with toolbar
  ])('%i×%i @ dpr %s → k = %i', (w, h, dpr, k) => {
    expect(computeIntegerScale(w, h, dpr).k).toBe(k);
  });

  it('maps each game pixel to exactly k device pixels', () => {
    const { k, zoom } = computeIntegerScale(915, 412, 2.625);
    expect(480 * zoom * 2.625).toBeCloseTo(480 * k, 9);
    expect(270 * zoom * 2.625).toBeCloseTo(270 * k, 9);
  });

  it('never goes below 1× even on a tiny viewport', () => {
    expect(computeIntegerScale(300, 200, 1).k).toBe(1);
  });

  it('does not floor an exact fit down because of float error', () => {
    expect(computeIntegerScale(1536, 864, 1.25).k).toBe(4); // 1920×1080 device px
  });

  it('falls back to dpr 1 for invalid ratios', () => {
    expect(computeIntegerScale(960, 540, 0).k).toBe(2);
    expect(computeIntegerScale(960, 540, Number.NaN).k).toBe(2);
  });
});
