/** 1-bit text (GDD §10 prototype): every pixel ends fully on, outline, or transparent. */
import { describe, expect, it } from 'vitest';
import { binarize, hexToRgb } from '../src/display/binarize';

/** A width×height RGBA image whose alpha values are `alphas` (row by row). */
function image(alphas: number[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(alphas.length * 4);
  alphas.forEach((a, i) => {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = a;
  });
  return data;
}

const alphaOf = (data: Uint8ClampedArray) => Array.from({ length: data.length / 4 }, (_, i) => data[i * 4 + 3]);
const colorOf = (data: Uint8ClampedArray, i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];

describe('binarize', () => {
  it('lights a pixel only at or above the threshold, in the given colour', () => {
    const out = binarize(image([0, 100, 127, 128, 255]), 5, 1, 0.5, [224, 176, 64]);
    expect(alphaOf(out)).toEqual([0, 0, 0, 255, 255]);
    expect(colorOf(out, 3)).toEqual([224, 176, 64]);
  });

  it('a lower threshold makes text bolder', () => {
    expect(alphaOf(binarize(image([60, 100, 200]), 3, 1, 0.35, [1, 2, 3]))).toEqual([0, 255, 255]);
  });

  it('never leaves a half-transparent pixel', () => {
    const alphas = Array.from({ length: 64 }, (_, i) => i * 4);
    expect(alphaOf(binarize(image(alphas), 8, 8, 0.5, [1, 2, 3])).every((a) => a === 0 || a === 255)).toBe(true);
  });

  it('outline: unlit pixels touching a lit one (8 directions) get the outline colour', () => {
    // 3 × 3 with only the centre lit: the 8 neighbours become outline.
    const out = binarize(image([0, 0, 0, 0, 255, 0, 0, 0, 0]), 3, 3, 0.5, [9, 9, 9], [1, 1, 1]);
    expect(alphaOf(out)).toEqual(new Array(9).fill(255));
    expect(colorOf(out, 4)).toEqual([9, 9, 9]);
    expect(colorOf(out, 0)).toEqual([1, 1, 1]);
  });

  it('outline does not reach two pixels away', () => {
    const out = binarize(image([255, 0, 0]), 3, 1, 0.5, [9, 9, 9], [1, 1, 1]);
    expect(alphaOf(out)).toEqual([255, 255, 0]);
  });

  it('reads #RRGGBB colours', () => {
    expect(hexToRgb('#E0B040')).toEqual([224, 176, 64]);
    expect(hexToRgb('3A2416')).toEqual([58, 36, 22]);
  });
});
