// Every menu route of GDD §7 that exists so far (Title → Main Menu → Settings / Stats /
// Credits → back), settings that survive a reload and reach the game, and statistics
// counting a finished game. Clicks are base px × 2 (k = 2).
//   Main menu bottom row: ตั้งค่า (176, 243) · สถิติ (240, 243) · เครดิต (304, 243)
//   Settings: rows at y 58 / 88 / 118 / 148, options at x 282 / 380, "กลับ" at (240, 190)
import { TO_MENU } from './lib/common.mjs';

const MM = `scene('MainMenuScene')`;
const SET = `scene('SettingsScene')`;
const ST = `scene('StatsScene')`;
const GS = `scene('GameScene')`;
const DEFAULTS = { touch: 'แตะ 2 ครั้ง', motion: 'ปิด', vibration: 'เปิด', facing: 'ปิด' };
const CHOSEN = { touch: 'แตะครั้งเดียว', motion: 'เปิด', vibration: 'ปิด', facing: 'เปิด' };
const GAMES = `(() => { const r = ${ST}.stats.results; return Object.values(r).reduce((n, m) => n + Object.values(m).reduce((k, t) => k + t.p1 + t.p2 + t.draw, 0), 0); })()`;

let n = 0;
const keys = (key, count) => Array.from({ length: count }, () => ({ name: `${key} [${++n}]`, action: 'press', key }));

