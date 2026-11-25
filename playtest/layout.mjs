// Text (and logo) layout on every screen: nothing leaves the 480×270 screen, and no two texts or
// buttons touch. SLACK is kept free around everything, because fonts are drawn a pixel higher or
// lower on other systems (CI's Linux, phones, Macs) than on the machine this was laid out on. Measured on the pixels actually drawn (Thai vowels and tone marks above and
// below the line count), with the longest texts each screen can show.
import { reachMenu } from './lib/common.mjs';

// __layout('Scene'): 'ok', or what is wrong. Dropdown lists and other overlays are meant to
// cover things, so the checks run with them closed.
const INSTALL = `
  const ink = new Map(); // texture key → the box of its visible pixels
  const inkOf = (tex) => {
    if (!ink.has(tex.key)) {
      // Read from a copy made for reading, so the game's own canvases stay as they are.
      const c = tex.getSourceImage();
      const copy = document.createElement('canvas');
      copy.width = c.width; copy.height = c.height;
      const g = copy.getContext('2d', { willReadFrequently: true });
      g.drawImage(c, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const b = { l: c.width, t: c.height, r: 0, b: 0 };
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        if (!d[(y * c.width + x) * 4 + 3]) continue;
        if (x < b.l) b.l = x;
        if (x + 1 > b.r) b.r = x + 1;
        if (y < b.t) b.t = y;
        if (y + 1 > b.b) b.b = y + 1;
      }
      ink.set(tex.key, b);
    }
    return ink.get(tex.key);
  };
  const SLACK = 2, EDGE = 1;
  window.__layout = (key) => {
    const items = [];
    for (const o of game.scene.getScene(key).children.list) {
      const logo = /^logo/.test(o.texture?.key ?? '');
      if ((!logo && (typeof o.text !== 'string' || o.text === '')) || !o.visible || o.alpha === 0) continue;
      const i = inkOf(o.texture);
      let l = i.l - o.originX * o.width, r = i.r - o.originX * o.width;
      let t = i.t - o.originY * o.height, b = i.b - o.originY * o.height;
      if (Math.abs(o.rotation) > 1) [l, r, t, b] = [-r, -l, -b, -t]; // upside down
      items.push({ s: logo ? o.texture.key : o.text, l: o.x + l, r: o.x + r, t: o.y + t, b: o.y + b });
    }
    const bad = [];
    const box = (a) => a.s.slice(0, 24) + ' [' + [a.l, a.t, a.r, a.b].map((v) => Math.round(v)).join(',') + ']';
    items.forEach((a, n) => {
      if (a.l < EDGE || a.t < EDGE || a.r > 480 - EDGE || a.b > 270 - EDGE) bad.push('off screen: ' + box(a));
      for (const c of items.slice(n + 1)) {
        if (a.l < c.r + SLACK && c.l < a.r + SLACK && a.t < c.b + SLACK && c.t < a.b + SLACK) bad.push('touching: ' + box(a) + ' + ' + box(c));
      }
    });
    return bad.length ? bad : 'ok';
  };
`;

let now = 'MainMenuScene';
/** Leave the current scene for `key` and wait until it runs. */
const go = (key, data = {}) => {
  const steps = [
    { name: `open ${key}`, action: 'eval', code: `scene('${now}').scene.start('${key}', ${JSON.stringify(data)});` },
    { name: `${key} is up`, action: 'waitFor', expression: `game.scene.isActive('${key}')`, timeout: 4000 },
    { name: `${key} settles`, action: 'wait', ms: 150 },
  ];
  now = key;
  return steps;
};
const check = (what, key = now) => ({ name: what, action: 'expect', expect: { expression: `__layout('${key}')`, equals: 'ok' } });
const run = (code) => ({ name: 'set up', action: 'eval', code });
/** The picture behind everything on a menu screen. */
const background = (key) => ({ name: `${now}: background ${key}`, action: 'expect', expect: { expression: `(() => { const o = scene('${now}').children.list[0]; return [o.texture?.key, o.x, o.y, o.width, o.height]; })()`, equals: [key, 0, 0, 480, 270] } });
const shot = (name) => ({ name, action: 'screenshot' });

