// AC-UI8: on a touch screen the first tap only highlights a pit, a second tap on the same
// pit sows it, a tap elsewhere cancels. Also: tap to skip, and the "one tap" setting.
// Runs with `--device phone-landscape` (844×390 @ dpr 3 → k = 4, zoom 4/3), so a base
// pixel is 4/3 CSS px: `at(x, y)` converts. Run via `npm run playtest:touch`.
import { reachMenu } from '../lib/common.mjs';

const GS = `scene('GameScene')`;
const Z = 4 / 3;
const tap = (name, x, y) => ({ name, action: 'tap', x: Math.round(x * Z), y: Math.round(y * Z) });
// Bottom row (P1) pit i is at x = 108 + 44 i, y = 158 (src/display/boardLayout.ts).
const pit = (i) => [108 + 44 * i, 158];

export default [
  reachMenu,
  { name: 'k = 4 on a landscape phone (AC-UI1 case 844×390 @ dpr 3)', action: 'expect', expect: { expression: `game.scale.zoom * devicePixelRatio`, equals: 4 } },
  tap('tap "เริ่มเกม" (traditional short by default)', 240, 195),
  { name: 'game started by touch', action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  { name: 'P1 first', action: 'scene', key: 'GameScene', data: { mode: 'short', firstPlayer: 0 } },
  { name: 'game ready', action: 'waitFor', expression: `${GS}.state && ${GS}.state.current === 0 && !${GS}.busy`, timeout: 3000 },
  { name: 'two taps by default', action: 'expect', expect: { expression: `${GS}.touchConfirm`, equals: true } },
  { name: 'phone-game', action: 'screenshot' },

  // First tap: highlight only, no PICKUP.
  tap('tap pit 2 once', ...pit(2)),
  { name: 'AC-UI8: pit 2 highlighted, nothing sown', action: 'expect', expect: { expression: `[${GS}.selectedPit, ${GS}.busy, ${GS}.lastMovePit]`, equals: [2, false, null] } },
  tap('tap pit 3 once', ...pit(3)),
  { name: 'a tap on another pit moves the highlight', action: 'expect', expect: { expression: `[${GS}.selectedPit, ${GS}.busy, ${GS}.lastMovePit]`, equals: [3, false, null] } },
  tap('tap empty space above the board', 240, 40),
  { name: 'AC-UI8: a tap elsewhere cancels', action: 'expect', expect: { expression: `[${GS}.selectedPit, ${GS}.busy]`, equals: [null, false] } },

  // Second tap on the same pit sows.
  tap('tap pit 2', ...pit(2)),
  tap('tap pit 2 again', ...pit(2)),
  { name: 'AC-UI8: the second tap sows pit 2', action: 'waitFor', expression: `${GS}.busy && ${GS}.lastMovePit === 2`, timeout: 500, poll: 10 },
  tap('tap anywhere to skip', 240, 40),
  { name: 'the skip finishes the move', action: 'waitFor', expression: `!${GS}.busy`, timeout: 500, poll: 10 },
  {
    name: 'screen matches the engine',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.displayedPits()) === JSON.stringify(${GS}.state.pits)`, equals: true },
  },

  // Setting "แตะครั้งเดียว": one tap sows at once.
  { name: 'choose one tap (as the Settings screen does)', action: 'eval', code: `game.registry.set('touchConfirm', 'single');` },
  { name: 'P1 first again', action: 'scene', key: 'GameScene', data: { mode: 'short', firstPlayer: 0 } },
  { name: 'game ready again', action: 'waitFor', expression: `${GS}.state && ${GS}.state.current === 0 && !${GS}.busy && ${GS}.touchConfirm === false`, timeout: 3000 },
  tap('tap pit 4 once', ...pit(4)),
  { name: 'one tap sows pit 4', action: 'waitFor', expression: `${GS}.lastMovePit === 4`, timeout: 500, poll: 10 },
];
