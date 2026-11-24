import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import {
  DEFAULT_SOW_SPEED,
  FACING,
  REDUCED_MOTION,
  SOW_SPEEDS,
  VIBRATION,
  loadFlag,
  loadFullGameRounds,
  loadGameMode,
  loadRuleset,
  loadSowSpeed,
  loadTouchConfirm,
  nextSowSpeed,
  parseFlag,
  parseFullGameRounds,
  parseGameMode,
  parseRuleset,
  parseSowSpeed,
  parseTouchConfirm,
  saveFlag,
  saveFullGameRounds,
  saveGameMode,
  saveRuleset,
  saveSowSpeed,
  saveTouchConfirm,
} from '../src/settings';

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

describe('full game round count setting (R16)', () => {
  it('only 3, 5 or 7; anything else falls back to 3', () => {
    expect([3, 5, 7].map(parseFullGameRounds)).toEqual([3, 5, 7]);
    expect(parseFullGameRounds(4)).toBe(3);
    expect(parseFullGameRounds('7')).toBe(3);
    expect(parseFullGameRounds(undefined)).toBe(3);
  });

  it('a saved round count is read back', () => {
    const registry = fakeRegistry();
    expect(loadFullGameRounds(registry)).toBe(3);
    saveFullGameRounds(registry, 7);
    expect(loadFullGameRounds(registry)).toBe(7);
  });
});

describe('last game chosen on the menu', () => {
  it('ruleset: traditional unless video was chosen', () => {
    expect([parseRuleset('video'), parseRuleset('traditional'), parseRuleset('kalah'), parseRuleset(undefined)]).toEqual([
      'video',
      'traditional',
      'traditional',
      'traditional',
    ]);
    const registry = fakeRegistry();
    expect(loadRuleset(registry)).toBe('traditional');
    saveRuleset(registry, 'video');
    expect(loadRuleset(registry)).toBe('video');
  });

  it('length: a short game unless a full game was chosen', () => {
    expect([parseGameMode('full'), parseGameMode('short'), parseGameMode(3), parseGameMode(null)]).toEqual(['full', 'short', 'short', 'short']);
    const registry = fakeRegistry();
    expect(loadGameMode(registry)).toBe('short');
    saveGameMode(registry, 'full');
    expect(loadGameMode(registry)).toBe('full');
  });
});

describe('settings screen options', () => {
  it('touch: two taps by default (GDD §3.8), one tap only when chosen', () => {
    expect(parseTouchConfirm('single')).toBe('single');
    expect(parseTouchConfirm('double')).toBe('double');
    expect(parseTouchConfirm(undefined)).toBe('double');
    expect(parseTouchConfirm(1)).toBe('double');
    const registry = fakeRegistry();
    expect(loadTouchConfirm(registry)).toBe('double');
    saveTouchConfirm(registry, 'single');
    expect(loadTouchConfirm(registry)).toBe('single');
  });

  it('on/off settings: defaults, and only real booleans are accepted', () => {
    const registry = fakeRegistry();
    expect(loadFlag(registry, VIBRATION)).toBe(true);
    expect(loadFlag(registry, FACING)).toBe(false); // owner's choice 2026-11-24
    expect(loadFlag(registry, REDUCED_MOTION)).toBe(false); // no "reduce motion" system setting here
    expect(parseFlag('yes', false)).toBe(false);
    expect(parseFlag(1, true)).toBe(true);
    expect(parseFlag(false, true)).toBe(false);
  });

  it('a saved on/off setting is read back', () => {
    const registry = fakeRegistry();
    saveFlag(registry, FACING, true);
    saveFlag(registry, VIBRATION, false);
    saveFlag(registry, REDUCED_MOTION, true);
    expect([loadFlag(registry, FACING), loadFlag(registry, VIBRATION), loadFlag(registry, REDUCED_MOTION)]).toEqual([true, false, true]);
  });
});
