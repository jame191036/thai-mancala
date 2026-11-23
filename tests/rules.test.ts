/**
 * หมากขุม rules: one test per rule in docs/GDD.md §3.1 (R1–R16, A1–A6), plus every
 * fixture F1–F16 from docs/acceptance-criteria.md. Expected boards were worked out by hand.
 */
import { describe, expect, it } from 'vitest';
import { P1_STORE, P2_STORE, TOTAL_SEEDS, nextPosition, opposite, refillOrder } from '../src/logic/board';
import {
  IllegalMoveError,
  createCustomState,
  createGame,
  isLegalMove,
  legalMoves,
  playMove,
  randomPlayer,
  startNextRound,
  totalSeeds,
} from '../src/logic/rules';
import type { GameState, Player, Step } from '../src/logic/types';
import { board, dropPath, kinds, replaySteps, sum } from './helpers';

const P1: Player = 0;
const P2: Player = 1;

/** Play one move and check the invariants every move must keep. */
function play(state: GameState, pit: number) {
  const before = JSON.stringify(state);
  const result = playMove(state, pit);
  expect(JSON.stringify(state), 'input state must not be mutated').toBe(before);
  expect(totalSeeds(result.state), 'seeds are conserved').toBe(totalSeeds(state));
  expect(replaySteps(state.pits, result.steps), 'steps reproduce the new board').toEqual(result.state.pits);
  return result;
}

const custom = (pits: Record<number, number>, current: Player, extra: Partial<Parameters<typeof createCustomState>[0]> = {}) =>
  createCustomState({ pits: board(pits), current, ...extra });

const find = <K extends Step['kind']>(steps: readonly Step[], kind: K) =>
  steps.find((s): s is Extract<Step, { kind: K }> => s.kind === kind);

// ── Board geometry ───────────────────────────────────────────────────────────

describe('board geometry (GDD §3.2)', () => {
  it('opposite pits face each other across the board', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(opposite)).toEqual([14, 13, 12, 11, 10, 9, 8]);
    expect(opposite(8)).toBe(6);
    expect(() => opposite(P1_STORE)).toThrow(RangeError);
    expect(() => opposite(P2_STORE)).toThrow(RangeError);
  });

  it('refill order starts nearest the own store (R13)', () => {
    expect(refillOrder(P1)).toEqual([6, 5, 4, 3, 2, 1, 0]);
    expect(refillOrder(P2)).toEqual([14, 13, 12, 11, 10, 9, 8]);
  });

  it('next position skips the opponent store and dead pits', () => {
    const none = new Array<boolean>(16).fill(false);
    expect(nextPosition(6, P1, none)).toBe(7);
    expect(nextPosition(14, P1, none)).toBe(0); // skips 15
    expect(nextPosition(14, P2, none)).toBe(15);
    expect(nextPosition(6, P2, none)).toBe(8); // skips 7
    const dead = [...none];
    dead[8] = true;
    dead[9] = true;
    expect(nextPosition(7, P1, dead)).toBe(10);
  });
});

// ── R1, R2, R11: setup ───────────────────────────────────────────────────────

describe('R1/R2/R11 setup', () => {
  it('F1: 7 seeds in each of 14 pits, empty stores, 98 in total', () => {
    const s = createGame('short', P1);
    expect(s.pits).toEqual([7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0]);
    expect(totalSeeds(s)).toBe(TOTAL_SEEDS);
    expect(s).toMatchObject({
      phase: 'playing',
      round: 1,
      maxRounds: 1,
      current: P1,
      roundStarter: P1,
      winner: null,
      endReason: null,
    });
    expect(s.dead.every((d) => !d)).toBe(true);
  });

  it('R11: the caller picks who starts (engine stays deterministic)', () => {
    expect(createGame('full', P2).current).toBe(P2);
    expect(randomPlayer(() => 0.1)).toBe(P1);
    expect(randomPlayer(() => 0.9)).toBe(P2);
  });
});

// ── R3, R4: direction and stores ─────────────────────────────────────────────

