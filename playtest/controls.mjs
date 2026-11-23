// Controls: tap-anywhere skip (AC-UI4), speed button (AC-UI3), keyboard play, and
// clicks on pits that may not be played. Click coordinates: see smoke.mjs (k = 2).
const GS = `scene('GameScene')`;

export default [
  {
    name: 'reaches the main menu',
    action: 'waitFor',
    expression: `game.scene.isActive('MainMenuScene')`,
    timeout: 10000,
  },
  // Enter the game through the menu first, so MainMenuScene really shuts down (the
  // harness `scene` action alone would leave the menu running, and its Enter key too).
  { name: 'Space starts a game from the menu', action: 'press', key: 'Space' },
  { name: 'menu has closed', action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  { name: 'restart with P1 first', action: 'scene', key: 'GameScene', data: { mode: 'short', firstPlayer: 0 } },

  // Illegal clicks do nothing.
  { name: 'click a P2 pit (top row, pit 10) on P1 turn', action: 'click', x: 2 * 284, y: 2 * 106 },
  { name: 'click the P1 store', action: 'click', x: 2 * 424, y: 2 * 135 },
  { name: 'nothing moved', action: 'expect', expect: { expression: `${GS}.busy`, equals: false } },
  {
    name: 'board unchanged',
    action: 'expect',
    expect: { expression: `${GS}.state.pits`, equals: [7, 7, 7, 7, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0] },
  },

  // Skip: tap anywhere during sowing → final state within ~100 ms (AC-UI4).
  { name: 'click P1 pit 2', action: 'click', x: 392, y: 328 },
  { name: 'sowing started', action: 'waitFor', expression: `${GS}.busy === true`, timeout: 1000, poll: 20 },
  { name: 'let a few seeds drop', action: 'wait', ms: 200 },
  { name: 'still animating before the skip', action: 'expect', expect: { expression: `${GS}.busy`, equals: true } },
  { name: 'click empty space to skip', action: 'click', x: 480, y: 30 },
  {
    name: 'AC-UI4: move finishes right after the skip',
    action: 'waitFor',
    expression: `${GS}.busy === false`,
    timeout: 150,
    poll: 10,
  },
  {
    name: 'skipped move lands on the same final board',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.displayedPits()) === JSON.stringify(${GS}.state.pits)`, equals: true },
  },
  {
    name: 'and it is the engine result for that move',
    action: 'expect',
    expect: { expression: `${GS}.state.pits`, equals: [8, 8, 0, 8, 8, 8, 8, 10, 8, 0, 8, 8, 0, 8, 8, 0] },
  },

  // Speed button cycles ×1 → ×2 → ×4 → ×1 (F key does the same).
  { name: 'press F', action: 'press', key: 'f' },
  { name: 'speed ×2', action: 'expect', expect: { expression: `${GS}.speed`, equals: 2 } },
  { name: 'click the speed button', action: 'click', x: 2 * 460, y: 2 * 14 },
  { name: 'speed ×4', action: 'expect', expect: { expression: `${GS}.speed`, equals: 4 } },

  // Keyboard: P2 to move; → selects the leftmost legal pit on screen, Enter sows.
  { name: 'P2 to move', action: 'expect', expect: { expression: `${GS}.state.current`, equals: 1 } },
  { name: '→ selects a pit', action: 'press', key: 'ArrowRight' },
  {
    name: 'a legal P2 pit is selected (leftmost on screen = 14)',
    action: 'expect',
    expect: { expression: `${GS}.selectedPit`, equals: 14 },
  },
  { name: 'Enter sows it', action: 'press', key: 'Enter' },
  { name: 'keyboard move animates', action: 'waitFor', expression: `${GS}.busy === true`, timeout: 1000, poll: 20 },
  { name: 'it sowed the selected pit', action: 'expect', expect: { expression: `${GS}.lastMovePit`, equals: 14 } },
  { name: 'keyboard move finishes', action: 'waitFor', expression: `${GS}.busy === false`, timeout: 15000 },
  {
    name: 'screen matches engine after the keyboard move',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.displayedPits()) === JSON.stringify(${GS}.state.pits)`, equals: true },
  },
  {
    name: 'seeds conserved',
    action: 'expect',
    expect: { expression: `${GS}.state.pits.reduce((a, b) => a + b, 0)`, equals: 98 },
  },

  // Regression: → and Enter arriving within ONE frame. Phaser 4.2.1 re-dispatches queued
  // key events in that case; before the fix → fired twice (wrong pit) and the second
  // Enter skipped the move it had just started. Dispatched synchronously = same frame.
  { name: 'back to ×1 so a move lasts well over 150 ms', action: 'press', key: 'f' },
  { name: 'speed ×1', action: 'expect', expect: { expression: `${GS}.speed`, equals: 1 } },
  {
    name: 'remember the expected pit and board',
    action: 'eval',
    code: `const s = ${GS}; const legal = s.legalPits();
      // leftmost on screen: P1 = lowest index, P2 = highest index
      window.__expectPit = s.state.current === 0 ? Math.min(...legal) : Math.max(...legal);`,
  },
  {
    name: '→ down/up and Enter down/up in a single frame',
    action: 'eval',
    code: `const fire = (type, key, code) => {
        const e = new KeyboardEvent(type, { key, bubbles: true, cancelable: true });
        Object.defineProperty(e, 'keyCode', { get: () => code });
        window.dispatchEvent(e);
      };
      fire('keydown', 'ArrowRight', 39); fire('keyup', 'ArrowRight', 39);
      fire('keydown', 'Enter', 13); fire('keyup', 'Enter', 13);`,
  },
  { name: 'let 150 ms pass', action: 'wait', ms: 150 },
  {
    name: 'the move is still animating (the duplicate Enter did not skip it)',
    action: 'expect',
    expect: { expression: `${GS}.busy`, equals: true },
  },
  {
    name: 'it sowed from the leftmost pit (→ was handled once, not twice)',
    action: 'expect',
    expect: { expression: `${GS}.lastMovePit === window.__expectPit`, equals: true },
  },
  { name: 'burst move finishes', action: 'waitFor', expression: `${GS}.busy === false`, timeout: 20000 },
  {
    name: 'screen matches engine after the burst move',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.displayedPits()) === JSON.stringify(${GS}.state.pits)`, equals: true },
  },
];
