import { reachMenu } from './lib/common.mjs';
// AC-UI1 (docs/acceptance-criteria.md): integer scale in device pixels, base 480×270.
// Runs with the harness default viewport (1280×720 @ dpr 1 → k = 2, canvas shown at 960×540).
export default [
  reachMenu,
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