describe('R3/R4 sowing direction and stores', () => {
  it('P1 sows counter-clockwise: rightwards along the bottom row', () => {
    const { steps } = play(custom({ 0: 3, 10: 1 }, P1), 0);
    expect(dropPath(steps)).toEqual([1, 2, 3]);
  });

  it('P2 sows counter-clockwise: leftwards along the top row (8 → 14)', () => {
    const { steps } = play(custom({ 8: 3, 0: 1 }, P2), 8);
    expect(dropPath(steps)).toEqual([9, 10, 11]);
  });

  it('F3: P1 drops into own store and skips P2 store, then captures', () => {
    const { state, steps } = play(custom({ 6: 10, 13: 2 }, P1), 6);
    expect(dropPath(steps)).toEqual([7, 8, 9, 10, 11, 12, 13, 14, 0, 1]);
    expect(state.pits).toEqual(board({ 0: 1, 7: 5, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1, 14: 1 }));
    expect(find(steps, 'capture')).toMatchObject({ pit: 1, opposite: 13, captured: 3, toStore: 4 });
    expect(state.current).toBe(P2);
  });

  it('F13: P2 drops into own store and skips P1 store, then captures', () => {
    const { state, steps } = play(custom({ 13: 11, 5: 4 }, P2), 13);
    expect(dropPath(steps)).toEqual([14, 15, 0, 1, 2, 3, 4, 5, 6, 8, 9]);
    expect(state.pits).toEqual(board({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 6: 1, 8: 1, 14: 1, 15: 7 }));
    expect(find(steps, 'capture')).toMatchObject({ player: P2, pit: 9, opposite: 5, captured: 5, toStore: 6 });
    expect(state.current).toBe(P1);
  });
});

// ── R5: relay sowing ─────────────────────────────────────────────────────────

describe('R5 relay (หว่านต่อ)', () => {
  it('F4: relay on own side, then capture, then the empty side passes', () => {
    const { state, steps } = play(custom({ 0: 2, 2: 3, 8: 1 }, P1), 0);
    expect(steps).toEqual<Step[]>([
      { kind: 'pickup', player: P1, pit: 0, seeds: 2 },
      { kind: 'drop', player: P1, pit: 1, pitSeeds: 1, handSeeds: 1 },
      { kind: 'drop', player: P1, pit: 2, pitSeeds: 4, handSeeds: 0 },
      { kind: 'relay', player: P1, pit: 2, seeds: 4 },
      { kind: 'drop', player: P1, pit: 3, pitSeeds: 1, handSeeds: 3 },
      { kind: 'drop', player: P1, pit: 4, pitSeeds: 1, handSeeds: 2 },
      { kind: 'drop', player: P1, pit: 5, pitSeeds: 1, handSeeds: 1 },
      { kind: 'drop', player: P1, pit: 6, pitSeeds: 1, handSeeds: 0 },
      { kind: 'capture', player: P1, pit: 6, opposite: 8, captured: 1, toStore: 2 },
      { kind: 'turnEnd', player: P1, pit: 6, reason: 'captured' },
      { kind: 'pass', player: P2 },
    ]);
    expect(state.pits).toEqual(board({ 1: 1, 3: 1, 4: 1, 5: 1, 7: 2 }));
    expect(state.current).toBe(P1);
  });

  it('F7: relay continues on the opponent side', () => {
    const { state, steps } = play(custom({ 6: 2, 8: 2, 12: 1 }, P1), 6);
    expect(find(steps, 'relay')).toMatchObject({ pit: 8, seeds: 3 });
    expect(dropPath(steps)).toEqual([7, 8, 9, 10, 11]);
    expect(state.pits).toEqual(board({ 7: 1, 9: 1, 10: 1, 11: 1, 12: 1 }));
    expect(find(steps, 'turnEnd')?.reason).toBe('opponentEmptyPit');
    expect(state.current).toBe(P2);
  });

  it('chains several relays in one turn', () => {
    const { state, steps } = play(custom({ 0: 1, 1: 1, 3: 1, 10: 1 }, P1), 0);
    expect(steps.filter((s) => s.kind === 'relay').map((s) => s.pit)).toEqual([1, 3]);
    expect(dropPath(steps)).toEqual([1, 2, 3, 4, 5]);
    expect(state.pits).toEqual(board({ 2: 1, 4: 1, 5: 1, 10: 1 }));
    expect(find(steps, 'turnEnd')?.reason).toBe('ownEmptyPit');
  });

  it('relay picks up the seed that was just dropped too', () => {
    const { steps } = play(custom({ 0: 1, 1: 4, 10: 1 }, P1), 0);
    expect(find(steps, 'relay')).toMatchObject({ pit: 1, seeds: 5 });
  });
});

