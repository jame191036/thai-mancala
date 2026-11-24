// Draws the sowing hand (GDD §8): seen from above, in code, at 4x and shrunk.
//   node tools/art/hand.cjs   →  public/assets/hand.png (six 32×40 frames)
// Frames: P1 open / carry / drop, then P2 open / carry / drop. Marbles leave the hand at
// (6, 10) for P1 and (26, 30) for P2: keep in sync with src/display/sowingHand.ts.
// Run tools/art/board.cjs first (the carried marbles come from seeds.png).
const os = require('node:os');
const path = require('node:path');
const P = require(process.env.CODIXEL ?? path.join(os.homedir(), '.claude/skills/codixel/core/pixel.js'));
const OUT = path.join(__dirname, '../../public/assets');

const N = 32, K = 4;
const SKIN = P.hueRamp(7, { hue: 22, shift: 14, sat: 0.46, satDrop: 0.2, light: [0.2, 0.74] });
const CUFF = [P.hueRamp(4, { hue: 187, shift: 14, sat: 0.48, light: [0.2, 0.52] }), P.hueRamp(4, { hue: 22, shift: 10, sat: 0.72, light: [0.24, 0.58] })];
const LINE = P.unpack(SKIN[0]);

// Joint → tip with radii, in 32 px sprite space, right hand, palm down, fingers up.
const FINGERS = {
  open: { index: [12.2, 15, 10.2, 5.6, 2.2, 1.7], middle: [15.2, 14, 14.8, 3.4, 2.3, 1.8], ring: [18.2, 14.4, 19.2, 5, 2.2, 1.7], little: [20.8, 16, 23.2, 9, 1.9, 1.5], thumb: [10.8, 21, 4.8, 15.4, 2.6, 2] },
  carry: { index: [12, 15.2, 11.6, 10.8, 2.5, 2.3], middle: [15.1, 14.2, 15, 9.6, 2.5, 2.4], ring: [18.2, 14.6, 18.6, 10.3, 2.4, 2.2], little: [20.9, 16, 21.6, 12.4, 2.1, 1.9], thumb: [10.8, 21, 8.2, 13, 2.6, 2.2] },
  drop: { index: [12, 15, 9.6, 7, 2.3, 1.8], middle: [15.1, 14.2, 14.2, 8, 2.5, 2.1], ring: [18.2, 14.6, 18.2, 9.8, 2.4, 2.2], little: [20.9, 16, 21.4, 12.2, 2.1, 1.9], thumb: [10.8, 21, 6.2, 11, 2.6, 1.9] },
};
const PALM = [[16.2, 24.5, 16.2, 18.4, 5.6, 6.4]];

function drawHand(pose, player) {
  const big = new P.Buf(N * K, N * K);
  // The player across the board: the same hand turned half a turn, lit by the same light.
  const t = (v) => (player === 1 ? N - v : v) * K;
  const cap = ([ax, ay, bx, by, ra, rb], grow = 0) => P.cap(t(ax), t(ay), t(bx), t(by), (ra + grow) * K, (rb + grow) * K);
  const part = (c) => {
    P.solid(big, [cap(c, 0.42)], [LINE, LINE], { ambient: 1, k: 2 }); // the crease around each part
    P.solid(big, [cap(c)], SKIN, { light: [-0.5, -0.62, 0.6], ambient: 0.22, k: 3 });
  };
  const f = FINGERS[pose];
  // Sleeve: its colour says whose hand it is, and it ends the arm.
  const cu = CUFF[player];
  P.solid(big, [P.cap(t(11.8), t(29), t(20.6), t(29), 3.4 * K, 3.4 * K)], [LINE, LINE], { ambient: 1, k: 2 });
  P.solid(big, [P.cap(t(12), t(29.2), t(20.4), t(29.2), 2.9 * K, 2.9 * K)], cu, { light: [-0.5, -0.62, 0.6], ambient: 0.25, k: 3 });
  for (const name of ['little', 'ring', 'middle', 'index']) part(f[name]);
  for (const p of PALM) P.solid(big, [cap(p, 0.42)], [LINE, LINE], { ambient: 1, k: 2 });
  P.solid(big, [...PALM.map((p) => cap(p)), ...['little', 'ring', 'middle', 'index'].map((n) => { const [ax, ay, bx, by, r] = f[n]; return cap([ax, ay + 1.5, ax + (bx - ax) * 0.12, ay + (by - ay) * 0.12, r, r]); })], SKIN, { light: [-0.5, -0.62, 0.6], ambient: 0.22, k: 5 });
  part(f.thumb);
  const { buf } = P.quantize(P.resize(big, N, N), 0, { palette: [...SKIN, ...cu].map(P.col) });
  return P.smoothEdge(P.cleanup(buf, { tol: 20 }));
}

const seeds = P.load(path.join(OUT, 'seeds.png'));
const blit = (dst, src, x, y, sx = 0, sw = src.w) => { for (let j = 0; j < src.h; j++) for (let i = 0; i < sw; i++) { const c = src.px[j * src.w + sx + i]; if (c >>> 24 && x + i >= 0 && y + j >= 0 && x + i < dst.w && y + j < dst.h) dst.px[(y + j) * dst.w + x + i] = c; } };
const marble = (dst, x, y, v) => blit(dst, seeds, Math.round(x) - 3, Math.round(y) - 3, (4 + v) * 8, 8);

// What is in the hand shows between thumb and finger.
const withSeeds = (pose, player) => {
  const b = new P.Buf(N, N + 8);
  const m = (x, y) => (player === 1 ? [N - x, N + 8 - (y + 6)] : [x, y + 6]);
  const hand = drawHand(pose, player);
  if (pose === 'carry') { marble(b, ...m(10, 9), 0); marble(b, ...m(14, 7), 2); }
  blit(b, hand, 0, player === 1 ? 2 : 6);
  return b;
};

const poses = ['open', 'carry', 'drop'];
for (const pose of poses) {
  const e = P.edgeCheck(drawHand(pose, 0));
  if (e.nubs.length + e.strips.length + e.holes.length) throw new Error(`hand "${pose}": the silhouette is not clean`);
}
P.save(P.pack([0, 1].flatMap((p) => poses.map((pose) => withSeeds(pose, p))), { cols: 6 }), path.join(OUT, 'hand.png'));
console.log('wrote hand.png (6 frames of 32x40)');
