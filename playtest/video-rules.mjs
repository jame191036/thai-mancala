import { reachMenu } from './lib/common.mjs';
// "แบบตามวิดีโอ" (R17, ruleset 'video'): chosen in the menu's ruleset dropdown, carried
// into the game and into a rematch; while a round is running neither side is ever empty.
//
// Menu (base px, see MENU_LAYOUT in src/scenes/MainMenuScene.ts): ruleset dropdown at
// (218, 82), its 2nd option at y 82 + 2 × 24; "เริ่มเกม" at (240, 191). Clicks are ×2 (k = 2).
const GS = `scene('GameScene')`;

export default [
  reachMenu,
  { name: 'menu', action: 'screenshot' },
  // Closing without choosing: Esc, or a click outside the list.
  { name: 'open the ruleset list, then Esc', action: 'click', x: 2 * 218, y: 2 * 82 },
  { name: 'list opened', action: 'waitFor', expression: `scene('MainMenuScene').dropdownOpen`, timeout: 1000 },
  { name: '↓ highlights the other ruleset', action: 'press', key: 'ArrowDown' },
  { name: 'Esc closes the list', action: 'press', key: 'Escape' },
  { name: 'nothing chosen', action: 'expect', expect: { expression: `[scene('MainMenuScene').ruleset, scene('MainMenuScene').dropdownOpen]`, equals: ['traditional', false] } },
  { name: 'open the ruleset list again', action: 'click', x: 2 * 218, y: 2 * 82 },
  { name: 'list opened again', action: 'waitFor', expression: `scene('MainMenuScene').dropdownOpen`, timeout: 1000 },
  { name: 'let the list settle first', action: 'wait', ms: 100 },
  { name: 'click outside, on the "AI ยาก" button', action: 'click', x: 2 * 360, y: 2 * 54 },
  {
    name: 'the click only closed the list (no ruleset or opponent change)',
    action: 'expect',
    expect: { expression: `[scene('MainMenuScene').ruleset, scene('MainMenuScene').opponent, scene('MainMenuScene').dropdownOpen]`, equals: ['traditional', 'human', false] },
  },
  { name: 'open the ruleset dropdown', action: 'click', x: 2 * 218, y: 2 * 82 },
  { name: 'the list is open', action: 'expect', expect: { expression: `scene('MainMenuScene').dropdownOpen`, equals: true } },
  // Objects made during a click only take input from the next frame on: wait a moment.
  { name: 'let the list settle', action: 'wait', ms: 100 },
  { name: 'menu-ruleset-dropdown', action: 'screenshot' },
  { name: 'pick "แบบตามวิดีโอ"', action: 'click', x: 2 * 218, y: 2 * 130 },
  { name: 'video rules chosen, list closed', action: 'expect', expect: { expression: `[scene('MainMenuScene').ruleset, scene('MainMenuScene').dropdownOpen]`, equals: ['video', false] } },
  { name: 'a mouse pick leaves the focus on "เริ่มเกม"', action: 'expect', expect: { expression: `scene('MainMenuScene').focusRow`, equals: 'start' } },
  { name: 'so Enter starts the game', action: 'press', key: 'Enter' },
  {
    name: 'a short game with the video ruleset starts',
    action: 'waitFor',
    expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene') && ${GS}.state.ruleset === 'video' && ${GS}.state.mode === 'short'`,
    timeout: 5000,
  },

  // A real click: no relay in this ruleset. P1 pit 2 (7 seeds) → 3,4,5,6,store,8,9; pit 9
  // already had seeds, so the turn simply ends (the traditional rules would relay here).
  { name: 'restart with P1 first', action: 'scene', key: 'GameScene', data: { mode: 'short', ruleset: 'video', firstPlayer: 0 } },
  { name: 'click P1 pit 2', action: 'click', x: 392, y: 316 },
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
