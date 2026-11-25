// Dead pits on screen: the wooden lids close one by one when the pits are refilled, lie on
// exactly the engine's dead pits, hide the number, and go away when a pit comes back to life.
import { reachMenu } from './lib/common.mjs';

const GS = `scene('GameScene')`;
const DEAD = (...pits) => Array.from({ length: 16 }, (_, i) => pits.includes(i));
const lids = { expression: `${GS}.displayedDead()` };

// One move before a round ends: P1 drops the last seed into its store. P1 then has `p1` seeds,
// P2 the rest, and both fill their pits from the one nearest the store.
const lastMove = (what, { p1, dead = [], style = 'marbles', reduced = false, speed = 1 }) => [
  {
    name: `${what}: board set`,
    action: 'eval',
    code: `game.registry.set('boardStyle', '${style}'); game.registry.set('reducedMotion', ${reduced}); game.registry.set('sowSpeed', ${speed});
      const s = ${GS}; const st = JSON.parse(JSON.stringify(s.state));
      st.mode = 'full'; st.maxRounds = 7; st.round = 2; st.ruleset = 'traditional'; st.phase = 'playing'; st.current = 0;
      st.pits = [0, 0, 0, 0, 0, 0, 1, ${p1 - 1}, 0, 0, 0, 0, 0, 0, 0, ${98 - p1}];
      st.dead = ${JSON.stringify(DEAD(...dead))};
      s.scene.restart({ resume: { state: st, opponent: 'human' } });`,
  },
  { name: `${what}: board ready`, action: 'waitFor', expression: `game.scene.isActive('GameScene') && ${GS}.state.round === 2 && ${GS}.state.pits[7] === ${p1 - 1} && ${GS}.boardStyle === '${style}' && !${GS}.busy`, timeout: 4000 },
];
const play = (what) => [
  // Every pit seen closing, and the frames it went through.
  { name: `${what}: watch the lids`, action: 'eval', code: `window.__closing = {}; const s = ${GS}; s.events.on('postupdate', () => { for (const p of s.closingLids()) { const f = (window.__closing[p] ??= []); const n = Number(s.lids.at(p).frame.name); if (f[f.length - 1] !== n) f.push(n); } });` },
  { name: `${what}: last move of the round`, action: 'eval', code: `${GS}.choosePit(6);` },
];
const nextRound = (what, timeout = 12000) => ({ name: `${what}: next round`, action: 'waitFor', expression: `${GS}.state.round === 3 && !${GS}.busy && ${GS}.closingLids().length === 0`, timeout });

export default [
  reachMenu,
  { name: 'key 2: full game', action: 'press', key: '2' },
  { name: 'game', action: 'waitFor', expression: `game.scene.isActive('GameScene')`, timeout: 5000 },

  // ── 30 seeds: P1 fills 6, 5, 4, 3 and pits 2, 1, 0 die ──
  ...lastMove('closing', { p1: 30, speed: 2 }),
  { name: 'no lids yet', action: 'expect', expect: { ...lids, equals: DEAD() } },
  ...play('closing'),
  { name: 'a lid is coming down', action: 'waitFor', expression: `${GS}.closingLids().length > 0`, timeout: 12000, poll: 20 },
  { name: 'lid-closing', action: 'screenshot' },
  nextRound('closing'),
  { name: 'the engine killed pits 0, 1, 2', action: 'expect', expect: { expression: `${GS}.state.dead`, equals: DEAD(0, 1, 2) } },
  { name: 'lids lie on exactly those pits', action: 'expect', expect: { ...lids, equals: DEAD(0, 1, 2) } },
  { name: 'each of them came down', action: 'expect', expect: { expression: `Object.keys(window.__closing).sort()`, equals: ['0', '1', '2'] } },
  { name: 'frame by frame, in order', action: 'expect', expect: { expression: `Object.values(window.__closing).every((f) => f.length >= 3 && f.every((n, i) => i === 0 || n > f[i - 1]))`, equals: true } },
  { name: 'the closed lids show their last frame, no number, and sit on their pits', action: 'expect', expect: { expression: `[0, 1, 2].every((p) => { const s = ${GS}, l = s.lids.at(p); return Number(l.frame.name) === 4 && !s.slots[p].label.visible && l.x === s.slots[p].shape.x && l.y === s.slots[p].shape.y; })`, equals: true } },
  { name: 'the other pits show their numbers', action: 'expect', expect: { expression: `${GS}.slots.filter((o) => o.label.visible).length`, equals: 13 } },
  { name: 'dead-marbles', action: 'screenshot' },

  // ── A dead pit cannot be chosen; tapping it shakes its lid ──
  { name: 'click the dead pit 1', action: 'click', x: 2 * 152, y: 2 * 158 },
  { name: 'nothing was sown', action: 'expect', expect: { expression: `[${GS}.busy, ${GS}.state.round, ${GS}.state.pits[6]]`, equals: [false, 3, 7] } },
  { name: 'the lid is back in place after the shake', action: 'wait', ms: 400 },
  { name: 'lid in place', action: 'expect', expect: { expression: `${GS}.lids.at(1).x`, equals: 152 } },

  // ── A resumed game shows its lids at once; pits that can be filled come back ──
  ...lastMove('reviving', { p1: 60, dead: [0, 1, 2], speed: 4, style: 'hand' }),
  { name: 'the resumed game has its lids', action: 'expect', expect: { expression: `[${GS}.displayedDead(), ${GS}.closingLids()]`, equals: [DEAD(0, 1, 2), []] } },
  ...play('reviving'),
  nextRound('reviving'),
  { name: 'P1 is whole again, P2 lost pits 8 and 9', action: 'expect', expect: { expression: `[${GS}.state.dead, ${GS}.displayedDead()]`, equals: [DEAD(8, 9), DEAD(8, 9)] } },
  { name: 'the revived pits show 7 again', action: 'expect', expect: { expression: `[0, 1, 2].map((p) => [${GS}.slots[p].label.visible, ${GS}.slots[p].label.text])`, equals: [[true, '7'], [true, '7'], [true, '7']] } },
  { name: 'dead-hand', action: 'screenshot' },

  // ── Skipping closes every lid at once ──
  ...lastMove('skipping', { p1: 30, style: 'numbers' }),
  ...play('skipping'),
  { name: 'a lid is coming down again', action: 'waitFor', expression: `${GS}.closingLids().length > 0`, timeout: 12000, poll: 20 },
  { name: 'Space skips', action: 'press', key: 'Space' },
  { name: 'all lids closed', action: 'waitFor', expression: `!${GS}.busy && ${GS}.closingLids().length === 0`, timeout: 600, poll: 20 },
  { name: 'on the right pits', action: 'expect', expect: { expression: `[${GS}.displayedDead(), [0, 1, 2].map((p) => Number(${GS}.lids.at(p).frame.name))]`, equals: [DEAD(0, 1, 2), [4, 4, 4]] } },
  { name: 'dead-numbers', action: 'screenshot' },

  // ── Reduced motion: no closing animation ──
  ...lastMove('reduced motion', { p1: 30, reduced: true }),
  ...play('reduced motion'),
  nextRound('reduced motion'),
  { name: 'lids without any closing animation', action: 'expect', expect: { expression: `[${GS}.displayedDead(), Object.keys(window.__closing)]`, equals: [DEAD(0, 1, 2), []] } },
];