// ── R6, R7: last seed in an empty pit ────────────────────────────────────────

describe('R6 capture (กิน) and R7 opponent empty pit', () => {
  it('capture moves the opposite pit AND the last seed into the store', () => {
    const { state, steps } = play(custom({ 2: 1, 11: 6 }, P1), 2);
    expect(find(steps, 'capture')).toMatchObject({ pit: 3, opposite: 11, captured: 6, toStore: 7 });
    expect(state.pits[3]).toBe(0);
    expect(state.pits[11]).toBe(0);
    expect(state.pits[P1_STORE]).toBe(7);
  });

  it('F5: own empty pit with an empty opposite pit: no capture, seed stays, turn ends', () => {
    const { state, steps } = play(custom({ 3: 1, 9: 2 }, P1), 3);
    expect(state.pits).toEqual(board({ 4: 1, 9: 2 }));
    expect(find(steps, 'capture')).toBeUndefined();
    expect(find(steps, 'turnEnd')).toMatchObject({ pit: 4, reason: 'ownEmptyPit' });
    expect(state.current).toBe(P2);
  });

  it('F6: opponent empty pit: seed stays, turn ends', () => {
    const { state, steps } = play(custom({ 6: 2, 12: 1 }, P1), 6);
    expect(state.pits).toEqual(board({ 7: 1, 8: 1, 12: 1 }));
    expect(find(steps, 'turnEnd')).toMatchObject({ pit: 8, reason: 'opponentEmptyPit' });
    expect(state.current).toBe(P2);
  });

  it('P2 landing in an empty P1 pit ends the turn without a capture', () => {
    const { state, steps } = play(custom({ 14: 3, 2: 1 }, P2), 14);
    expect(dropPath(steps)).toEqual([15, 0, 1]);
    expect(find(steps, 'capture')).toBeUndefined();
    expect(state.pits).toEqual(board({ 0: 1, 1: 1, 2: 1, 15: 1 }));
    expect(find(steps, 'turnEnd')?.reason).toBe('opponentEmptyPit');
  });
});

// ── R8, R9, A6: extra turn and passing ───────────────────────────────────────

describe('R8 extra turn, R9 pass, A6', () => {
  it('F2: last seed in own store gives another turn', () => {
    const { state, steps } = play(custom({ 4: 3, 8: 1 }, P1), 4);
    expect(kinds(steps)).toEqual(['pickup', 'drop', 'drop', 'drop', 'extraTurn']);
    expect(state.pits).toEqual(board({ 5: 1, 6: 1, 7: 1, 8: 1 }));
    expect(state.current).toBe(P1);
  });

  it('P2 also gets an extra turn in its own store', () => {
    const { state } = play(custom({ 12: 3, 0: 1 }, P2), 12);
    expect(state.pits[P2_STORE]).toBe(1);
    expect(state.current).toBe(P2);
  });

  it('A6: extra turn with no seeds left on own side passes to the opponent', () => {
    const { state, steps } = play(custom({ 6: 1, 10: 2 }, P1), 6);
    expect(kinds(steps)).toEqual(['pickup', 'drop', 'extraTurn', 'pass']);
    expect(find(steps, 'pass')?.player).toBe(P1);
    expect(state.current).toBe(P2);
  });

  it('a player who passed plays again as soon as seeds reach their side', () => {
    // P2 side is empty; P1 sows into it, so P2 moves next without a pass.
    const { state, steps } = play(custom({ 6: 2, 3: 1 }, P1), 6);
    expect(find(steps, 'pass')).toBeUndefined();
    expect(state.current).toBe(P2);
    expect(legalMoves(state)).toEqual([8]);
  });
});

