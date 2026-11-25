// The AI's characters (GDD §6): face and name in the game, a short line when someone captures
// or the AI moves again, and last words on the result screen. Nobody shows up between two people.
import { reachMenu } from './lib/common.mjs';

const GS = `scene('GameScene')`;
const OVER = `scene('GameOverScene')`;
const NAME = { easy: 'น้องแก้ว', medium: 'ลุงเคี่ยม', hard: 'ยายขุม' };

/** A board against `opponent`; the rest of the 98 seeds lie in the stores. */
const board = (what, opponent, current, pits, { reduced = false, ruleset = 'traditional' } = {}) => {
  const all = Array.from({ length: 16 }, (_, i) => pits[i] ?? 0);
  const left = 98 - all.reduce((a, b) => a + b, 0);
  all[7] = Math.floor(left / 2);
  all[15] = left - all[7];
  return [
    {
      name: `${what}: board set`,
      action: 'eval',
      code: `game.registry.set('reducedMotion', ${reduced}); game.registry.set('sowSpeed', 2);
        const s = ${GS}; const st = JSON.parse(JSON.stringify(s.state));
        st.mode = 'short'; st.ruleset = '${ruleset}'; st.phase = 'playing'; st.current = ${current}; st.pits = ${JSON.stringify(all)};
        s.scene.restart({ resume: { state: st, opponent: '${opponent}' } });`,
    },
    { name: `${what}: board ready`, action: 'waitFor', expression: `game.scene.isActive('GameScene') && ${GS}.opponent === '${opponent}' && ${GS}.portraitState() !== undefined && ${GS}.sys.settings.status === 5`, timeout: 4000 },
  ];
};
const says = (what, line, mood, timeout = 8000) => ({ name: what, action: 'waitFor', expression: `JSON.stringify(${GS}.portraitState()) === '${JSON.stringify({ mood, line })}'`, timeout, poll: 20 });

export default [
  reachMenu,
  { name: 'start a game', action: 'eval', code: `scene('MainMenuScene').scene.start('GameScene', { mode: 'short', firstPlayer: 0, opponent: 'human' });` },
  { name: 'game', action: 'waitFor', expression: `game.scene.isActive('GameScene')`, timeout: 4000 },
  { name: 'two people: nobody at the top left', action: 'expect', expect: { expression: `[${GS}.portraitState(), ${GS}.p2Label.text]`, equals: [null, 'ผู้เล่น 2  (แถวบน)'] } },

  // ── The player captures (pit 0 → empty pit 1, opposite pit 13) ──
  ...board('captured', 'easy', 0, { 0: 1, 5: 3, 13: 5, 9: 2 }),
  { name: 'its name, its face, saying nothing yet', action: 'expect', expect: { expression: `[${GS}.p2Label.text, ${GS}.portraitState()]`, equals: [NAME.easy, { mood: 'normal', line: '' }] } },
  { name: 'the player plays pit 0', action: 'eval', code: `${GS}.choosePit(0);` },
  says('it minds', 'โธ่!', 'sad'),
  { name: 'sad', action: 'screenshot' },
  { name: 'and gets over it', action: 'waitFor', expression: `${GS}.portraitState().mood !== 'sad'`, timeout: 4000 },

  // ── The AI captures (only move: pit 8 → empty pit 9, opposite pit 5) ──
  ...board('capture', 'medium', 1, { 8: 1, 5: 6, 2: 1 }),
  says('it enjoys that', 'ขอหน่อยนะหลาน', 'glad'),
  { name: 'glad', action: 'screenshot' },
  says('then its face is back to normal', '', 'normal', 4000),

  // ── The AI moves again (its only seed falls into its store) ──
  ...board('extra turn', 'hard', 1, { 14: 1, 3: 4, 4: 2 }),
  says('it says so', 'ยังไม่ถึงตาหลาน', 'glad'),
  { name: 'extra turn', action: 'screenshot' },

  // ── Reduced motion: the bubble is there at once, without a hop ──
  ...board('still', 'easy', 0, { 0: 1, 5: 3, 13: 5, 9: 2 }, { reduced: true }),
  { name: 'say something', action: 'eval', code: `${GS}.portrait.say('capture'); window.__y = [${GS}.portrait.text.y, ${GS}.portrait.box.y, ${GS}.tweens.getTweensOf([${GS}.portrait.text, ${GS}.portrait.box]).length];` },
  { name: 'in place, not moving', action: 'expect', expect: { expression: `window.__y`, equals: [51, 0, 0] } },
  // "!" must not look like "l": there is a gap between its stroke and its dot.
  {
    name: 'the dot of "!" stands apart',
    action: 'expect',
    expect: {
      expression: `(() => { const c = ${GS}.label(0, 0, '!', 13, '#FFFFFF').texture.getSourceImage(); const copy = document.createElement('canvas'); copy.width = c.width; copy.height = c.height;
        const g = copy.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
        const rows = []; for (let y = 0; y < c.height; y++) { let white = false; for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i + 3] && d[i] === 255) white = true; } rows.push(white ? 1 : 0); }
        return rows.join('').replace(/^0+|0+$/g, '').includes('0'); })()`,
      equals: true,
    },
  },

  // ── Last words ──
  { name: 'give up against the hard AI', action: 'eval', code: `game.registry.set('reducedMotion', false); ${GS}.scene.restart({ mode: 'short', firstPlayer: 0, opponent: 'hard' });` },
  { name: 'new game', action: 'waitFor', expression: `${GS}.opponent === 'hard' && ${GS}.sys.settings.status === 5 && ${GS}.state.pits[0] === 7`, timeout: 4000 },
  { name: 'resign', action: 'eval', code: `${GS}.resign();` },
  { name: 'result', action: 'waitFor', expression: `game.scene.isActive('GameOverScene') && !!${OVER}.portrait`, timeout: 4000 },
  { name: 'the winner speaks', action: 'expect', expect: { expression: `[${OVER}.portrait.line, ${OVER}.portrait.mood]`, equals: ['ฝึกอีกหน่อยนะ', 'glad'] } },
  { name: 'result settles', action: 'wait', ms: 250 },
  { name: 'result-win', action: 'screenshot' },
  ...['easy', 'medium'].flatMap((level) => [
    { name: `${level} loses`, action: 'eval', code: `${OVER}.scene.restart({ ...${OVER}.result, opponent: '${level}', winner: 0, reason: 'singleRound', stores: [60, 38] });` },
    { name: `${level}: its last words`, action: 'waitFor', expression: `${OVER}.result.opponent === '${level}' && ${OVER}.portrait?.mood === 'sad' && ['เอาใหม่ ๆ!', 'แพ้หลานจนได้'].includes(${OVER}.portrait.line)`, timeout: 3000 },
    { name: `${level} settles`, action: 'wait', ms: 250 },
    { name: `result-${level}`, action: 'screenshot' },
  ]),
  { name: 'a draw', action: 'eval', code: `${OVER}.scene.restart({ ...${OVER}.result, winner: null, stores: [49, 49] });` },
  { name: 'neither glad nor sad', action: 'waitFor', expression: `${OVER}.result.winner === null && ${OVER}.portrait?.mood === 'normal' && ${OVER}.portrait.line === 'สูสีดีนะ'`, timeout: 3000 },
  { name: 'between two people', action: 'eval', code: `${OVER}.scene.restart({ ...${OVER}.result, opponent: 'human' });` },
  { name: 'nobody speaks', action: 'waitFor', expression: `${OVER}.result.opponent === 'human' && ${OVER}.portrait === null`, timeout: 3000 },
];
