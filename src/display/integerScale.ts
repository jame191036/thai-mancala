/**
 * Integer scaling measured in DEVICE pixels (GDD §10).
 *
 * The canvas backing store stays at the base resolution (480×270). We pick the largest
 * whole number `k` such that the game, drawn at k×k device pixels per game pixel, still
 * fits the available area. Phaser then displays the canvas at `zoom = k / dpr` CSS pixels
 * per game pixel, so every game pixel lands on exactly k×k physical pixels and stays crisp.
 *
 * Pure function: no DOM or Phaser access, so it is unit-testable.
 */

export const BASE_WIDTH = 480;
export const BASE_HEIGHT = 270;

export interface IntegerScale {
  /** Whole-number device pixels per game pixel (always ≥ 1). */
  k: number;
  /** CSS pixels per game pixel, for `game.scale.setZoom()`. */
  zoom: number;
}

// Guards against float error such as 3.9999999 for a viewport that is exactly 4× the base.
const EPSILON = 1e-6;

export function computeIntegerScale(
  viewWidthCss: number,
  viewHeightCss: number,
  devicePixelRatio: number,
  baseWidth = BASE_WIDTH,
  baseHeight = BASE_HEIGHT,
): IntegerScale {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const fitX = (viewWidthCss * dpr) / baseWidth;
  const fitY = (viewHeightCss * dpr) / baseHeight;
  const fit = Math.min(fitX, fitY);
  const k = Number.isFinite(fit) ? Math.max(1, Math.floor(fit + EPSILON)) : 1;
  return { k, zoom: k / dpr };
}