// ── R17: "แบบตามวิดีโอ" ruleset ──────────────────────────────────────────────
// Only landing in your own store lets you keep going (no relay); the round ends as soon as
// a side is empty and the leftovers go to their owner. Capture and the rest are unchanged.

describe('R17 ruleset "video": no relay, extra turn only from the store, a side runs out → round ends', () => {
  const video = { ruleset: 'video' } as const;

  it('traditional is the default; video is opt-in', () => {
    expect(createGame('short', P1).ruleset).toBe('traditional');
    expect(createGame('full', P1, video).ruleset).toBe('video');
  });

  it('F17: last seed in one of your own pits that has seeds → the turn ends (no relay)', () => {
    const { state, steps } = play(custom({ 0: 2, 2: 3, 9: 1 }, P1, video), 0);
    expect(steps).toEqual<Step[]>([
      { kind: 'pickup', player: P1, pit: 0, seeds: 2 },
      { kind: 'drop', player: P1, pit: 1, pitSeeds: 1, handSeeds: 1 },
      { kind: 'drop', player: P1, pit: 2, pitSeeds: 4, handSeeds: 0 },
      { kind: 'turnEnd', player: P1, pit: 2, reason: 'occupiedPit' },
    ]);
    expect(state.pits).toEqual(board({ 1: 1, 2: 4, 9: 1 }));
    expect(state.current).toBe(P2);
  });

  it('last seed in an opponent pit that has seeds → the turn ends too', () => {
    const { state, steps } = play(custom({ 6: 2, 8: 1, 3: 4 }, P1, video), 6);
    expect(find(steps, 'relay')).toBeUndefined();
    expect(find(steps, 'turnEnd')).toMatchObject({ pit: 8, reason: 'occupiedPit' });
    expect(state.pits).toEqual(board({ 3: 4, 7: 1, 8: 2 }));
    expect(state).toMatchObject({ phase: 'playing', current: P2 });
  });

  it('the same move under the traditional rules relays instead (contrast with F17)', () => {
    const { steps } = play(custom({ 0: 2, 2: 3, 9: 1 }, P1), 0);
    expect(find(steps, 'relay')).toMatchObject({ pit: 2, seeds: 4 });
  });

  it('landing in your own store is the only way to go again — and you may pick ANY pit on your side', () => {
    const { state, steps } = play(custom({ 4: 3, 0: 2, 10: 1 }, P1, video), 4);
    expect(kinds(steps)).toEqual(['pickup', 'drop', 'drop', 'drop', 'extraTurn']);
    expect(state.current).toBe(P1);
    expect(legalMoves(state)).toEqual([0, 5, 6]);
  });

  it('capture of the opposite pit still applies (R6)', () => {
    const { steps } = play(custom({ 2: 1, 11: 6, 0: 1, 9: 1 }, P1, video), 2);
    expect(find(steps, 'capture')).toMatchObject({ pit: 3, opposite: 11, captured: 6, toStore: 7 });
  });

  it('F18: a capture that empties the opponent side ends the round; P1 keeps its own seeds', () => {
    const { state, steps } = play(custom({ 5: 1, 8: 2, 0: 3 }, P1, video), 5);
    expect(steps).toEqual<Step[]>([
      { kind: 'pickup', player: P1, pit: 5, seeds: 1 },
      { kind: 'drop', player: P1, pit: 6, pitSeeds: 1, handSeeds: 0 },
      { kind: 'capture', player: P1, pit: 6, opposite: 8, captured: 2, toStore: 3 },
      { kind: 'turnEnd', player: P1, pit: 6, reason: 'captured' },
      { kind: 'sideEmpty', player: P2 },
      { kind: 'sweep', player: P1, pit: 0, seeds: 3 },
      { kind: 'roundEnd', round: 1, stores: [6, 0], winner: P1 },
      { kind: 'gameOver', winner: P1, reason: 'singleRound' },
    ]);
    expect(state.pits).toEqual(board({ 7: 6 }));
  });

  it('F19: emptying your OWN side ends the round, even right after an extra turn; the opponent keeps theirs', () => {
    const { state, steps } = play(custom({ 6: 1, 9: 2, 12: 3, 7: 10, 15: 5 }, P1, video), 6);
    expect(kinds(steps)).toEqual(['pickup', 'drop', 'extraTurn', 'sideEmpty', 'sweep', 'sweep', 'roundEnd', 'gameOver']);
    expect(find(steps, 'sideEmpty')?.player).toBe(P1);
    expect(steps.filter((s) => s.kind === 'sweep')).toEqual([
      { kind: 'sweep', player: P2, pit: 9, seeds: 2 },
      { kind: 'sweep', player: P2, pit: 12, seeds: 3 },
    ]);
    expect(state.pits).toEqual(board({ 7: 11, 15: 10 }));
    expect(state.lastRound).toEqual({ round: 1, stores: [11, 10], winner: P1 });
  });

  it('F20: in a full game the swept seeds count for the refill', () => {
    const s = custom({ 6: 1, 9: 2, 12: 3, 7: 49, 15: 43 }, P1, { ...video, mode: 'full' });
    const ended = play(s, 6).state;
    expect(ended.phase).toBe('roundOver');
    expect(ended.lastRound?.stores).toEqual([50, 48]); // P2's 2 + 3 were swept into its store
    const { state } = startNextRound(ended);
    expect(state.ruleset).toBe('video'); // the ruleset carries over to the next round
    // P1 50 → 7 pits, 1 left; P2 48 → 6 pits, 6 left, pit 8 (farthest from its store) dead.
    expect(state.pits).toEqual([7, 7, 7, 7, 7, 7, 7, 1, 0, 7, 7, 7, 7, 7, 7, 6]);
    expect(state.dead.flatMap((d, i) => (d ? [i] : []))).toEqual([8]);
    expect(state.current).toBe(P2); // loser of the round starts (R14)
  });

  it('both sides empty at once: no sweep needed', () => {
    const { steps } = play(custom({ 6: 1, 7: 50, 15: 47 }, P1, video), 6);
    expect(steps.filter((s) => s.kind === 'sideEmpty').map((s) => s.player)).toEqual([P1, P2]);
    expect(find(steps, 'sweep')).toBeUndefined();
  });

  it('every opening move: no relay, and a playing state never has an empty side', () => {
    for (const first of [P1, P2]) {
      const start = createGame('short', first, video);
      for (const pit of legalMoves(start)) {
        const { state, steps } = play(start, pit);
        expect(find(steps, 'relay')).toBeUndefined();
        if (state.phase !== 'playing') continue;
        expect(state.pits.slice(0, 7).some((n) => n > 0)).toBe(true);
        expect(state.pits.slice(8, 15).some((n) => n > 0)).toBe(true);
      }
    }
  });
});

