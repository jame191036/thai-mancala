// The title screen's board plays by itself (GDD §7, attract mode): real rules, marble by marble,
// game after game, nothing saved; any key leaves it at once; reduced motion keeps it still.
import { reachMenu } from './lib/common.mjs';

const T = `scene('TitleScene')`;
const SUM = `${T}.demo.shown.reduce((a, b) => a + b, 0)`;
const openTitle = (from = 'MainMenuScene') => [
  { name: 'open the title', action: 'eval', code: `scene('${from}').scene.start('TitleScene');` },
  { name: 'title', action: 'waitFor', expression: `game.scene.isActive('TitleScene') && !game.scene.isActive('MainMenuScene')`, timeout: 3000 },
];

export default [
  reachMenu,
  { name: 'remember the storage', action: 'eval', code: `window.__storage = JSON.stringify(localStorage);` },
  ...openTitle(),
  { name: 'a full board: 7 in every pit', action: 'expect', expect: { expression: `[${T}.demo.shown, ${T}.demo.drawn(), ${T}.demo.moves]`, equals: [[7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0], [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0], 0] } },
  { name: 'it starts by itself', action: 'waitFor', expression: `${SUM} < 98`, timeout: 4000, poll: 20 },
  { name: 'a marble is in the air now and then', action: 'waitFor', expression: `${T}.demo.flying.visible`, timeout: 2000, poll: 10 },
  { name: 'on whole pixels', action: 'expect', expect: { expression: `[...${T}.demo.piles.flat(), ${T}.demo.flying].every((m) => Number.isInteger(m.x) && Number.isInteger(m.y))`, equals: true } },
  { name: 'title-playing', action: 'screenshot' },

  // ── Fast-forward: whole games, always in step with the engine ──
  {
    name: 'watch every move',
    action: 'eval',
    code: `const d = ${T}.demo; d.pace = 0.004; window.__bad = []; window.__states = 0; let last = -1;
      ${T}.events.on('postupdate', () => { if (d.moves === last) return; last = d.moves; window.__states += 1;
        if (d.shown.reduce((a, b) => a + b, 0) > 98) window.__bad.push(['too many', ...d.shown]);
        if (d.state.pits.reduce((a, b) => a + b, 0) !== 98) window.__bad.push(['engine', ...d.state.pits]); });`,
  },
  { name: 'games end and new ones begin', action: 'waitFor', expression: `${T}.demo.games >= 3`, timeout: 60000 },
  { name: 'in step all the way', action: 'expect', expect: { expression: `window.__bad`, equals: [] } },
  { name: 'many moves were watched', action: 'expect', expect: { expression: `window.__states`, atLeast: 5 } },
  { name: 'marbles drawn never exceed the seeds, nor the 98', action: 'expect', expect: { expression: `${T}.demo.drawn().every((n, i) => n <= ${T}.demo.shown[i]) && ${T}.demo.piles.flat().length + ${T}.demo.spare.length <= 98`, equals: true } },
  { name: 'nothing was saved or counted', action: 'expect', expect: { expression: `JSON.stringify(localStorage) === window.__storage`, equals: true } },

  // ── Leaving in the middle of a move, and coming back ──
  { name: 'normal pace', action: 'eval', code: `${T}.demo.pace = 1;` },
  { name: 'a move is under way', action: 'waitFor', expression: `${T}.demo.flying.visible`, timeout: 8000, poll: 10 },
  { name: 'any key leaves', action: 'press', key: 'x' },
  { name: 'menu', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene') && !game.scene.isActive('TitleScene')`, timeout: 600, poll: 20 },
  { name: 'wait for timers that should be gone', action: 'wait', ms: 900 },
  ...openTitle(),
  { name: 'a fresh board again', action: 'expect', expect: { expression: `[${T}.demo.moves, ${T}.demo.games, ${SUM}]`, equals: [0, 1, 98] } },

  // ── Reduced motion ──
  { name: 'reduced motion', action: 'eval', code: `game.registry.set('reducedMotion', true); ${T}.scene.restart();` },
  { name: 'restarted', action: 'wait', ms: 300 },
  { name: 'wait longer than the first move would take', action: 'wait', ms: 2000 },
  { name: 'the board lies still', action: 'expect', expect: { expression: `[${T}.demo.moves, ${SUM}, ${T}.demo.flying.visible]`, equals: [0, 98, false] } },
  { name: 'title-still', action: 'screenshot' },
];
