/** Records of one game and statistics across games (GDD §4 Scoring, §7 Result / Stats). */
import { describe, expect, it } from 'vitest';
import { createCustomState, playMove } from '../src/logic/rules';
import { board } from './helpers';
import {
  addMoveToRecords,
  emptyGameRecords,
  emptyStats,
  humanPlayers,
  parseStats,
  recordGame,
  totalGames,
  type FinishedGame,
} from '../src/stats';

describe('game records', () => {
  it('a capture counts the seeds that reached the store (F3: +4)', () => {
    const s = createCustomState({ pits: board({ 6: 10, 13: 2 }), current: 0 });
    const { steps } = playMove(s, 6);
    const r = addMoveToRecords(emptyGameRecords(), 0, steps);
    expect(r.maxCapture).toEqual([4, 0]);
    expect(r.maxRelay).toEqual([0, 0]);
  });

  it('a relay chain counts each relay of the move (F4: 1 relay, then a capture of 2)', () => {
    const s = createCustomState({ pits: board({ 0: 2, 2: 3, 8: 1 }), current: 0 });
    const { steps } = playMove(s, 0);
    const r = addMoveToRecords(emptyGameRecords(), 0, steps);
    expect(r.maxRelay).toEqual([1, 0]);
    expect(r.maxCapture).toEqual([2, 0]);
  });

  it('keeps the best per player, never lowers it', () => {
    let r = { maxCapture: [9, 1] as [number, number], maxRelay: [3, 0] as [number, number] };
    const s = createCustomState({ pits: board({ 6: 10, 13: 2 }), current: 0 });
    r = addMoveToRecords(r, 0, playMove(s, 6).steps);
    expect(r).toEqual({ maxCapture: [9, 1], maxRelay: [3, 0] });
  });
});

const game = (patch: Partial<FinishedGame>): FinishedGame => ({
  opponent: 'easy',
  mode: 'short',
  winner: 0,
  stores: [60, 38],
  records: { maxCapture: [12, 30], maxRelay: [4, 9] },
  resigned: false,
  ...patch,
});

describe('player stats', () => {
  it('counts results per opponent and mode (P1 = the person against the AI)', () => {
    let s = emptyStats();
    s = recordGame(s, game({ winner: 0 }));
    s = recordGame(s, game({ winner: 1 }));
    s = recordGame(s, game({ winner: null, stores: [49, 49] }));
    s = recordGame(s, game({ opponent: 'human', mode: 'full', winner: 1 }));
    expect(s.results.easy.short).toEqual({ p1: 1, p2: 1, draw: 1 });
    expect(s.results.human.full).toEqual({ p1: 0, p2: 1, draw: 0 });
    expect(s.results.hard.short).toEqual({ p1: 0, p2: 0, draw: 0 });
    expect(totalGames(s)).toBe(4);
  });

  it("records count people only: the AI's capture of 30 does not", () => {
    expect(humanPlayers('hard')).toEqual([0]);
    expect(humanPlayers('human')).toEqual([0, 1]);
    const vsAi = recordGame(emptyStats(), game({ opponent: 'hard' }));
    expect([vsAi.bestCapture, vsAi.longestRelay]).toEqual([12, 4]);
    const twoPeople = recordGame(emptyStats(), game({ opponent: 'human' }));
    expect([twoPeople.bestCapture, twoPeople.longestRelay]).toEqual([30, 9]);
  });

  it('biggest win: only a person winning, and not by resignation', () => {
    expect(recordGame(emptyStats(), game({ winner: 0 })).biggestWin).toBe(22);
    expect(recordGame(emptyStats(), game({ winner: 1 })).biggestWin).toBe(0); // the AI won
    expect(recordGame(emptyStats(), game({ winner: 0, resigned: true })).biggestWin).toBe(0);
    expect(recordGame(emptyStats(), game({ opponent: 'human', winner: 1, stores: [20, 78] })).biggestWin).toBe(58);
  });

  it('does not change the stats it was given', () => {
    const before = emptyStats();
    recordGame(before, game({}));
    expect(before).toEqual(emptyStats());
  });

  it('survives a storage round trip, and malformed data counts as zero', () => {
    const s = recordGame(emptyStats(), game({}));
    expect(parseStats(JSON.parse(JSON.stringify({ version: 1, ...s })))).toEqual(s);
    expect(parseStats({ version: 2, ...s })).toEqual(emptyStats());
    expect(parseStats(null)).toEqual(emptyStats());
    const broken = parseStats({ version: 1, results: { easy: { short: { p1: -3, p2: 'x', draw: 2 } } }, bestCapture: 1.5 });
    expect(broken.results.easy.short).toEqual({ p1: 0, p2: 0, draw: 2 });
    expect(broken.bestCapture).toBe(0);
  });
});
