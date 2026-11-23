import { describe, expect, it } from 'vitest';

// GDD §10 / CLAUDE.md: game rules are pure TypeScript so they can be unit-tested, run in a
// Web Worker for the AI, and reused on a server later. Phaser must never leak in.
const sources = import.meta.glob(['../src/logic/*.ts', '../src/ai/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

describe('src/logic and src/ai are pure TypeScript (no Phaser)', () => {
  it('finds the logic files', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(3);
  });

  it.each(Object.entries(sources))('%s does not import Phaser', (_file, source) => {
    expect(source).not.toMatch(/from\s+['"]phaser['"]|import\s*\(\s*['"]phaser['"]\s*\)|require\(\s*['"]phaser['"]\s*\)/);
  });
});
