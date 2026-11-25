import { reachMenu } from './lib/common.mjs';
// AC-UI1 (docs/acceptance-criteria.md): integer scale in device pixels, base 480×270.
// Runs with the harness default viewport (1280×720 @ dpr 1 → k = 2, canvas shown at 960×540).
export default [
  reachMenu,
  {
    // GDD §10: all text is drawn with the bundled font. On the production build this also
    // proves the Content-Security-Policy lets the font load.
    name: 'the bundled Mali font is loaded (Thai and Latin)',
    action: 'expect',
    expect: {
      expression: `['400', '700'].every((w) => document.fonts.check(w + ' 12px "Mali"', 'หมากขุม AI 12'))
        && [...document.fonts].filter((f) => f.family.replace(/"/g, '') === 'Mali' && f.status === 'loaded').length`,
      equals: 4,
    },
  },
  // The browser tab: an icon in both sizes, and a page marked as Thai (no offer to translate it).
  {
    name: 'load the tab icons',
    action: 'eval',
    code: `Promise.all([...document.querySelectorAll('link[rel=icon]')].map(async (l) => { const i = new Image(); i.src = l.href; await i.decode(); return [l.getAttribute('sizes'), i.width + 'x' + i.height]; })).then((r) => { window.__icons = r; }, (e) => { window.__icons = String(e); });`,
  },
  { name: 'tab icons answered', action: 'waitFor', expression: `window.__icons !== undefined`, timeout: 3000 },
  { name: 'tab icons of 16 and 32 px, Thai page', action: 'expect', expect: { expression: `[window.__icons, document.documentElement.lang]`, equals: [[['16x16', '16x16'], ['32x32', '32x32']], 'th'] } },
  { name: 'the colour outside the game is the one the backgrounds sink into', action: 'expect', expect: { expression: `[getComputedStyle(document.body).backgroundColor, game.config.backgroundColor.rgba.replace(/\s/g, '')]`, equals: ['rgb(16, 13, 24)', 'rgba(16,13,24,1)'] } },
  {
    name: 'canvas backing store is the 480×270 base resolution',
    action: 'expect',
    expect: { expression: `[game.canvas.width, game.canvas.height]`, equals: [480, 270] },
  },
  {
    name: 'each game pixel covers a whole number of device pixels',
    action: 'expect',
    expect: {
      expression: `(() => { const k = game.scale.zoom * window.devicePixelRatio; return k >= 1 && Math.abs(k - Math.round(k)) < 1e-6; })()`,
      equals: true,
    },
  },
  {
    name: 'displayed canvas size is k × 480×270 at the default viewport',
    action: 'expect',
    expect: {
      expression: `(() => { const r = game.canvas.getBoundingClientRect(); return [Math.round(r.width * devicePixelRatio), Math.round(r.height * devicePixelRatio)]; })()`,
      equals: [960, 540],
    },
  },
];
