/**
 * AC-S1 groundwork: a saved game must come back exactly, and anything malformed, old or
 * tampered with must be rejected instead of crashing or bending the rules.
 */
import { describe, expect, it } from 'vitest';
import { createGame, legalMoves, playMove, startNextRound } from '../src/logic/rules';
import { parseGameState } from '../src/logic/serialize';
import type { GameState } from '../src/logic/types';
import { parseSavedGame } from '../src/save';

/** JSON round trip, like localStorage does. */
const roundTrip = (s: GameState): unknown => JSON.parse(JSON.stringify(s));
const tweak = (s: GameState, patch: Record<string, unknown>): unknown => ({ ...(roundTrip(s) as object), ...patch });

/** Playing states from real games, including full-game rounds with dead pits. */
function realStates(): GameState[] {
  const out: GameState[] = [];
  for (const ruleset of ['traditional', 'video'] as const) {
    for (const mode of ['short', 'full'] as const) {
      let s = createGame(mode, 0, { ruleset, maxRounds: mode === 'full' ? 5 : undefined });
      for (let turn = 0; turn < 400 && s.phase !== 'gameOver'; turn++) {
        if (s.phase === 'roundOver') s = startNextRound(s).state;
        out.push(s);
        const moves = legalMoves(s);
        s = playMove(s, moves[turn % moves.length]).state;
      }
    }
  }
  return out;
}

describe('parseGameState', () => {
  it('accepts every real game in progress, unchanged after a JSON round trip', () => {
    const states = realStates();
    expect(states.some((s) => s.dead.some(Boolean))).toBe(true); // dead pits are covered
    for (const s of states) {
      if (s.phase !== 'playing') continue;
      expect(parseGameState(roundTrip(s))).toEqual(s);
    }
  });

  const base = createGame('full', 0, { maxRounds: 3 });

  it.each([
    ['not an object', null],
    ['unknown mode', tweak(base, { mode: 'blitz' })],
    ['unknown ruleset', tweak(base, { ruleset: 'kalah' })],
    ['a finished game', tweak(base, { phase: 'gameOver' })],
    ['between rounds', tweak(base, { phase: 'roundOver' })],
    ['15 slots', tweak(base, { pits: base.pits.slice(1) })],
    ['a negative pit', tweak(base, { pits: [-1, 8, ...base.pits.slice(2)] })],
    ['a fractional pit', tweak(base, { pits: [6.5, 7.5, ...base.pits.slice(2)] })],
    ['seeds that do not add up to 98', tweak(base, { pits: [8, ...base.pits.slice(1)] })],
    ['a dead pit holding seeds', tweak(base, { dead: [true, ...base.dead.slice(1)] })],
    ['a dead store', tweak(base, { dead: base.dead.map((_, i) => i === 7) })],
    ['round past the limit', tweak(base, { round: 4 })],
    ['a short game with 3 rounds', tweak(createGame('short', 0), { maxRounds: 3 })],
    ['a third player', tweak(base, { current: 2 })],
    ['a winner already set', tweak(base, { winner: 0 })],
    ['no legal move for the player to move', tweak(base, { pits: [0, 0, 0, 0, 0, 0, 0, 0, 14, 14, 14, 14, 14, 14, 14, 0] })],
  ])('rejects %s', (_label, raw) => {
    expect(parseGameState(raw)).toBeNull();
  });
});

describe('parseSavedGame', () => {
  const state = createGame('short', 1, { ruleset: 'video' });
  const good = { version: 1, savedAt: 0, state: roundTrip(state), opponent: 'hard' };

  it('reads a current-version save (an older one without records starts with empty records)', () => {
    expect(parseSavedGame(good)).toEqual({ state, opponent: 'hard', records: { maxCapture: [0, 0], maxRelay: [0, 0] } });
  });

  it('keeps the game records, and replaces malformed ones with empty records', () => {
    const records = { maxCapture: [12, 3], maxRelay: [4, 0] };
    expect(parseSavedGame({ ...good, records })?.records).toEqual(records);
    expect(parseSavedGame({ ...good, records: { maxCapture: [-1, 3], maxRelay: [4, 0] } })?.records).toEqual({
      maxCapture: [0, 0],
      maxRelay: [0, 0],
    });
  });

  it.each([
    ['another version', { ...good, version: 0 }],
    ['an unknown opponent', { ...good, opponent: 'grandmaster' }],
    ['a broken state', { ...good, state: { ...(good.state as object), pits: [] } }],
    ['nothing', undefined],
  ])('ignores %s', (_label, raw) => {
    expect(parseSavedGame(raw)).toBeNull();
  });
});
