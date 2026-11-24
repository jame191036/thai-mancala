// AC-UI3: time per seed at each sowing speed, ±10 ms. One move of 10 seeds per speed:
// video rules, P1 sows pit 0 (10 seeds) → last seed lands on P2's occupied pit 10 → the
// turn ends, so no relays and no extra pauses. GameScene records when every seed lands
// (`dropTimes`, scene clock); the average gap between seeds is compared with the target.
import { reachMenu } from './lib/common.mjs';

const GS = `scene('GameScene')`;
const BOARD = [10, 7, 7, 7, 7, 7, 4, 0, 7, 7, 7, 7, 7, 7, 7, 0]; // 98 seeds
const SPEEDS = [
  { speed: 0.25, label: 'ช้ามาก', ms: 480 },
  { speed: 0.5, label: 'ช้า', ms: 240 },
  { speed: 1, label: 'ปกติ', ms: 120 },
  { speed: 2, label: 'เร็ว', ms: 60 },
  { speed: 4, label: 'เร็วมาก', ms: 30 },
];
const MEAN = `(() => { const t = ${GS}.dropTimes; return (t[t.length - 1] - t[0]) / (t.length - 1); })()`;

const measure = ({ speed, label, ms }) => [
  {
    name: `${label}: load the 10-seed board`,
    action: 'eval',
    code: `const s = ${GS}; const st = JSON.parse(JSON.stringify(s.state));
      st.pits = ${JSON.stringify(BOARD)}; st.current = 0; st.ruleset = 'video'; st.phase = 'playing';
      s.scene.restart({ resume: { state: st, opponent: 'human' } });`,
  },
  { name: `${label}: board ready`, action: 'waitFor', expression: `${GS}.state && ${GS}.state.pits[0] === 10 && !${GS}.busy`, timeout: 3000 },
  { name: `${label}: sow pit 0 at ×${speed}`, action: 'eval', code: `${GS}.speed = ${speed}; ${GS}.reducedMotion = false; ${GS}.choosePit(0);` },
  { name: `${label}: move finished`, action: 'waitFor', expression: `!${GS}.busy`, timeout: 15000, poll: 20 },
  { name: `${label}: all 10 seeds timed`, action: 'expect', expect: { expression: `${GS}.dropTimes.length`, equals: 10 } },
  { name: `${label}: average ≥ ${ms - 10} ms per seed`, action: 'expect', expect: { expression: MEAN, atLeast: ms - 10 } },
  { name: `${label}: average ≤ ${ms + 10} ms per seed`, action: 'expect', expect: { expression: MEAN, atMost: ms + 10 } },
];

export default [
  reachMenu,
  { name: 'key 1 = short game', action: 'press', key: '1' },
  { name: 'game', action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  ...SPEEDS.flatMap(measure),
];
