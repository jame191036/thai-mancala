import { reachMenu } from './lib/common.mjs';
// Smoke scenario: menu → short game → a real mouse click sows seed by seed → the board
// on screen matches the rules engine → play to the end → result screen.
//
// Click coordinates are CSS pixels on the canvas. At the harness default viewport
// (1280×720, dpr 1) the game is shown at k = 2 (see playtest/scale.mjs), so a game
// position (x, y) is clicked at (2x, 2y). P1 pit 2 is at game (196, 158).
const GS = `scene('GameScene')`;

export default [
  reachMenu,
  { name: 'Space starts a short game', action: 'press', key: 'Space' },
  {
    name: 'game scene is running and the menu has closed',
    action: 'waitFor',
    expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene') && ${GS}.state?.phase === 'playing'`,
    timeout: 5000,
  },
  {
    name: 'new board shows 7 seeds in every pit and empty stores',
    action: 'expect',
    expect: { expression: `${GS}.displayedPits()`, equals: [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0] },
  },

  {
    name: 'one marble on the board for every seed',
    action: 'expect',
    expect: { expression: `${GS}.displayedSeeds()`, equals: [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0] },
  },
  // Fixed start so the click lands on the current player's pit.
  { name: 'restart with P1 to move', action: 'scene', key: 'GameScene', data: { mode: 'short', firstPlayer: 0 } },
  { name: 'P1 to move', action: 'expect', expect: { expression: `${GS}.state.current`, equals: 0 } },
  { name: 'click P1 pit 2 with the mouse', action: 'click', x: 392, y: 316 },
  {
    name: 'the move animates (sowing is in progress)',
    action: 'waitFor',
    expression: `${GS}.busy === true`,
    timeout: 1000,
    poll: 20,
  },
  {
    name: 'while sowing, the turn marker shows the mover (P1), not the next player',
    action: 'expect',
    expect: { expression: `${GS}.sowingPlayer`, equals: 0 },
  },
  { name: 'mid-sow screenshot', action: 'screenshot' },
  {
    name: 'sowing finishes',
    action: 'waitFor',
    expression: `${GS}.busy === false`,
    timeout: 15000,
  },
  {
    // Pit 2: 7 seeds → 3,4,5,6,store,8,9; pit 9 had seeds → relay 8 → 10..14,0,1,2;
    // pit 2 was empty → capture opposite pit 12 (8) + 1 → P1 store 10. Then P2's turn.
    name: 'engine result: relay + capture from the opening move',
    action: 'expect',
    expect: { expression: `${GS}.state.pits`, equals: [8, 8, 0, 8, 8, 8, 8, 10, 8, 0, 8, 8, 0, 8, 8, 0] },
  },
  {
    name: 'the screen shows exactly the engine state',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.displayedPits()) === JSON.stringify(${GS}.state.pits)`, equals: true },
  },
  {
    name: 'the marbles match the board after the move',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.displayedSeeds()) === JSON.stringify(${GS}.state.pits)`, equals: true },
  },
  { name: 'turn passes to P2', action: 'expect', expect: { expression: `${GS}.state.current`, equals: 1 } },
  { name: 'after-first-move', action: 'screenshot' },

  // Play the rest instantly to reach the result screen.
  { name: 'switch to instant sowing', action: 'eval', code: `${GS}.reducedMotion = true` },
  {
    name: 'play to the end (first legal pit each turn)',
    action: 'waitFor',
    expression: `(() => {
      if (game.scene.isActive('GameOverScene')) return true;
      const s = ${GS};
      if (!s.busy && s.state.phase === 'playing') s.choosePit(s.legalPits()[0]);
      return false;
    })()`,
    timeout: 30000,
    poll: 20,
  },
  {
    name: 'result screen totals all 98 seeds',
    action: 'expect',
    expect: { expression: `scene('GameOverScene').result.stores[0] + scene('GameOverScene').result.stores[1]`, equals: 98 },
  },
  {
    name: 'short game ends by its single round',
    action: 'expect',
    expect: { expression: `scene('GameOverScene').result.reason`, equals: 'singleRound' },
  },
  { name: 'game-over', action: 'screenshot' },
];