// ── R10, R12: round end and the short game ───────────────────────────────────

describe('R10 round end and R12 short game', () => {
  it('F8: round ends when every small pit is empty (full game → roundOver)', () => {
    const { state, steps } = play(custom({ 6: 1, 7: 50, 15: 47 }, P1, { mode: 'full' }), 6);
    expect(kinds(steps)).toEqual(['pickup', 'drop', 'extraTurn', 'roundEnd']);
    expect(state.phase).toBe('roundOver');
    expect(state.lastRound).toEqual({ round: 1, stores: [51, 47], winner: P1 });
    expect(state.pits[P1_STORE] + state.pits[P2_STORE]).toBe(98);
    expect(legalMoves(state)).toEqual([]);
  });

  it('short game: the round end is the game end; more seeds wins', () => {
    const { state, steps } = play(custom({ 6: 1, 7: 40, 15: 57 }, P1), 6);
    expect(kinds(steps).slice(-2)).toEqual(['roundEnd', 'gameOver']);
    expect(state).toMatchObject({ phase: 'gameOver', winner: P2, endReason: 'singleRound' });
    expect(find(steps, 'gameOver')).toEqual({ kind: 'gameOver', winner: P2, reason: 'singleRound' });
  });

  it('F12: short game 49:49 is a draw', () => {
    const { state, steps } = play(custom({ 6: 1, 7: 48, 15: 49 }, P1), 6);
    expect(state).toMatchObject({ phase: 'gameOver', winner: null, endReason: 'singleRound' });
    expect(find(steps, 'gameOver')?.winner).toBeNull();
  });

  it('a round can also end on a capture', () => {
    const { state } = play(custom({ 5: 1, 8: 3, 7: 60, 15: 34 }, P1), 5);
    expect(state.phase).toBe('gameOver');
    expect(state.pits[P1_STORE]).toBe(64);
  });
});