const RECORDS = { maxCapture: [88, 88], maxRelay: [88, 88] };
const result = (reason, ruleset, opponent, winner) => ({
  mode: reason === 'singleRound' ? 'short' : 'full', ruleset, opponent, maxRounds: 7, round: 7, winner, stores: [88, 10], reason, records: RECORDS,
});

// One game screen: two digits in every slot, then every long banner and message.
const GS = `scene('GameScene')`;
const BANNERS = (a, b) => ['เล่นต่อจากที่บันทึกไว้', `${a} เริ่มก่อน`, `${b} ได้เดินอีกตา!`, `หลุมฝั่ง${b}หมด: จบรอบ`, `${b} ไม่มีเม็ด ข้ามตา`, 'จบรอบ 7   88 : 10', `รอบที่ 7/7: ${b} เริ่ม`, 'หว่านต่อ 88 เม็ด'];
const MESSAGES = (a, b) => [`ตาของ${a}: เลือกหลุมฝั่งตัวเองที่มีเม็ด`, `${b} กำลังหว่าน · แตะ/คลิกที่ใดก็ได้เพื่อข้าม`, 'แตะหลุมเดิมอีกครั้ง หรือกด Enter เพื่อหว่าน', `รอ ${b} เดิน`];
const gameScreen = (what, { style, opponent, ruleset, facing = false, first = 0 }) => {
  const [a, b] = opponent === 'human' ? ['ผู้เล่น 1', 'ผู้เล่น 2'] : ['คุณ', { easy: 'น้องแก้ว', medium: 'ลุงเคี่ยม', hard: 'ยายขุม' }[opponent]];
  return [
    run(`game.registry.set('boardStyle', '${style}'); game.registry.set('facing', ${facing}); game.registry.set('sowSpeed', 4);`),
    ...go('GameScene', { mode: 'full', maxRounds: 7, ruleset, opponent, firstPlayer: first }),
    { name: `${what}: board style`, action: 'expect', expect: { expression: `[${GS}.boardStyle, ${GS}.facing]`, equals: [style, facing] } },
    check(`game, ${what}`),
    {
      name: `game, ${what}: two digits everywhere, every banner and message`,
      action: 'expect',
      expect: {
        expression: `(() => { const s = ${GS}; s.slots.forEach((o) => o.label.setText('88')); s.tweens.killTweensOf(s.banner); s.banner.setAlpha(1);
          const bad = [];
          for (const e of s.portrait ? ['capture', 'captured', 'extraTurn'] : []) { s.portrait.say(e); s.portrait.settle(); const r = __layout('GameScene'); if (r !== 'ok') bad.push(e, r); }
          if (s.portrait) { s.portrait.say('extraTurn'); s.portrait.settle(); }
          for (const t of ${JSON.stringify(BANNERS(a, b))}) { s.banner.setText(t); const r = __layout('GameScene'); if (r !== 'ok') bad.push(t, r); }
          for (const t of ${JSON.stringify(MESSAGES(a, b))}) { s.messageLabel.setText(t); const r = __layout('GameScene'); if (r !== 'ok') bad.push(t, r); }
          return bad.length ? bad : 'ok'; })()`,
        equals: 'ok',
      },
    },
    shot(`game-${what}`),
  ];
};
export default [
  reachMenu,
  run(INSTALL),

  // ── Title, menu ──
  ...go('TitleScene'),
  check('title'),
  background('bg-yard'),
  { name: 'the logo is on the title screen, on whole pixels', action: 'expect', expect: { expression: `scene('TitleScene').children.list.filter((o) => o.texture?.key === 'logo').map((o) => [o.x, o.y, o.width, o.height])`, equals: [[131, 38, 219, 64]] } },
  ...go('MainMenuScene'),
  check('menu, traditional rules'),
  background('bg-yard'),
  { name: 'the small logo is on the menu, on whole pixels', action: 'expect', expect: { expression: `scene('MainMenuScene').children.list.filter((o) => o.texture?.key === 'logo-small').map((o) => [o.x, o.y, o.width, o.height])`, equals: [[173, 0, 135, 42]] } },
  run(`scene('MainMenuScene').ruleset = 'video'; scene('MainMenuScene').mode = 'full'; scene('MainMenuScene').rounds = 7; scene('MainMenuScene').refreshAll();`),
  check('menu, video rules, 7 rounds'),
  shot('menu'),

  // ── Settings: the help line of every row ──
  ...go('SettingsScene'),
  ...[0, 1, 2, 3, 4, 5].flatMap((i) => [run(`scene('SettingsScene').setFocus(${i});`), check(`settings, focus ${i}`)]),
  background('bg-night'),
  run(`scene('SettingsScene').setFocus(3);`),
  shot('settings'),

  // ── Stats: empty, with big numbers, and asking to clear ──
  ...go('StatsScene'),
  check('stats, empty'),
  background('bg-night'),
  run(`const s = scene('StatsScene'); for (const m of Object.values(s.stats.results)) for (const t of Object.values(m)) t.p1 = t.p2 = t.draw = 888; s.stats.bestCapture = 88; s.stats.longestRelay = 88; s.stats.biggestWin = 88; s.fill();`),
  check('stats, big numbers'),
  run(`scene('StatsScene').setFocus('clear'); scene('StatsScene').choose('clear');`),
  check('stats, asking to clear'),
  shot('stats'),

  ...go('CreditsScene'),
  check('credits'),
  background('bg-night'),
  shot('credits'),

  // ── Result: every reason, both rulesets, against a person and the AI ──
  ...['singleRound', 'roundLimit', 'cannotFill', 'resigned'].flatMap((reason) => [
    ...go('GameOverScene', result(reason, 'traditional', 'human', 0)),
    check(`result, ${reason}, 2 people`),
    ...['easy', 'medium', 'hard'].flatMap((ai, n) => [
      ...go('GameOverScene', result(reason, 'video', ai, n % 2)),
      { name: 'the bubble settles', action: 'wait', ms: 150 },
      check(`result, ${reason}, ${ai} AI`),
    ]),
  ]),
  ...go('GameOverScene', result('cannotFill', 'traditional', 'human', null)),
  check('result, draw'),
  background('bg-night'),
  ...go('GameOverScene', result('roundLimit', 'traditional', 'human', 1)),
  shot('result'),

  // ── Game: the three board styles, both opponents, facing each other ──
  ...['easy', 'medium', 'hard'].flatMap((opponent) => gameScreen(`marbles, ${opponent} AI`, { style: 'marbles', opponent, ruleset: 'video' })),
  ...gameScreen('hand, 2 people', { style: 'hand', opponent: 'human', ruleset: 'traditional', first: 1 }),
  ...gameScreen('numbers, 2 people facing', { style: 'numbers', opponent: 'human', ruleset: 'video', facing: true, first: 1 }),

  // ── Pause, with the "gamepad unplugged" notice ──
  run(`${GS}.openPause(true);`),
  { name: 'paused', action: 'waitFor', expression: `game.scene.isActive('PauseScene')`, timeout: 3000 },
  { name: 'pause settles', action: 'wait', ms: 150 },
  check('pause, gamepad unplugged', 'PauseScene'),
  shot('pause'),

  // ── Menu with a game to continue ──
  run(`${GS}.quitToMenu();`),
  { name: 'menu again', action: 'waitFor', expression: `game.scene.isActive('MainMenuScene') && scene('MainMenuScene').hasSave`, timeout: 3000 },
  { name: 'menu settles', action: 'wait', ms: 150 },
  check('menu, with a game to continue', 'MainMenuScene'),
  shot('menu-continue'),
];