// "แบบตามวิดีโอ" (R17, ruleset 'video'): its own start buttons on the menu, carried
// into the game and into a rematch; while a round is running neither side is ever empty.
//
// Menu buttons (base px, see MENU_LAYOUT in src/scenes/MainMenuScene.ts): row "แบบตามวิดีโอ"
// at y 194, short game x 168, full game x 312. Clicks are CSS px at k = 2 → ×2.
const GS = `scene('GameScene')`;

export default [
  {
    name: 'reaches the main menu',
    action: 'waitFor',
    expression: `game.scene.isActive('MainMenuScene')`,
    timeout: 10000,
  },
  { name: 'menu', action: 'screenshot' },
  { name: 'click "แบบตามวิดีโอ · เกมสั้น"', action: 'click', x: 2 * 168, y: 2 * 194 },
  {
    name: 'a short game with the video ruleset starts',
    action: 'waitFor',
    expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene') && ${GS}.state.ruleset === 'video' && ${GS}.state.mode === 'short'`,
    timeout: 5000,
  },

  // A real click: no relay in this ruleset. P1 pit 2 (7 seeds) → 3,4,5,6,store,8,9; pit 9
  // already had seeds, so the turn simply ends (the traditional rules would relay here).
  { name: 'restart with P1 first', action: 'scene', key: 'GameScene', data: { mode: 'short', ruleset: 'video', firstPlayer: 0 } },
  { name: 'click P1 pit 2', action: 'click', x: 392, y: 328 },
  { name: 'sowing starts', action: 'waitFor', expression: `${GS}.busy === true`, timeout: 1000, poll: 20 },
  { name: 'sowing ends', action: 'waitFor', expression: `${GS}.busy === false`, timeout: 15000 },
  {
    name: 'no relay: the turn ended on the occupied pit 9',
    action: 'expect',
    expect: { expression: `${GS}.state.pits`, equals: [7, 7, 0, 8, 8, 8, 8, 1, 8, 8, 7, 7, 7, 7, 7, 0] },
  },
  { name: 'P2 to move', action: 'expect', expect: { expression: `${GS}.state.current`, equals: 1 } },
  {
    name: 'screen matches the engine',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.displayedPits()) === JSON.stringify(${GS}.state.pits)`, equals: true },
  },
  { name: 'video-first-move', action: 'screenshot' },

  { name: 'instant sowing', action: 'eval', code: `${GS}.reducedMotion = true; window.__emptySideWhilePlaying = false;` },
  {
    name: 'play to the end (first legal pit each turn)',
    action: 'waitFor',
    expression: `(() => {
      if (game.scene.isActive('GameOverScene')) return true;
      const s = ${GS};
      const p = s.state.pits;
      const side = (a, b) => p.slice(a, b).reduce((x, y) => x + y, 0);
      if (s.state.phase === 'playing' && !s.busy && (side(0, 7) === 0 || side(8, 15) === 0)) window.__emptySideWhilePlaying = true;
      if (!s.busy && s.state.phase === 'playing') s.choosePit(s.legalPits()[0]);
      return false;
    })()`,
    timeout: 30000,
    poll: 20,
  },
  { name: 'no side was ever empty while the round was running', action: 'expect', expect: { expression: `window.__emptySideWhilePlaying`, equals: false } },
  { name: 'result shows the ruleset', action: 'expect', expect: { expression: `scene('GameOverScene').result.ruleset`, equals: 'video' } },
  {
    name: 'every seed was counted (leftovers went to their owner)',
    action: 'expect',
    expect: { expression: `scene('GameOverScene').result.stores[0] + scene('GameOverScene').result.stores[1]`, equals: 98 },
  },
  { name: 'game-over-side-empty', action: 'screenshot' },
  { name: 'Space = rematch', action: 'press', key: 'Space' },
  {
    name: 'the rematch keeps the video ruleset',
    action: 'waitFor',
    expression: `game.scene.isActive('GameScene') && ${GS}.state.ruleset === 'video' && ${GS}.state.phase === 'playing'`,
    timeout: 5000,
  },

  // Back to the menu; key 4 = "แบบตามวิดีโอ · เกมเต็ม".
  { name: 'finish instantly and go to the result', action: 'eval', code: `${GS}.reducedMotion = true;` },
  {
    name: 'play the rematch to the end',
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
  { name: 'Esc = menu', action: 'press', key: 'Escape' },
  { name: 'back on the menu', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  { name: 'key 4', action: 'press', key: '4' },
  {
    name: 'a full game with the video ruleset starts',
    action: 'waitFor',
    expression: `game.scene.isActive('GameScene') && ${GS}.state.ruleset === 'video' && ${GS}.state.mode === 'full' && ${GS}.state.maxRounds === 3`,
    timeout: 5000,
  },
];