// ── R13–R15, A3–A5: full game ────────────────────────────────────────────────

describe('R13–R15 full game between rounds', () => {
  const afterF8 = () => play(custom({ 6: 1, 7: 50, 15: 47 }, P1, { mode: 'full' }), 6).state;

  it('F9: refill nearest store first, unfillable pits die, leftovers stay, loser starts', () => {
    const before = afterF8();
    const { state, steps } = startNextRound(before);
    expect(state.pits).toEqual([7, 7, 7, 7, 7, 7, 7, 2, 0, 7, 7, 7, 7, 7, 7, 5]);
    expect(state.dead.flatMap((d, i) => (d ? [i] : []))).toEqual([8]);
    expect(state).toMatchObject({ phase: 'playing', round: 2, current: P2, roundStarter: P2 });
    expect(steps.filter((s) => s.kind === 'refill').map((s) => s.pit)).toEqual([
      6, 5, 4, 3, 2, 1, 0, 14, 13, 12, 11, 10, 9,
    ]);
    expect(find(steps, 'deadPit')).toMatchObject({ player: P2, pit: 8 });
    expect(steps.at(-1)).toEqual({ kind: 'roundStart', round: 2, starter: P2 });
    expect(replaySteps(before.pits, steps)).toEqual(state.pits);
    expect(totalSeeds(state)).toBe(98);
  });

  it('R14: when P2 wins the round, P1 starts the next one', () => {
    const round = play(custom({ 14: 1, 7: 40, 15: 57 }, P2, { mode: 'full' }), 14).state;
    expect(round.lastRound?.winner).toBe(P2);
    const { state } = startNextRound(round);
    expect(state.current).toBe(P1);
    // P1 had 40: five pits (6..2), pits 1 and 0 dead, 5 left in store.
    expect(state.dead.flatMap((d, i) => (d ? [i] : []))).toEqual([0, 1]);
    expect(state.pits[P1_STORE]).toBe(5);
    // P2 had 58: all seven pits, 9 left in store (A3).
    expect(state.pits[P2_STORE]).toBe(9);
  });

  it('A5: after a 49:49 round, whoever did not start the last round starts', () => {
    const tieFrom = (starter: Player) =>
      play(custom({ 6: 1, 7: 48, 15: 49 }, P1, { mode: 'full', roundStarter: starter }), 6).state;
    expect(tieFrom(P1).phase).toBe('roundOver');
    expect(startNextRound(tieFrom(P1)).state.current).toBe(P2);
    expect(startNextRound(tieFrom(P2)).state.current).toBe(P1);
  });

  it('A4: dead pits come back when the store can fill them', () => {
    const s = custom({ 6: 1, 7: 48, 15: 49 }, P1, { mode: 'full', dead: [0, 1] });
    const { state } = startNextRound(play(s, 6).state);
    expect(state.dead.every((d) => !d)).toBe(true);
  });

  it('F11/R15: a player who cannot fill a single pit loses the full game', () => {
    const { state, steps } = play(custom({ 6: 1, 7: 91, 15: 6 }, P1, { mode: 'full' }), 6);
    expect(kinds(steps).slice(-2)).toEqual(['roundEnd', 'gameOver']);
    expect(state).toMatchObject({ phase: 'gameOver', winner: P1, endReason: 'cannotFill' });
    expect(() => startNextRound(state)).toThrow(IllegalMoveError);
  });

  it('startNextRound is rejected outside a finished full-game round', () => {
    expect(() => startNextRound(createGame('full', P1))).toThrow(IllegalMoveError);
    const shortOver = play(custom({ 6: 1, 7: 48, 15: 49 }, P1), 6).state;
    expect(() => startNextRound(shortOver)).toThrow(IllegalMoveError);
  });
});

