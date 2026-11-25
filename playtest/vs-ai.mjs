import { reachMenu } from './lib/common.mjs';
// Single player vs the AI (GDD §6): pick "AI ยาก" on the menu, the AI (P2, top row) moves
// by itself from a Web Worker, the human cannot play on its turn, and a full game finishes.
// Menu: opponent buttons at y 53, x 150/220/290/360 (see MENU_LAYOUT); clicks are ×2.
const GS = `scene('GameScene')`;

export default [
  reachMenu,
  { name: 'default opponent is a second person', action: 'expect', expect: { expression: `scene('MainMenuScene').opponent`, equals: 'human' } },
  { name: 'click "AI ยาก"', action: 'click', x: 2 * 360, y: 2 * 53 },
  { name: 'hard AI selected', action: 'expect', expect: { expression: `scene('MainMenuScene').opponent`, equals: 'hard' } },
  // Focus starts on "เริ่มเกม": ↑ speed, ↑ length, ↑ ruleset, ↑ opponent.
  ...['speed', 'length', 'ruleset', 'opponent'].map((row) => ({ name: `↑ to ${row}`, action: 'press', key: 'ArrowUp' })),
  { name: 'focus on the opponent row', action: 'expect', expect: { expression: "scene('MainMenuScene').focusRow", equals: 'opponent' } },
  { name: '← moves the selection to "AI กลาง"', action: 'press', key: 'ArrowLeft' },
  { name: 'medium AI selected', action: 'expect', expect: { expression: `scene('MainMenuScene').opponent`, equals: 'medium' } },
  { name: '→ back to "AI ยาก"', action: 'press', key: 'ArrowRight' },
  { name: 'menu-vs-ai', action: 'screenshot' },
  { name: 'key 1 = แบบดั้งเดิม · เกมสั้น', action: 'press', key: '1' },
  {
    name: 'the game is against the hard AI',
    action: 'waitFor',
    expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene') && ${GS}.opponent === 'hard'`,
    timeout: 5000,
  },

  // AI moves first: it must play on its own. (Video rules here: under the traditional rules
  // the opener can chain dozens of extra turns, which only makes this test slow.)
  { name: 'restart with the AI to move first', action: 'scene', key: 'GameScene', data: { mode: 'short', ruleset: 'video', opponent: 'hard', firstPlayer: 1 } },
  { name: 'the AI is thinking', action: 'waitFor', expression: `${GS}.aiThinking === true`, timeout: 2000, poll: 20 },
  { name: 'ai-thinking', action: 'screenshot' },
  {
    name: 'clicking an AI pit on its turn does nothing',
    action: 'eval',
    code: `window.__before = JSON.stringify(${GS}.state.pits); window.__aiBefore = ${GS}.aiMoves;`,
  },
  { name: 'click P2 pit 10 (top row)', action: 'click', x: 2 * 284, y: 2 * 112 },
  {
    name: 'the click did not start a move for the human',
    action: 'expect',
    expect: { expression: `${GS}.aiMoves === window.__aiBefore && (${GS}.busy === false ? JSON.stringify(${GS}.state.pits) === window.__before : true)`, equals: true },
  },
  { name: 'the AI makes its move', action: 'waitFor', expression: `${GS}.aiMoves >= 1`, timeout: 8000, poll: 20 },
  { name: 'the AI ran in a Web Worker (no main-thread fallback)', action: 'expect', expect: { expression: `${GS}.aiInWorker`, equals: true } },
  { name: 'the AI move animates', action: 'waitFor', expression: `${GS}.busy === false`, timeout: 20000 },

  // Play it out: the human (P1) always takes its first legal pit; the AI answers by itself.
  { name: 'instant sowing', action: 'eval', code: `${GS}.reducedMotion = true;` },
  {
    name: 'play to the end against the AI',
    action: 'waitFor',
    expression: `(() => {
      if (game.scene.isActive('GameOverScene')) return true;
      const s = ${GS};
      if (!s.busy && !s.isAiTurn() && s.state.phase === 'playing') s.choosePit(s.legalPits()[0]);
      return false;
    })()`,
    timeout: 120000,
    poll: 30,
  },
  { name: 'the AI moved many times', action: 'expect', expect: { expression: `${GS}.aiMoves`, atLeast: 5 } },
  { name: 'result keeps the opponent', action: 'expect', expect: { expression: `scene('GameOverScene').result.opponent`, equals: 'hard' } },
  {
    name: 'all 98 seeds counted',
    action: 'expect',
    expect: { expression: `scene('GameOverScene').result.stores[0] + scene('GameOverScene').result.stores[1]`, equals: 98 },
  },
  { name: 'game-over-vs-ai', action: 'screenshot' },

  // Leaving AI games right after they start: a worker whose file is still loading must not be
  // stopped (the browser then reports an aborted request at the next page load), but every one
  // of them must be stopped in the end.
  {
    name: 'watch the workers',
    action: 'eval',
    code: `const Real = window.Worker; window.__made = 0; window.__early = 0; window.__ended = 0;
      window.Worker = class extends Real {
        constructor(...a) { super(...a); window.__made += 1; this.addEventListener('message', () => { this.__loaded = true; }); }
        terminate() { window.__ended += 1; if (!this.__loaded) window.__early += 1; super.terminate(); }
      };`,
  },
  {
    name: 'start AI games one after the other',
    action: 'eval',
    code: `let n = 0; scene('GameOverScene').scene.start('GameScene', { mode: 'short', opponent: 'hard', firstPlayer: 0, ruleset: 'video' });
      const t = setInterval(() => { if (++n > 12) { clearInterval(t); window.__started = true; return; } if (game.scene.isActive('GameScene')) ${GS}.scene.restart({ mode: 'short', opponent: 'hard', firstPlayer: 1, ruleset: 'video' }); }, 18);`,
  },
  { name: 'started', action: 'waitFor', expression: `window.__started === true`, timeout: 4000 },
  { name: 'the last one plays: its AI moves', action: 'waitFor', expression: `${GS}.aiMoves >= 1`, timeout: 8000, poll: 30 },
  { name: 'to the menu', action: 'eval', code: `${GS}.scene.start('MainMenuScene');` },
  { name: 'all workers stopped', action: 'waitFor', expression: `window.__made >= 5 && window.__ended === window.__made`, timeout: 4000 },
  { name: 'none of them while it was loading', action: 'expect', expect: { expression: `window.__early`, equals: 0 } },
];
