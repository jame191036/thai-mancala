import { reachMenu } from './lib/common.mjs';
// Sowing speed setting: picked on the menu, used in the game, and the slow settings really
// slow the seeds down. Menu row "ความเร็วหว่าน" at y 158, x 148/202/256/310/364
// (ช้ามาก … เร็วมาก, see MENU_LAYOUT); clicks are ×2.
//
// P1 pit 2 holds 7 seeds: the 5th seed lands in P1's store (slot 7). At ปกติ (120 ms a
// seed) that is ~0.7 s after the click; at ช้ามาก (480 ms a seed) it is ~2.9 s.
const GS = `scene('GameScene')`;

export default [
  reachMenu,
  { name: 'default speed is ปกติ', action: 'expect', expect: { expression: `scene('MainMenuScene').speed`, equals: 1 } },
  { name: 'click "ช้ามาก"', action: 'click', x: 2 * 148, y: 2 * 158 },
  { name: 'menu speed is ช้ามาก', action: 'expect', expect: { expression: `scene('MainMenuScene').speed`, equals: 0.25 } },
  { name: 'menu-speed', action: 'screenshot' },
  { name: 'Space starts a game', action: 'press', key: 'Space' },
  {
    name: 'menu closed',
    action: 'waitFor',
    expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene')`,
    timeout: 5000,
  },
  { name: 'restart with P1 first (the setting carries over)', action: 'scene', key: 'GameScene', data: { mode: 'short', firstPlayer: 0 } },
  { name: 'the game uses ช้ามาก', action: 'expect', expect: { expression: `${GS}.speed`, equals: 0.25 } },
  { name: 'click P1 pit 2', action: 'click', x: 392, y: 316 },
  { name: '1 second later', action: 'wait', ms: 1000 },
  {
    name: 'still sowing, and the store has not been reached yet (it would have at ปกติ)',
    action: 'expect',
    expect: { expression: `${GS}.busy === true && ${GS}.displayedPits()[7] === 0`, equals: true },
  },
  { name: 'slow-sowing', action: 'screenshot' },
  {
    name: 'the 5th seed reaches the store a few seconds in',
    action: 'waitFor',
    expression: `${GS}.displayedPits()[7] === 1`,
    timeout: 6000,
    poll: 50,
  },
  { name: 'tap to skip the rest', action: 'click', x: 480, y: 30 },
  { name: 'move finished', action: 'waitFor', expression: `${GS}.busy === false`, timeout: 1000, poll: 20 },
];
