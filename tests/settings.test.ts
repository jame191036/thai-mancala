import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { DEFAULT_SOW_SPEED, SOW_SPEEDS, loadSowSpeed, nextSowSpeed, parseSowSpeed, saveSowSpeed } from '../src/settings';

/** Just enough of Phaser's DataManager for the settings helpers. */
function fakeRegistry(): Phaser.Data.DataManager {
  const data = new Map<string, unknown>();
  return {
    get: (key: string) => data.get(key),
    set: (key: string, value: unknown) => {
      data.set(key, value);
    },
  } as unknown as Phaser.Data.DataManager;
}

describe('sowing speed setting', () => {
  it('offers ช้ามาก … เร็วมาก, slowest first', () => {
    expect([...SOW_SPEEDS]).toEqual([0.25, 0.5, 1, 2, 4]);
    expect(DEFAULT_SOW_SPEED).toBe(1);
  });

  it('only accepts known speeds; anything else falls back to ปกติ', () => {
    expect(parseSowSpeed(0.5)).toBe(0.5);
    expect(parseSowSpeed(3)).toBe(1);
    expect(parseSowSpeed('2')).toBe(1);
    expect(parseSowSpeed(undefined)).toBe(1);
    expect(parseSowSpeed(null)).toBe(1);
  });

  it('cycles through every speed and wraps round', () => {
    const seen: number[] = [];
    let speed = nextSowSpeed(1);
    for (let i = 0; i < 5; i++) {
      seen.push(speed);
      speed = nextSowSpeed(speed);
    }
    expect(seen).toEqual([2, 4, 0.25, 0.5, 1]);
  });

  it('a saved speed is read back for the session (works without localStorage too)', () => {
    const registry = fakeRegistry();
    expect(loadSowSpeed(registry)).toBe(1);
    saveSowSpeed(registry, 0.25);
    expect(loadSowSpeed(registry)).toBe(0.25);
  });
});
