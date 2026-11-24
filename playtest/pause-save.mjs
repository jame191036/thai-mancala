import { reachMenu } from './lib/common.mjs';
// Pause menu and save/resume (GDD §7 pause, AC-S1): play a few moves, pause, resume,
// go back to the menu, RELOAD THE PAGE, continue the saved game exactly, then resign.
// In-game "≡ พักเกม" button: right-aligned at base (468, 236) → click (440, 236) ×2.
const GS = `scene('GameScene')`;
const PAUSED = `game.scene.isActive('PauseScene') && game.scene.isPaused('GameScene')`;

export default [
  reachMenu,
  { name: 'no saved game yet', action: 'expect', expect: { expression: `scene('MainMenuScene').hasSave`, equals: false } },
  // Settings chosen now must survive the reload below (AC-S2): "ช้า" (202, 220), "5 รอบ" (202, 194).
  { name: 'pick speed ช้า', action: 'click', x: 2 * 202, y: 2 * 220 },
  { name: 'pick 5 rounds', action: 'click', x: 2 * 202, y: 2 * 194 },
  { name: 'key 2 = full game', action: 'press', key: '2' },
  { name: 'menu closed', action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  { name: 'instant sowing', action: 'eval', code: `${GS}.reducedMotion = true; window.__moves = 0;` },
  {
    name: 'play 3 moves',
    action: 'waitFor',
    expression: `(() => {
      const s = ${GS};
      if (s.busy || s.state.phase !== 'playing') return false;
      if (window.__moves >= 3) return true;
      window.__moves += 1;
      s.choosePit(s.legalPits()[0]);
      return false;
    })()`,
    timeout: 10000,
    poll: 30,
  },
  { name: 'remember the board', action: 'eval', code: `sessionStorage.setItem('__expect', JSON.stringify(${GS}.state));` },

  // Pause with the on-screen button, resume with Esc.
  { name: 'click "≡ พักเกม"', action: 'click', x: 2 * 440, y: 2 * 236 },
  { name: 'pause menu open, game frozen', action: 'waitFor', expression: PAUSED, timeout: 2000 },
  { name: 'pause-menu', action: 'screenshot' },
  { name: 'Esc resumes', action: 'press', key: 'Escape' },
  {
    name: 'game running again',
    action: 'waitFor',
    expression: `!game.scene.isActive('PauseScene') && game.scene.isActive('GameScene') && !game.scene.isPaused('GameScene')`,
    timeout: 2000,
  },

  // P pauses; ↓↓↓ + Enter = "กลับเมนู (บันทึกเกมไว้)".
  { name: 'P pauses', action: 'press', key: 'p' },
  { name: 'paused again', action: 'waitFor', expression: PAUSED, timeout: 2000 },
  { name: '↓', action: 'press', key: 'ArrowDown' },
  { name: '↓ ', action: 'press', key: 'ArrowDown' },
  { name: '↓  ', action: 'press', key: 'ArrowDown' },
  { name: 'focus on "กลับเมนู"', action: 'expect', expect: { expression: `scene('PauseScene').focus`, equals: 3 } },
  { name: 'Enter', action: 'press', key: 'Enter' },
  { name: 'back on the menu', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 3000 },
  { name: 'the menu offers to continue', action: 'expect', expect: { expression: `scene('MainMenuScene').hasSave`, equals: true } },

  // Reload the page: the save must survive it.
  { name: 'reload the page', action: 'eval', code: `setTimeout(() => location.reload(), 50);` },
  { name: 'let it reload', action: 'wait', ms: 1500 },
  {
    name: 'menu after reload',
    action: 'waitFor',
    expression: `(() => {
      if (window.__PHASER_GAME__) window.__playtestGame = window.__PHASER_GAME__;
      const g = window.__playtestGame;
      if (g && g.scene.isActive('TitleScene')) g.scene.getScene('TitleScene').start();
      return !!g && g.scene.isActive('MainMenuScene');
    })()`,
    timeout: 15000,
  },
  { name: 'still a saved game after the reload', action: 'expect', expect: { expression: `scene('MainMenuScene').hasSave`, equals: true } },
  {
    name: 'AC-S2: settings survived the reload (speed ช้า, 5 rounds)',
    action: 'expect',
    expect: { expression: `[scene('MainMenuScene').speed, scene('MainMenuScene').rounds]`, equals: [0.5, 5] },
  },
  // NOTE: after a reload the harness still holds the old <canvas> handle, so only key
  // presses and expressions work from here on (no 'click' or 'screenshot').
  { name: 'C = continue', action: 'press', key: 'c' },
  { name: 'game resumed', action: 'waitFor', expression: `game.scene.isActive('GameScene')`, timeout: 5000 },
  { name: 'it is the 5-round game', action: 'expect', expect: { expression: `${GS}.state.maxRounds`, equals: 5 } },
  {
    name: 'AC-S1: exactly the saved position (board, round, whose turn, dead pits)',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.state) === sessionStorage.getItem('__expect')`, equals: true },
  },
  {
    name: 'the screen shows the saved board',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.displayedPits()) === JSON.stringify(${GS}.state.pits)`, equals: true },
  },

  // Resign: ↓↓ + Enter.
  { name: 'P pauses', action: 'press', key: 'p' },
  { name: 'paused', action: 'waitFor', expression: PAUSED, timeout: 2000 },
  { name: '↓', action: 'press', key: 'ArrowDown' },
  { name: '↓ ', action: 'press', key: 'ArrowDown' },
  { name: 'Enter = ยอมแพ้', action: 'press', key: 'Enter' },
  { name: 'result screen', action: 'waitFor', expression: `game.scene.isActive('GameOverScene')`, timeout: 3000 },
  { name: 'the game ended by resignation', action: 'expect', expect: { expression: `scene('GameOverScene').result.reason`, equals: 'resigned' } },
  { name: 'Esc = menu', action: 'press', key: 'Escape' },
  { name: 'menu', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 3000 },
  { name: 'a finished game leaves no save', action: 'expect', expect: { expression: `scene('MainMenuScene').hasSave`, equals: false } },
];