// ── R16: round limit for the full game ───────────────────────────────────────

describe('R16 full game round limit (3 / 5 / 7, default 3)', () => {
  /** Ends the round 51:47 for P1 (or 49:49 with `tie`) at the given round. */
  const endRound = (round: number, opts: { maxRounds?: number; tie?: boolean } = {}) =>
    play(
      custom(opts.tie ? { 6: 1, 7: 48, 15: 49 } : { 6: 1, 7: 50, 15: 47 }, P1, {
        mode: 'full',
        round,
        maxRounds: opts.maxRounds,
      }),
      6,
    );

  it('a full game defaults to 3 rounds; 5 and 7 can be chosen', () => {
    expect(createGame('full', P1).maxRounds).toBe(3);
    expect(createGame('full', P1, { maxRounds: 5 }).maxRounds).toBe(5);
    expect(createGame('full', P1, { maxRounds: 7 }).maxRounds).toBe(7);
    expect(createGame('short', P1, { maxRounds: 7 }).maxRounds).toBe(1); // short is always 1 round
  });

  it('rejects an invalid round limit', () => {
    expect(() => createGame('full', P1, { maxRounds: 0 })).toThrow(RangeError);
    expect(() => createGame('full', P1, { maxRounds: 2.5 })).toThrow(RangeError);
  });

  it('before the last round, play continues (roundOver)', () => {
    expect(endRound(1).state.phase).toBe('roundOver');
    expect(endRound(2).state.phase).toBe('roundOver');
    expect(endRound(3, { maxRounds: 5 }).state.phase).toBe('roundOver');
  });

  it('F15: after the last round, more seeds wins the full game', () => {
    const { state, steps } = endRound(3);
    expect(state).toMatchObject({ phase: 'gameOver', winner: P1, endReason: 'roundLimit' });
    expect(find(steps, 'gameOver')).toEqual({ kind: 'gameOver', winner: P1, reason: 'roundLimit' });
    expect(() => startNextRound(state)).toThrow(IllegalMoveError);
  });

  it('F16: 49:49 after the last round is a draw', () => {
    expect(endRound(3, { tie: true }).state).toMatchObject({ phase: 'gameOver', winner: null, endReason: 'roundLimit' });
    expect(endRound(7, { maxRounds: 7, tie: true }).state.endReason).toBe('roundLimit');
  });

  it('R15 still ends the game early, before the limit', () => {
    const { state } = play(custom({ 6: 1, 7: 91, 15: 6 }, P1, { mode: 'full', round: 1, maxRounds: 7 }), 6);
    expect(state).toMatchObject({ phase: 'gameOver', winner: P1, endReason: 'cannotFill' });
  });

  it('R15 wins over R16 when both apply in the last round', () => {
    const { state } = play(custom({ 6: 1, 7: 91, 15: 6 }, P1, { mode: 'full', round: 3 }), 6);
    expect(state.endReason).toBe('cannotFill');
  });

  it('round numbers advance 1 → 2 → 3 and the game stops after round 3', () => {
    const after1 = startNextRound(endRound(1).state).state;
    expect(after1).toMatchObject({ round: 2, maxRounds: 3, phase: 'playing' });
    const after2 = startNextRound(endRound(2).state).state;
    expect(after2.round).toBe(3);
  });
});

// ── A1, A2: origin pit and dead pits ─────────────────────────────────────────