export default [
  // ── Title ── The harness clicks the canvas once after loading (to give it keyboard
  // focus), and that click is exactly what moves the title on to the menu.
  { name: 'the harness click passed the title', action: 'waitFor', expression: TO_MENU, timeout: 10000 },
  // Scene status 8 = SHUTDOWN: the title ran and finished before the menu.
  { name: 'boot showed the title screen first', action: 'expect', expect: { expression: `game.scene.getScene('TitleScene').sys.settings.status`, equals: 8 } },
  { name: 'open the title again', action: 'eval', code: `scene('MainMenuScene').scene.start('TitleScene');` },
  { name: 'title screen', action: 'waitFor', expression: `game.scene.isActive('TitleScene') && !game.scene.isActive('MainMenuScene')`, timeout: 3000 },
  { name: 'title', action: 'screenshot' },
  { name: 'any key leaves the title', action: 'press', key: 'x' },
  { name: 'main menu', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene') && !game.scene.isActive('TitleScene')`, timeout: 3000 },
  { name: 'open the title once more', action: 'eval', code: `scene('MainMenuScene').scene.start('TitleScene');` },
  { name: 'title again', action: 'waitFor', expression: `game.scene.isActive('TitleScene')`, timeout: 3000 },
  { name: 'a click leaves the title too', action: 'click', x: 480, y: 270 },
  { name: 'main menu again', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene') && !game.scene.isActive('TitleScene')`, timeout: 3000 },
  { name: 'menu', action: 'screenshot' },

  // ── Settings by keyboard ──
  ...keys('ArrowDown', 4),
  { name: 'focus on the bottom row, "ตั้งค่า"', action: 'expect', expect: { expression: `[${MM}.focusRow, ${MM}.focusCol]`, equals: ['pages', 0] } },
  { name: 'Enter opens Settings', action: 'press', key: 'Enter' },
  { name: 'settings screen', action: 'waitFor', expression: `game.scene.isActive('SettingsScene')`, timeout: 3000 },
  { name: 'defaults (facing off: owner 2026-11-24)', action: 'expect', expect: { expression: `${SET}.values()`, equals: DEFAULTS } },
  { name: 'settings', action: 'screenshot' },
  { name: '→ : one tap', action: 'press', key: 'ArrowRight' },
  ...keys('ArrowDown', 1),
  { name: 'Enter toggles reduced motion on', action: 'press', key: 'Enter' },
  ...keys('ArrowDown', 1),
  { name: '→ : vibration off', action: 'press', key: 'ArrowRight' },
  { name: 'click "เปิด" on the facing row', action: 'click', x: 2 * 380, y: 2 * 148 },
  { name: 'all four changed', action: 'expect', expect: { expression: `${SET}.values()`, equals: CHOSEN } },
  { name: 'the click moved the focus to its row', action: 'expect', expect: { expression: `${SET}.focus`, equals: 3 } },
  { name: 'settings-changed', action: 'screenshot' },
  ...keys('ArrowDown', 1),
  { name: 'focus on "กลับ"', action: 'expect', expect: { expression: `${SET}.focus`, equals: 4 } },
  { name: 'Enter = back', action: 'press', key: 'Enter' },
  { name: 'menu, focus back on "ตั้งค่า"', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene') && ${MM}.focusRow === 'pages' && ${MM}.focusCol === 0`, timeout: 3000 },

  // ── Stats and Credits by keyboard, then by mouse ──
  { name: '→ to "สถิติ"', action: 'press', key: 'ArrowRight' },
  { name: 'Enter opens Stats', action: 'press', key: 'Enter' },
  { name: 'stats screen', action: 'waitFor', expression: `game.scene.isActive('StatsScene')`, timeout: 3000 },
  { name: 'no games yet', action: 'expect', expect: { expression: GAMES, equals: 0 } },
  { name: 'stats', action: 'screenshot' },
  { name: 'Esc = back', action: 'press', key: 'Escape' },
  { name: 'menu, focus on "สถิติ"', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene') && ${MM}.focusCol === 1`, timeout: 3000 },
  { name: '→ to "เครดิต"', action: 'press', key: 'ArrowRight' },
  { name: 'Enter opens Credits', action: 'press', key: 'Enter' },
  { name: 'credits screen', action: 'waitFor', expression: `game.scene.isActive('CreditsScene')`, timeout: 3000 },
  { name: 'credits', action: 'screenshot' },
  { name: 'Esc = back ', action: 'press', key: 'Escape' },
  { name: 'menu, focus on "เครดิต"', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene') && ${MM}.focusCol === 2`, timeout: 3000 },
  { name: 'click "สถิติ"', action: 'click', x: 2 * 240, y: 2 * 243 },
  { name: 'stats by mouse', action: 'waitFor', expression: `game.scene.isActive('StatsScene')`, timeout: 3000 },
  { name: 'click "กลับ" on stats', action: 'click', x: 2 * 200, y: 2 * 220 },
  { name: 'menu again', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 3000 },
  { name: 'click "ตั้งค่า"', action: 'click', x: 2 * 176, y: 2 * 243 },
  { name: 'settings by mouse', action: 'waitFor', expression: `game.scene.isActive('SettingsScene')`, timeout: 3000 },
  { name: 'settings were kept', action: 'expect', expect: { expression: `${SET}.values()`, equals: CHOSEN } },
  { name: 'click "กลับ" on settings', action: 'click', x: 2 * 240, y: 2 * 190 },
  { name: 'menu once more', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 3000 },
  { name: 'click "เครดิต"', action: 'click', x: 2 * 304, y: 2 * 243 },
  { name: 'credits by mouse', action: 'waitFor', expression: `game.scene.isActive('CreditsScene')`, timeout: 3000 },
  { name: 'click "กลับ" on credits', action: 'click', x: 2 * 240, y: 2 * 214 },
  { name: 'back on the menu', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 3000 },

  // ── Settings survive a reload (AC-S2). After a reload only keys and expressions work. ──
  { name: 'reload the page', action: 'eval', code: `setTimeout(() => location.reload(), 50);` },
  { name: 'let it reload', action: 'wait', ms: 1500 },
  {
    name: 'title, then menu after the reload',
    action: 'waitFor',
    expression: `(() => {
      if (window.__PHASER_GAME__) window.__playtestGame = window.__PHASER_GAME__;
      const game = window.__playtestGame;
      if (!game) return false;
      return ${TO_MENU};
    })()`,
    timeout: 15000,
  },
  ...keys('ArrowDown', 4),
  { name: 'Enter opens Settings ', action: 'press', key: 'Enter' },
  { name: 'settings after the reload', action: 'waitFor', expression: `game.scene.isActive('SettingsScene')`, timeout: 3000 },
  { name: 'AC-S2: the settings survived the reload', action: 'expect', expect: { expression: `${SET}.values()`, equals: CHOSEN } },
  { name: 'Esc = back  ', action: 'press', key: 'Escape' },
  { name: 'menu after settings', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 3000 },

  // ── The settings reach the game ──
  { name: 'key 1 = two-player short game', action: 'press', key: '1' },
  { name: 'game', action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  {
    name: 'one tap, reduced motion, no vibration, P2 upside down',
    action: 'expect',
    expect: { expression: `[${GS}.touchConfirm, ${GS}.reducedMotion, ${GS}.vibration, ${GS}.facing, ${GS}.p2UpsideDown]`, equals: [false, true, false, true, true] },
  },
  {
    name: 'play to the end (reduced motion = instant)',
    action: 'waitFor',
    expression: `(() => {
      if (game.scene.isActive('GameOverScene')) return true;
      const s = ${GS};
      if (!s.busy && s.state.phase === 'playing') s.choosePit(s.legalPits()[0]);
      return false;
    })()`,
    timeout: 60000,
    poll: 20,
  },
  { name: 'remember the game records', action: 'eval', code: `window.__rec = scene('GameOverScene').result.records;` },
  { name: 'the result has records', action: 'expect', expect: { expression: `Array.isArray(window.__rec.maxCapture) && Array.isArray(window.__rec.maxRelay)`, equals: true } },
  { name: 'Esc = menu', action: 'press', key: 'Escape' },
  { name: 'menu after the game', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 3000 },

  // ── Stats counted the game ──
  ...keys('ArrowDown', 4),
  { name: '→ "สถิติ"', action: 'press', key: 'ArrowRight' },
  { name: 'Enter opens Stats ', action: 'press', key: 'Enter' },
  { name: 'stats after a game', action: 'waitFor', expression: `game.scene.isActive('StatsScene')`, timeout: 3000 },
  { name: 'one game counted', action: 'expect', expect: { expression: GAMES, equals: 1 } },
  { name: 'it is a two-player short game', action: 'expect', expect: { expression: `(() => { const t = ${ST}.stats.results.human.short; return t.p1 + t.p2 + t.draw; })()`, equals: 1 } },
  {
    name: 'records: best of both people (two-player game)',
    action: 'expect',
    expect: {
      expression: `JSON.stringify([${ST}.stats.bestCapture, ${ST}.stats.longestRelay]) === JSON.stringify([Math.max(...window.__rec.maxCapture), Math.max(...window.__rec.maxRelay)])`,
      equals: true,
    },
  },
  { name: '→ "ล้างสถิติ"', action: 'press', key: 'ArrowRight' },
  { name: 'Enter once asks to confirm', action: 'press', key: 'Enter' },
  { name: 'asks to confirm, nothing cleared yet', action: 'expect', expect: { expression: `[${ST}.confirmingClear, ${GAMES}]`, equals: [true, 1] } },
  { name: 'Enter again clears', action: 'press', key: 'Enter' },
  { name: 'stats cleared', action: 'expect', expect: { expression: GAMES, equals: 0 } },
  { name: 'Esc = back   ', action: 'press', key: 'Escape' },
  { name: 'menu at the end', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 3000 },
];
