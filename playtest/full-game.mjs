import { reachMenu } from './lib/common.mjs';
// Full game (R16, default 3 rounds): rounds end, pits are refilled, dead pits appear,
// and the game stops at the round limit (or earlier by R15). Played instantly.
const GS = `scene('GameScene')`;

export default [
  reachMenu,
  { name: 'key 2 starts a full game', action: 'press', key: '2' },
  {
    name: 'full game, 3 rounds',
    action: 'waitFor',
    expression: `game.scene.isActive('GameScene') && ${GS}.state.mode === 'full' && ${GS}.state.maxRounds === 3`,
    timeout: 5000,
  },
  { name: 'restart with a fixed first player', action: 'scene', key: 'GameScene', data: { mode: 'full', maxRounds: 3, firstPlayer: 0 } },
  {
    name: 'instant sowing',
    action: 'eval',
    code: `${GS}.reducedMotion = true; window.__maxRound = 1; window.__sawDead = false; window.__deadShown = 0; window.__deadWrong = []; window.__checks = 0;`,
  },
  {
    // Between moves the screen must show exactly the engine's dead pits (AC-R10–R12 on
    // screen): every pit drawn dead is dead, and every dead pit is drawn dead.
    name: 'play the whole full game, checking the dead pits on screen before every move',
    action: 'waitFor',
    expression: `(() => {
      if (game.scene.isActive('GameOverScene')) return true;
      const s = ${GS};
      window.__maxRound = Math.max(window.__maxRound, s.state.round);
      window.__sawDead = window.__sawDead || s.state.dead.some(Boolean);
      if (!s.busy && s.state.phase === 'playing') {
        window.__checks += 1;
        const shown = s.displayedDead();
        if (JSON.stringify(shown) !== JSON.stringify(s.state.dead)) window.__deadWrong.push(s.state.round);
        if (shown.some(Boolean)) window.__deadShown += 1;
        s.choosePit(s.legalPits()[0]);
      }
      return false;
    })()`,
    timeout: 60000,
    poll: 20,
  },
  { name: 'more than one round was played', action: 'expect', expect: { expression: `window.__maxRound`, atLeast: 2 } },
  { name: 'dead pits appeared between rounds', action: 'expect', expect: { expression: `window.__sawDead`, equals: true } },
  { name: 'the board was checked before every move', action: 'expect', expect: { expression: `window.__checks`, atLeast: 20 } },
  { name: 'dead pits were drawn on screen', action: 'expect', expect: { expression: `window.__deadShown`, atLeast: 1 } },
  { name: 'AC-R10–R12: the screen always matched the engine\'s dead pits', action: 'expect', expect: { expression: `window.__deadWrong`, equals: [] } },
  {
    name: 'the game ended by R16 or R15',
    action: 'expect',
    expect: { expression: `['roundLimit', 'cannotFill'].includes(scene('GameOverScene').result.reason)`, equals: true },
  },
  {
    name: 'result totals all 98 seeds',
    action: 'expect',
    expect: { expression: `scene('GameOverScene').result.stores[0] + scene('GameOverScene').result.stores[1]`, equals: 98 },
  },
  { name: 'full-game-over', action: 'screenshot' },

  // Round count (R16): menu row "เกมเต็มกี่รอบ" at y 184, x 148/202/256 (3/5/7 รอบ);
  // the full-game start button of row "แบบดั้งเดิม" is at (312, 104). Clicks are ×2.
  { name: 'Esc = back to the menu', action: 'press', key: 'Escape' },
  { name: 'menu again', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  { name: 'default is 3 rounds', action: 'expect', expect: { expression: `scene('MainMenuScene').rounds`, equals: 3 } },
  { name: 'click "7 รอบ"', action: 'click', x: 2 * 256, y: 2 * 184 },
  { name: 'menu now 7 rounds', action: 'expect', expect: { expression: `scene('MainMenuScene').rounds`, equals: 7 } },
  { name: 'menu-7-rounds', action: 'screenshot' },
  { name: 'click "แบบดั้งเดิม · เกมเต็ม · 7 รอบ"', action: 'click', x: 2 * 312, y: 2 * 104 },
  {
    name: 'a 7-round full game starts',
    action: 'waitFor',
    expression: `game.scene.isActive('GameScene') && ${GS}.state.mode === 'full' && ${GS}.state.maxRounds === 7`,
    timeout: 5000,
  },
];
