// Gamepad (GDD §3.8.1, AC-G1–G5). Headless Chromium has no pads, so navigator.getGamepads()
// is replaced by fake "standard"-mapping pads whose buttons the steps press and release.
// Phaser polls getGamepads() every frame, exactly as it does with a real pad.
const GS = `scene('GameScene')`;
const PAUSED = `game.scene.isActive('PauseScene') && game.scene.isPaused('GameScene')`;
const RUNNING = `!game.scene.isActive('PauseScene') && game.scene.isActive('GameScene') && !game.scene.isPaused('GameScene')`;

// W3C standard mapping (src/input/gamepad.ts).
const A = 0; // bottom face button = confirm
const B = 1; // right face button = cancel
const Y = 3; // top face button = speed
const START = 9;
const UP = 12;
const DOWN = 13;
const LEFT = 14;
const RIGHT = 15;

// Each scene ignores pad input for 250 ms after it starts or resumes (a button still held
// from the previous scene must not count), so wait a little after every scene change.
const SETTLE = 300;

let n = 0;
/** Press and release `button` on pad `pad` (a JS expression, e.g. '0' or 'window.__mine'). */
const tap = (name, button, pad = '0') => {
  n += 1;
  return [
    { name: `${name} [${n}] down`, action: 'eval', code: `window.__padDown(${pad}, ${button});` },
    { name: `${name} [${n}] hold`, action: 'wait', ms: 80 },
    { name: `${name} [${n}] up`, action: 'eval', code: `window.__padUp(${pad}, ${button});` },
    { name: `${name} [${n}] released`, action: 'wait', ms: 60 },
  ];
};
const settle = (name) => ({ name: `${name} (settle)`, action: 'wait', ms: SETTLE });

