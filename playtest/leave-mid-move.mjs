// Leaving a game while a move is being shown: restart, menu, or giving up from the pause menu.
// The old move must stop there: it must not go on sowing on the new board, and nothing may
// touch objects that are gone (the harness fails on any uncaught error).
import { reachMenu } from './lib/common.mjs';

const GS = `scene('GameScene')`;
let opponent = 'human';
const midMove = (what) => [
  { name: `${what}: new game`, action: 'eval', code: `window.__old = ${GS}.state; game.registry.set('sowSpeed', 1); game.registry.set('reducedMotion', false); scene(game.scene.isActive('GameScene') ? 'GameScene' : game.scene.isActive('GameOverScene') ? 'GameOverScene' : 'MainMenuScene').scene.start('GameScene', { mode: 'short', firstPlayer: 0, opponent: '${opponent}', ruleset: 'video' });` },
  { name: `${what}: ready`, action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene') && ${GS}.state !== window.__old && !${GS}.busy && ${GS}.state.pits[2] === 7`, timeout: 4000 },
  { name: `${what}: sow`, action: 'eval', code: `${GS}.choosePit(2);` },
  { name: `${what}: two seeds are in`, action: 'waitFor', expression: `${GS}.displayedPits()[4] === 8`, timeout: 4000, poll: 10 },
  { name: `${what}: pause`, action: 'eval', code: `${GS}.openPause();` },
  { name: `${what}: paused`, action: 'waitFor', expression: `game.scene.isActive('PauseScene')`, timeout: 2000 },
  { name: `${what}: pause settles`, action: 'wait', ms: 150 },
];
/** For 2 s the board on screen is the engine's board whenever nobody is sowing. */
const watch = (what) => [
  { name: `${what}: watch`, action: 'eval', code: `window.__wrong = []; window.__seen = false; const t = setInterval(() => { const s = ${GS}; if (game.scene.isActive('GameScene') && !s.busy && JSON.stringify(s.displayedPits()) !== JSON.stringify(s.state.pits)) window.__wrong.push(s.displayedPits().join()); }, 25); setTimeout(() => { clearInterval(t); window.__seen = true; }, 2000);` },
  { name: `${what}: watched`, action: 'waitFor', expression: `window.__seen === true`, timeout: 4000 },
  { name: `${what}: the old sowing never shows up`, action: 'expect', expect: { expression: `window.__wrong.length`, equals: 0 } },
];

export default [
  reachMenu,
  ...['human', 'easy'].flatMap((o) => {
    opponent = o;
    return [
      ...midMove(`restart, ${o}`),
      { name: 'restart', action: 'eval', code: `${GS}.restartGame();` },
      { name: 'a fresh board', action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('PauseScene') && ${GS}.lastMovePit === null`, timeout: 2000, poll: 10 },
      ...watch(`restart, ${o}`),
      ...midMove(`menu, ${o}`),
      { name: 'to the menu', action: 'eval', code: `${GS}.quitToMenu();` },
      { name: 'menu', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene') && scene('MainMenuScene').hasSave`, timeout: 2000 },
      { name: 'let anything left over run', action: 'wait', ms: 900 },
      { name: 'continue', action: 'press', key: 'c' },
      // (Against the AI it may already be answering.)
      { name: 'the saved game continues after that move', action: 'waitFor', expression: `game.scene.isActive('GameScene') && ${GS}.state.pits[3] >= 8 && ${GS}.state.pits[7] >= 1 && ${GS}.state.pits.reduce((a, b) => a + b, 0) === 98`, timeout: 3000 },
      ...midMove(`give up, ${o}`),
      { name: 'give up', action: 'eval', code: `${GS}.resign();` },
      { name: 'result', action: 'waitFor', expression: `game.scene.isActive('GameOverScene')`, timeout: 2000 },
      { name: 'let anything left over run again', action: 'wait', ms: 900 },
      { name: 'still the result screen', action: 'expect', expect: { expression: `[game.scene.isActive('GameOverScene'), game.scene.isActive('GameScene')]`, equals: [true, false] } },
    ];
  }),
];
