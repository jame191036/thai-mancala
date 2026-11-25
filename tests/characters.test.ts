import { describe, expect, it } from 'vitest';
import { CHARACTERS, MOOD_OF } from '../src/characters';
import source from '../src/characters.ts?raw';
import { playerNames } from '../src/types/scenes';

describe('AI characters (GDD §6)', () => {
  it('one per level, with the names the owner chose', () => {
    expect(Object.entries(CHARACTERS).map(([level, c]) => [level, c.name])).toEqual([
      ['easy', 'น้องแก้ว'],
      ['medium', 'ลุงเคี่ยม'],
      ['hard', 'ยายขุม'],
    ]);
  });

  it('every character has a short line for every event', () => {
    for (const c of Object.values(CHARACTERS)) {
      expect(Object.keys(c.lines).sort()).toEqual(Object.keys(MOOD_OF).sort());
      for (const line of Object.values(c.lines)) {
        expect(line.length).toBeGreaterThan(0);
        expect(line.length).toBeLessThanOrEqual(16);
      }
    }
  });

  it('is glad when it does well and sad when it does not', () => {
    expect(MOOD_OF).toEqual({ capture: 'glad', captured: 'sad', extraTurn: 'glad', win: 'glad', lose: 'sad', draw: 'normal' });
  });

  it('gives its name to the AI player', () => {
    expect(playerNames('easy')).toEqual(['คุณ', 'น้องแก้ว']);
    expect(playerNames('human')).toEqual(['ผู้เล่น 1', 'ผู้เล่น 2']);
  });

  it('stays free of Phaser', () => {
    expect(source).not.toMatch(/from ['"]phaser['"]/);
  });
});