export default [
  {
    name: 'reaches the main menu',
    action: 'waitFor',
    expression: `game.scene.isActive('MainMenuScene')`,
    timeout: 10000,
  },
  {
    name: 'plug in one fake gamepad',
    action: 'eval',
    code: `
      const mk = (index) => ({
        id: 'Playtest Pad ' + index, index, connected: true, mapping: 'standard',
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
        get timestamp() { return performance.now(); },
      });
      window.__mkPad = mk;
      window.__pads = [mk(0)];
      Object.defineProperty(navigator, 'getGamepads', { value: () => window.__pads.slice(), configurable: true });
      window.__padDown = (i, b) => { const x = window.__pads[i].buttons[b]; x.pressed = true; x.value = 1; };
      window.__padUp = (i, b) => { const x = window.__pads[i].buttons[b]; x.pressed = false; x.value = 0; };
      window.__unplug = (i) => {
        const p = window.__pads[i];
        p.connected = false;
        window.__pads[i] = null;
        const e = new Event('gamepaddisconnected');
        Object.defineProperty(e, 'gamepad', { value: p });
        window.dispatchEvent(e);
      };`,
  },
  settle('Phaser picks the pad up'),
  { name: 'Phaser sees the pad', action: 'expect', expect: { expression: `scene('MainMenuScene').input.gamepad.getAll().length`, equals: 1 } },

  // ── AC-G3 (1/2): menu → game with the pad only ──
  ...tap('D-pad ↑', UP),
  { name: 'focus on the opponent row', action: 'expect', expect: { expression: `scene('MainMenuScene').focusRow`, equals: 'opponent' } },
  ...tap('D-pad →', RIGHT),
  { name: '→ picks "AI ง่าย"', action: 'expect', expect: { expression: `scene('MainMenuScene').opponent`, equals: 'easy' } },
  ...tap('D-pad ←', LEFT),
  { name: '← back to "2 คน"', action: 'expect', expect: { expression: `scene('MainMenuScene').opponent`, equals: 'human' } },
  { name: 'tilt the left stick down', action: 'eval', code: `window.__pads[0].axes[1] = 1;` },
  { name: 'hold it briefly (shorter than the repeat delay)', action: 'wait', ms: 120 },
  { name: 'centre the stick', action: 'eval', code: `window.__pads[0].axes[1] = 0;` },
  { name: 'stick moved the focus down one row', action: 'expect', expect: { expression: `scene('MainMenuScene').focusRow`, equals: 'traditional' } },
  ...tap('A on "เกมสั้น"', A),
  { name: 'the game starts', action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  { name: 'a two-player short game', action: 'expect', expect: { expression: `[${GS}.state.mode, ${GS}.opponent]`, equals: ['short', 'human'] } },

  // ── AC-G1: pits 1–2 empty; from pit 0, D-pad → lands on pit 3 ──
  // Video rules for this board: the move from pit 3 ends on an occupied P2 pit (no relay),
  // so it lasts about 21 seeds and the game goes on.
  {
    name: 'load the AC-G1 board, P1 to move',
    action: 'eval',
    code: `const s = ${GS}; const st = JSON.parse(JSON.stringify(s.state));
      st.pits = [7, 0, 0, 21, 7, 7, 7, 0, 7, 7, 7, 7, 7, 7, 7, 0];
      st.current = 0; st.ruleset = 'video';
      s.scene.restart({ resume: { version: 1, savedAt: 0, state: st, opponent: 'human' } });`,
  },
  { name: 'board loaded', action: 'waitFor', expression: `${GS}.state && ${GS}.state.pits[3] === 21 && !${GS}.busy`, timeout: 3000 },
  settle('game scene restarted'),
  { name: 'nothing selected yet', action: 'expect', expect: { expression: `${GS}.selectedPit`, equals: null } },
  ...tap('D-pad →', RIGHT),
  { name: 'P1 has pit 0 selected', action: 'expect', expect: { expression: `${GS}.selectedPit`, equals: 0 } },
  ...tap('D-pad →', RIGHT),
  { name: 'AC-G1: → skips the empty pits 1–2 and selects pit 3', action: 'expect', expect: { expression: `${GS}.selectedPit`, equals: 3 } },

  // ── AC-G2: A sows the selected pit at once ──
  { name: 'A down', action: 'eval', code: `window.__padDown(0, ${A});` },
  { name: 'AC-G2: pit 3 is picked up straight away', action: 'waitFor', expression: `${GS}.busy && ${GS}.lastMovePit === 3`, timeout: 100, poll: 5 },
  { name: 'A up', action: 'eval', code: `window.__padUp(0, ${A});` },
  { name: 'let a few seeds drop', action: 'wait', ms: 150 },
  { name: 'still sowing', action: 'expect', expect: { expression: `${GS}.busy`, equals: true } },
  ...tap('A during sowing = skip', A),
  { name: 'the skip finishes the move', action: 'waitFor', expression: `${GS}.busy === false`, timeout: 300, poll: 10 },
  {
    name: 'screen matches the engine after the skip',
    action: 'expect',
    expect: { expression: `JSON.stringify(${GS}.displayedPits()) === JSON.stringify(${GS}.state.pits)`, equals: true },
  },
  { name: 'P2 to move now', action: 'expect', expect: { expression: `${GS}.state.current`, equals: 1 } },

  // Y = speed; left stick = D-pad; B = cancel the selection.
  ...tap('Y', Y),
  { name: 'Y: speed ปกติ → เร็ว', action: 'expect', expect: { expression: `${GS}.speed`, equals: 2 } },
  { name: 'tilt the left stick right', action: 'eval', code: `window.__pads[0].axes[0] = 1;` },
  { name: 'hold it briefly', action: 'wait', ms: 120 },
  { name: 'centre the stick ', action: 'eval', code: `window.__pads[0].axes[0] = 0;` },
  { name: 'one pad plays for whoever is to move: a P2 pit is selected', action: 'expect', expect: { expression: `${GS}.legalPits().includes(${GS}.selectedPit)`, equals: true } },
  ...tap('B', B),
  { name: 'B cleared the selection', action: 'expect', expect: { expression: `${GS}.selectedPit`, equals: null } },

  // ── AC-G4: two pads → pad 1 plays P1 (bottom), pad 2 plays P2 (top) ──
  { name: 'plug in a second pad', action: 'eval', code: `window.__pads[1] = window.__mkPad(1);` },
  { name: 'let Phaser see it', action: 'wait', ms: 150 },
  { name: 'two pads connected', action: 'expect', expect: { expression: `${GS}.input.gamepad.getAll().length`, equals: 2 } },
  { name: 'whose pad is whose', action: 'eval', code: `window.__mine = ${GS}.state.current; window.__other = 1 - window.__mine;` },
  ...tap("D-pad → on the other player's pad", RIGHT, 'window.__other'),
  ...tap("A on the other player's pad", A, 'window.__other'),
  {
    name: "AC-G4: the other player's pad does nothing",
    action: 'expect',
    expect: { expression: `[${GS}.selectedPit, ${GS}.busy]`, equals: [null, false] },
  },
  ...tap("D-pad → on the mover's pad", RIGHT, 'window.__mine'),
  { name: "the mover's pad selects a pit", action: 'expect', expect: { expression: `${GS}.legalPits().includes(${GS}.selectedPit)`, equals: true } },
  { name: 'remember the selection', action: 'eval', code: `window.__sel = ${GS}.selectedPit; window.__last = ${GS}.lastMovePit;` },

  // ── Pause with Start; a button still held when the game resumes must not act again ──
  ...tap('Start', START, 'window.__mine'),
  { name: 'Start pauses', action: 'waitFor', expression: PAUSED, timeout: 1000 },
  { name: 'no "pad unplugged" notice for a normal pause', action: 'expect', expect: { expression: `scene('PauseScene').padLost`, equals: false } },
  settle('pause menu opened'),
  ...tap('A on "เล่นต่อ"', A, 'window.__mine'),
  { name: 'resumed', action: 'waitFor', expression: RUNNING, timeout: 1000 },
  settle('game resumed'),
  {
    name: 'the A that closed the menu did not also sow the selected pit',
    action: 'expect',
    expect: { expression: `${GS}.busy === false && ${GS}.selectedPit === window.__sel && ${GS}.lastMovePit === window.__last`, equals: true },
  },
  ...tap('Start', START, 'window.__mine'),
  { name: 'paused again', action: 'waitFor', expression: PAUSED, timeout: 1000 },
  settle('pause menu opened again'),
  ...tap('Start in the pause menu = resume', START, 'window.__mine'),
  { name: 'resumed again', action: 'waitFor', expression: RUNNING, timeout: 1000 },
  settle('game resumed again'),
  { name: 'the held Start did not pause the game again', action: 'expect', expect: { expression: RUNNING, equals: true } },
  ...tap('Start', START, 'window.__mine'),
  { name: 'paused a third time', action: 'waitFor', expression: PAUSED, timeout: 1000 },
  settle('pause menu opened a third time'),
  ...tap('B in the pause menu = resume', B, 'window.__mine'),
  { name: 'B resumes', action: 'waitFor', expression: RUNNING, timeout: 1000 },
  settle('game resumed a third time'),

  // ── AC-G5: unplugging a pad pauses the game ──
  { name: 'unplug the second pad', action: 'eval', code: `window.__unplug(1);` },
  { name: 'AC-G5: the game pauses within 1 s', action: 'waitFor', expression: PAUSED, timeout: 1000 },
  { name: 'the pause menu says the pad was unplugged', action: 'expect', expect: { expression: `scene('PauseScene').padLost`, equals: true } },
  { name: 'pad-unplugged', action: 'screenshot' },
  settle('pause menu after the unplug'),

  // ── AC-G3 (2/2): pause menu → main menu with the pad only ──
  ...tap('D-pad ↓', DOWN),
  ...tap('D-pad ↓', DOWN),
  ...tap('D-pad ↓', DOWN),
  { name: 'focus on "กลับเมนู"', action: 'expect', expect: { expression: `scene('PauseScene').focus`, equals: 3 } },
  ...tap('A', A),
  { name: 'AC-G3: back on the main menu', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene')`, timeout: 3000 },
  { name: 'the game was saved', action: 'expect', expect: { expression: `scene('MainMenuScene').hasSave`, equals: true } },
  settle('menu'),

  // ── Result screen: ← → + A (keyboard ← → too) ──
  ...tap('A on "เกมสั้น" (traditional)', A),
  { name: 'new game', action: 'waitFor', expression: `game.scene.isActive('GameScene') && !game.scene.isActive('MainMenuScene')`, timeout: 5000 },
  { name: 'instant sowing', action: 'eval', code: `${GS}.reducedMotion = true;` },
  {
    name: 'play to the end',
    action: 'waitFor',
    expression: `(() => {
      if (game.scene.isActive('GameOverScene')) return true;
      const s = ${GS};
      if (!s.busy && s.state.phase === 'playing') s.choosePit(s.legalPits()[0]);
      return false;
    })()`,
    timeout: 60000,
    poll: 30,
  },
  settle('result screen'),
  { name: 'focus starts on "เล่นอีกครั้ง"', action: 'expect', expect: { expression: `scene('GameOverScene').focus`, equals: 'rematch' } },
  { name: 'keyboard →', action: 'press', key: 'ArrowRight' },
  { name: 'focus on "เมนู"', action: 'expect', expect: { expression: `scene('GameOverScene').focus`, equals: 'menu' } },
  ...tap('D-pad ←', LEFT),
  { name: 'focus back on "เล่นอีกครั้ง"', action: 'expect', expect: { expression: `scene('GameOverScene').focus`, equals: 'rematch' } },
  ...tap('D-pad →', RIGHT),
  { name: 'focus on "เมนู" again', action: 'expect', expect: { expression: `scene('GameOverScene').focus`, equals: 'menu' } },
  { name: 'game-over-focus', action: 'screenshot' },
  ...tap('A', A),
  { name: 'A on "เมนู" goes to the menu', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene') && !game.scene.isActive('GameOverScene')`, timeout: 3000 },
  { name: 'a finished game leaves no save', action: 'expect', expect: { expression: `scene('MainMenuScene').hasSave`, equals: false } },
];