describe('A1 origin pit, A2 dead pits', () => {
  it('F14/A1: sowing a full lap puts a seed back into the origin pit', () => {
    const { state, steps } = play(custom({ 0: 15, 10: 1 }, P1), 0);
    expect(dropPath(steps)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 0]);
    expect(find(steps, 'capture')).toMatchObject({ pit: 0, opposite: 14, captured: 1, toStore: 2 });
    expect(state.pits).toEqual(board({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 3, 8: 1, 9: 1, 10: 2, 11: 1, 12: 1, 13: 1 }));
  });

  it('F10/A2: sowing skips dead pits', () => {
    const s = custom({ 6: 3, 10: 1 }, P1, { mode: 'full', dead: [8] });
    const { state, steps } = play(s, 6);
    expect(dropPath(steps)).toEqual([7, 9, 10, 11, 12]);
    expect(state.pits).toEqual(board({ 7: 1, 9: 1, 11: 1, 12: 1 }));
    expect(state.dead[8]).toBe(true);
  });

  it('A2: P2 sowing also skips dead pits on the P1 side', () => {
    const s = custom({ 14: 3, 8: 1 }, P2, { mode: 'full', dead: [0, 1] });
    expect(dropPath(play(s, 14).steps)).toEqual([15, 2, 3]);
  });

  it('A2: a dead opposite pit counts as empty (no capture)', () => {
    const s = custom({ 5: 1, 10: 1 }, P1, { mode: 'full', dead: [8] });
    const { steps } = play(s, 5);
    expect(find(steps, 'capture')).toBeUndefined();
    expect(find(steps, 'turnEnd')?.reason).toBe('ownEmptyPit');
  });
});

// ── AC-R16: legal moves ──────────────────────────────────────────────────────

describe('AC-R16 legal moves', () => {
  it('only own, non-empty, non-dead pits are legal', () => {
    expect(legalMoves(createGame('short', P1))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(legalMoves(createGame('short', P2))).toEqual([8, 9, 10, 11, 12, 13, 14]);
    const s = custom({ 8: 2, 10: 1, 13: 4, 3: 1 }, P2, { mode: 'full', dead: [9, 14] });
    expect(legalMoves(s)).toEqual([8, 10, 13]);
  });

  it.each([
    ['an empty pit', 1],
    ['an opponent pit', 9],
    ['a store', 7],
    ['the opponent store', 15],
    ['a dead pit', 2],
    ['a non-integer', 0.5],
    ['out of range', 16],
  ])('rejects %s', (_label, pit) => {
    const s = custom({ 0: 3, 9: 1 }, P1, { mode: 'full', dead: [2] });
    expect(isLegalMove(s, pit)).toBe(false);
    expect(() => playMove(s, pit)).toThrow(IllegalMoveError);
  });

  it('rejects any move once the game is over', () => {
    const over = play(custom({ 6: 1, 7: 48, 15: 49 }, P1), 6).state;
    expect(() => playMove(over, 0)).toThrow(IllegalMoveError);
  });

  it('rejects malformed custom boards', () => {
    expect(() => createCustomState({ pits: [1, 2, 3], current: P1 })).toThrow(RangeError);
    expect(() => createCustomState({ pits: board({ 0: -1 }), current: P1 })).toThrow(RangeError);
    expect(() => createCustomState({ pits: board({ 0: 1 }), current: P1, dead: [7] })).toThrow(RangeError);
    expect(() => createCustomState({ pits: board({ 3: 2 }), current: P1, dead: [3] })).toThrow(RangeError);
    expect(() => createCustomState({ pits: board({ 0: 1 }), current: P1, mode: 'full', round: 4 })).toThrow(RangeError);
    expect(() => createCustomState({ pits: board({ 0: 1 }), current: P1, round: 2 })).toThrow(RangeError);
  });
});

// ── Whole opening move from the real start position ──────────────────────────

describe('opening move from the real start', () => {
  it('every opening move keeps 98 seeds and replays exactly from its steps', () => {
    for (const first of [P1, P2]) {
      const start = createGame('short', first);
      for (const pit of legalMoves(start)) {
        const { state } = play(start, pit);
        expect(sum(state.pits)).toBe(98);
      }
    }
  });
});
