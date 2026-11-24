/** Colours from GDD §8 (palette may still be tuned once real art exists). */
export const COLORS = {
  background: 0x1e1a2b,
  woodDark: 0x5a3a22,
  woodMid: 0x8b5a2b,
  woodLight: 0xc08a4e,
  pitShadow: 0x3a2416,
  seed: 0x6b3b1f,
  seedLight: 0xa8673a,
  gold: 0xe0b040,
  cream: 0xf3e9d2,
  p1: 0x3fa7b5,
  p2: 0xe07a3a,
  dead: 0x8c2f39,
} as const;

/** The same colours as CSS strings, for Text objects. */
export const CSS = {
  background: '#1E1A2B',
  woodDark: '#5A3A22',
  pitShadow: '#3A2416',
  gold: '#E0B040',
  cream: '#F3E9D2',
  dim: '#9C8F7A',
  p1: '#3FA7B5',
  p2: '#E07A3A',
  dead: '#8C2F39',
  /** 1-pixel edge around text lying on the bamboo or the board. */
  textEdge: '#140E0A',
} as const;

/** Index by Player (0 = P1 bottom, 1 = P2 top). */
export const PLAYER_COLOR = [COLORS.p1, COLORS.p2] as const;
export const PLAYER_CSS = [CSS.p1, CSS.p2] as const;
export const PLAYER_NAME = ['ผู้เล่น 1', 'ผู้เล่น 2'] as const;

/**
 * Font stack for all text (GDD §10): Mali (bundled, see fonts.ts); sans-serif only
 * for the few symbols it lacks (arrows, ≡, ▶). Draw text with PixelText, not Phaser Text.
 */
export const FONT = '"Mali", sans-serif';
