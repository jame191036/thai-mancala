/**
 * The pure part of pixel text (GDD §10): turn anti-aliased text pixels into 1-bit pixels.
 * No DOM, no Phaser, so it is unit-tested (tests/pixelText.test.ts).
 */

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * RGBA pixels → the same size with every pixel either fully `rgb` (alpha ≥ threshold), the
 * outline colour (an unlit pixel touching a lit one, 8 directions), or transparent.
 */
export function binarize(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
  rgb: Rgb,
  outline?: Rgb,
): Uint8ClampedArray {
  const cut = Math.round(Math.min(1, Math.max(0, threshold)) * 255);
  const lit = new Uint8Array(width * height);
  for (let i = 0; i < lit.length; i++) lit[i] = src[i * 4 + 3] >= cut && src[i * 4 + 3] > 0 ? 1 : 0;

  const out = new Uint8ClampedArray(src.length);
  const paint = (i: number, c: Rgb) => {
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = 255;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (lit[i]) {
        paint(i, rgb);
        continue;
      }
      if (!outline) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1 && !near; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < width && ny < height && lit[ny * width + nx]) near = true;
        }
      }
      if (near) paint(i, outline);
    }
  }
  return out;
}
