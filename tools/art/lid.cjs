// Draws the lid of a dead pit (GDD §8): a round wooden lid with a worn red cross.
//   node tools/art/lid.cjs   →  public/assets/lid.png (five 56×56 frames: the lid closing)
// The last frame is the closed lid, centred on its pit: keep in sync with src/display/deadLids.ts.
const os = require('node:os');
const path = require('node:path');
const P = require(process.env.CODIXEL ?? path.join(os.homedir(), '.claude/skills/codixel/core/pixel.js'));
const OUT = path.join(__dirname, '../../public/assets');

// Same light as the board (top left), same hues, darker.
const N = 40, C = 19.5;

const WOOD = P.hueRamp(8, { hue: 22, shift: 18, sat: 0.36, satDrop: 0.25, light: [0.07, 0.46] });
const BOWL = P.hueRamp(9, { hue: 22, shift: 18, sat: 0.43, satDrop: 0.3, light: [0.09, 0.6] });
const RED = P.hueRamp(5, { hue: 356, shift: 16, sat: 0.52, satDrop: 0.2, light: [0.16, 0.52] });
const DUST = P.hueRamp(4, { hue: 32, shift: 10, sat: 0.24, light: [0.46, 0.72] });

const R = 17.6, THICK = 2, TOPY = C - 1; // the lid's upper face sits a little high: its edge shows below
const SEAMS = [-6, 6]; // three planks, along the board like its own grain
// Growth lines: [plank row, from, to] as distances from the centre, pixel-perfect 1 px lines.
const GRAIN = [[-11, -8, 3], [-9, 1, 10], [-3, -13, -4], [-1, -2, 12], [2, -14, 2], [4, 4, 13], [9, -10, 0], [11, 1, 9]];

function drawLid() {
  const b = new P.Buf(N, N);
  const face = new Uint8Array(N * N), side = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (Math.hypot(x - C, y - TOPY) <= R) face[y * N + x] = 1;
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (face[y * N + x]) for (let d = 1; d <= THICK; d++) if (y + d < N && !face[(y + d) * N + x]) side[(y + d) * N + x] = d;

  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (Math.hypot(x - C, y - C) <= 19.5 && !face[i] && !side[i]) b.px[i] = P.col(BOWL[x + y < N - 1 ? 1 : 0]); // gap round the lid, in shadow
    if (side[i]) b.px[i] = P.col(WOOD[side[i] === 1 ? 1 : 0]);
    if (!face[i]) continue;
    const dx = x - C, dy = y - TOPY, r = Math.hypot(dx, dy), row = Math.round(dy + 0.5);
    const plank = row < SEAMS[0] ? 0 : row < SEAMS[1] ? 1 : 2;
    // Flat wood: one tone per plank, a soft fall of light across it.
    let v = [0.52, 0.45, 0.49][plank] - (dx + dy) * 0.005;
    let k = P.band(v, WOOD.length, x, y, 0.16);
    if (GRAIN.some(([g, a, c]) => g === row && dx >= a && dx <= c)) k -= 1;
    if (SEAMS.includes(row)) k = 1;
    if (SEAMS.includes(row - 1)) k += 1; // the next plank's upper edge catches the light
    // Bevelled rim: lit toward the light, dark away from it.
    if (r > R - 2) { const t = (dx + dy) / r; k = t < -1.15 ? 6 : t < -0.6 ? 5 : t < 0.1 ? 4 : t < 0.8 ? 3 : 2; }
    else if (r > R - 3) k -= 1; // groove inside the rim
    let c = WOOD[P.clamp(k, 0, WOOD.length - 1) | 0];
    // The painted cross, following the wood under it: darker in seams and grain, worn at the ends.
    const p = Math.min(Math.abs(dx - dy), Math.abs(dx + dy)), reach = Math.max(Math.abs(dx), Math.abs(dy));
    if (p <= 2 && reach <= 9.5 && !(reach > 8.5 && p === 2)) {
      let q = P.band(0.7 - (dx + dy) * 0.012, RED.length, x, y, 0.2);
      if (GRAIN.some(([g, a, e]) => g === row && dx >= a && dx <= e)) q -= 1;
      if (SEAMS.includes(row)) q = 0;
      c = RED[P.clamp(q, 0, RED.length - 2) | 0];
    }
    b.px[i] = P.col(c);
  }
  return b;
}

const lid = drawLid();
const e = P.edgeCheck(lid);
if (e.nubs.length + e.strips.length + e.holes.length) throw new Error('lid silhouette is not clean');

// ── Closing: 5 frames at 10 fps. The lid comes down, lands with a little dust, and lies still.
const F = 56, PAD = (F - N) / 2;
// A low, uneven clump (two flat blobs side by side along the lid's edge), lit from the top.
const puff = (b, x, y, r, t) => {
  const tx = -Math.sin(t), ty = Math.cos(t);
  const at = [[0, 0, r], [tx * r * 1.1, ty * r * 1.1, r * 0.7]];
  for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) {
    if (!at.some(([ax, ay, ar]) => Math.hypot(i - ax, (j - ay) * 1.25) <= ar)) continue;
    const above = at.some(([ax, ay, ar]) => Math.hypot(i - ax, (j - 1 - ay) * 1.25) <= ar) && !at.some(([ax, ay, ar]) => Math.hypot(i - ax, (j + 1 - ay) * 1.25) <= ar);
    b.pset(Math.round(x) + i, Math.round(y) + j, DUST[above ? 1 : j < 0 ? 3 : 2]);
  }
};// Puffs leave the lid's edge sideways and down, where the air is pushed out (angle, size).
const PUFFS = [[0.1, 3.2], [0.8, 2.4], [1.45, 2.8], [2.25, 2.3], [3.0, 3.3], [3.8, 2.1], [-0.7, 2.2]];
const frame = (lift, shadow, dust) => {
  const b = new P.Buf(F, F);
  // The shadow falls away from the light and stays inside the bowl.
  if (shadow) for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) if (Math.hypot(x - (F - 1) / 2, y - (F - 1) / 2) <= 19 && Math.hypot(x - (F - 1) / 2 - lift * 0.4, y - (F - 1) / 2 - lift * 0.5) <= shadow) b.px[y * F + x] = P.col(BOWL[1]);
  if (lift) { // without the dark gap, which belongs to the bowl
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (Math.hypot(x - C, y - TOPY) <= R || Math.hypot(x - C, y - TOPY - THICK) <= R) b.pset(x + PAD, y + PAD - lift, lid.px[y * N + x]);
  } else b.sprite(lid, PAD, PAD);
  if (dust) for (const [t, r] of PUFFS) puff(b, F / 2 + Math.cos(t) * (17.5 + dust * 3), F / 2 + Math.sin(t) * (16.5 + dust * 2.5), r * (dust === 1 ? 0.85 : 0.5), t);
  return b;
};
const FRAMES = [frame(8, 15.5, 0), frame(3, 17, 0), frame(0, 0, 1), frame(0, 0, 2), frame(0, 0, 0)];

P.save(P.pack(FRAMES, { cols: 5 }), path.join(OUT, 'lid.png'));
console.log('wrote lid.png (5 frames of 56x56)');
