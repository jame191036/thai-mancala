import { describe, expect, it } from 'vitest';

// GDD §10 (owner's choice 2026-11-24): every text is PixelText (Mali as 1-bit
// pixels). Phaser's own Text is anti-aliased and looks blurry at the integer zoom, so it
// must not creep back in.
const sources = import.meta.glob(['../src/**/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('all text is pixel text', () => {
  it('finds the scenes', () => {
    expect(Object.keys(sources).some((f) => f.includes('/scenes/'))).toBe(true);
  });

  it.each(Object.entries(sources))('%s does not create Phaser Text', (_file, source) => {
    expect(source).not.toMatch(/\.add\s*\.text\s*\(|new\s+Phaser\.GameObjects\.Text\b|fontFamily\s*:/);
  });
});
