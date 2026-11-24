// The three ways the game can look (Settings → "แบบการเล่น", GDD §7): marbles, hand, numbers.
// The rules never depend on it: the same move must end on the same board in all three.
import { reachMenu } from './lib/common.mjs';

const GS = `scene('GameScene')`;
// Video rules: P1's 10 seeds from pit 0 end on P2's occupied pit 10, so the turn just ends.
const BOARD = [10, 7, 7, 7, 7, 7, 4, 0, 7, 7, 7, 7, 7, 7, 7, 0];
const AFTER = [0, 8, 8, 8, 8, 8, 5, 1, 8, 8, 8, 7, 7, 7, 7, 0];

const style = (name, { marbles, hand }) => [
  {
    name: `${name}: choose it and load the board, P1 to move`,
    action: 'eval',
    code: `game.registry.set('boardStyle', '${name}');
      const s = ${GS}; const st = JSON.parse(JSON.stringify(s.state));
      st.pits = ${JSON.stringify(BOARD)}; st.current = 0; st.ruleset = 'video'; st.phase = 'playing';
      s.scene.restart({ resume: { state: st, opponent: 'human' } });`,
  },
  { name: `${name}: board ready`, action: 'waitFor', expression: `${GS}.boardStyle === '${name}' && ${GS}.state.pits[0] === 10 && !${GS}.busy`, timeout: 3000 },
  { name: `${name}: settle`, action: 'wait', ms: 300 },
  {
    name: `${name}: ${marbles ? 'a marble for every seed' : 'no marbles'}`,
    action: 'expect',
    expect: { expression: `${GS}.displayedSeeds()`, equals: marbles ? BOARD : BOARD.map(() => 0) },
  },
  { name: `${name}: the numbers are right`, action: 'expect', expect: { expression: `${GS}.displayedPits()`, equals: BOARD } },
  { name: `${name}: numbers ${marbles ? 'beside the board' : 'inside the bowls'}`, action: 'expect', expect: { expression: `${GS}.countsInBowls()`, equals: !marbles } },
  { name: `${name}: nothing in the hand yet`, action: 'expect', expect: { expression: `${GS}.handState().visible`, equals: false } },
  { name: `${name}: sow pit 0`, action: 'eval', code: `${GS}.speed = 1; window.__poses = new Set(); window.__watch = setInterval(() => { const h = ${GS}.handState(); if (h.visible) window.__poses.add(h.pose); }, 5); ${GS}.choosePit(0);` },
  { name: `${name}: mid-sowing`, action: 'wait', ms: 700 },
  { name: `${name}: P1 is carrying the seeds`, action: 'expect', expect: { expression: `(({ visible, player }) => [visible, player])(${GS}.handState())`, equals: [true, 0] } },
  { name: `${name}: ${hand ? 'drawn as a hand' : 'drawn as a circle'}`, action: 'expect', expect: { expression: `${GS}.children.list.some((o) => o.list && o.list.some((c) => c.texture && c.texture.key === 'hand'))`, equals: hand } },
  { name: `style-${name}`, action: 'screenshot' },
  { name: `${name}: move done`, action: 'waitFor', expression: `!${GS}.busy`, timeout: 5000 },
  { name: `${name}: stop watching`, action: 'eval', code: `clearInterval(window.__watch);` },
  ...(hand ? [{ name: 'the hand was seen closed, letting go, and open', action: 'expect', expect: { expression: `['carry', 'drop', 'open'].every((p) => window.__poses.has(p))`, equals: true } }] : []),
  { name: `${name}: the hand is gone`, action: 'expect', expect: { expression: `${GS}.handState().visible`, equals: false } },
  { name: `${name}: same result as in the other styles`, action: 'expect', expect: { expression: `[${GS}.state.pits, ${GS}.displayedPits()]`, equals: [AFTER, AFTER] } },
];

export default [
  reachMenu,
  { name: 'key 1 = short game', action: 'press', key: '1' },
  { name: 'game', action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  ...style('marbles', { marbles: true, hand: false }),
  ...style('hand', { marbles: true, hand: true }),
  ...style('numbers', { marbles: false, hand: false }),
  // P2's hand reaches in from the other side.
  {
    name: 'hand style, P2 to move',
    action: 'eval',
    code: `game.registry.set('boardStyle', 'hand'); const s = ${GS}; const st = JSON.parse(JSON.stringify(s.state));
      st.pits = [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0]; st.current = 1; st.ruleset = 'video'; st.phase = 'playing';
      s.scene.restart({ resume: { state: st, opponent: 'human' } });`,
  },
  { name: 'P2 board ready', action: 'waitFor', expression: `${GS}.state.current === 1 && ${GS}.boardStyle === 'hand' && !${GS}.busy`, timeout: 3000 },
  { name: 'settle for P2', action: 'wait', ms: 300 },
  { name: 'P2 sows pit 9', action: 'eval', code: `${GS}.choosePit(9);` },
  { name: 'P2 mid-sowing', action: 'wait', ms: 450 },
  { name: "it is P2's hand", action: 'expect', expect: { expression: `(({ visible, player }) => [visible, player])(${GS}.handState())`, equals: [true, 1] } },
  { name: 'style-hand-p2', action: 'screenshot' },
];
