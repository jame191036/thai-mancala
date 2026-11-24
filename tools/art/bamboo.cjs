// Draws the bamboo platform behind the board (GDD §8) with the board's shadow on it:
//   node tools/art/bamboo.cjs   →  public/assets/bamboo.png (480×270)
// Run tools/art/board.cjs first: the shadow takes its shape from board.png.
const os = require('node:os');
const path = require('node:path');
const P = require(process.env.CODIXEL ?? path.join(os.homedir(), '.claude/skills/codixel/core/pixel.js'));
const OUT = path.join(__dirname, '../../public/assets');

const W = 480, H = 270;
const LIGHT = (() => { const v = [-0.5, -0.62, 0.6], n = Math.hypot(...v); return v.map((c) => c / n); })();
// Hue and saturation measured on the photo's slats (hue 24, sat 0.2); kept dark so the board
// and the text stay in front.
const BAMBOO = P.hueRamp(9, { hue: 28, shift: 10, sat: 0.36, satDrop: 0.2, light: [0.05, 0.4] });

function drawBamboo() {
  const b = new P.Buf(W, H), rnd = P.rng(7);
  let y = -5, id = 0;
  while (y < H) {
    const h = 12 + Math.floor(rnd() * 4); // photo: a slat is about a third of a pit (40 px) high
    const tone = (rnd() - 0.5) * 0.16;
    const nodes = [];
    for (let x = -20 - rnd() * 140; x < W + 20; x += 120 + rnd() * 70) nodes.push(Math.round(x));
    for (let j = 0; j < h; j++) {
      const yy = y + j;
      if (yy < 0 || yy >= H) continue;
      for (let x = 0; x < W; x++) {
        const near = nodes.find((n) => x >= n - 2 && x <= n + 2);
        // The gap between slats; a joint is thicker than the culm and closes it.
        if (j === h - 1 && near === undefined) { b.px[yy * W + x] = BAMBOO[0]; continue; }
        const t = (j + 0.5) / (h - 1), ny = (t - 0.5) * 1.75, nz = Math.sqrt(Math.max(0, 1 - ny * ny));
        const lit = ny * LIGHT[1] + nz * LIGHT[2];
        // The flat part of a split culm: wide soft variation along the length, from the fibres.
        let v = 0.2 + P.clamp(lit, 0, 1) * 0.62 + tone + (P.fbm(x * 0.012, id * 9 + t * 1.2, 2, 3) - 0.5) * 0.16;
        let k = P.band(v, BAMBOO.length, x, yy, 0.12);
        // Fibre lines: long, thin, one step darker.
        if (j > 1 && j < h - 3 && P.noise(x * 0.018, yy * 3.1 + id * 5, 21) > 0.8) k -= 1;
        // Gloss: a broken streak where the round side faces the light.
        if (j === Math.round(h * 0.28) && P.noise(x * 0.03, id * 11.3, 31) > 0.42) k += 1;
        if (near !== undefined) {
          const d = x - near; // a raised ring: lit lip, then the dark groove of the joint
          k += d === -2 ? 1 : d === -1 ? 2 : d === 0 ? -2 : d === 1 ? -3 : 1;
          if (j === h - 1) k -= 2;
        }
        b.px[yy * W + x] = BAMBOO[P.clamp(k, 0, BAMBOO.length - 1) | 0];
      }
    }
    y += h;
    id += 1;
  }
  return b;
}

const out = drawBamboo();
const board = P.load(path.join(OUT, 'board.png'));
const BOARD_Y = 75; // LAYOUT.board.y in src/display/boardLayout.ts
const darker = new Map(BAMBOO.map((c, i) => [c, BAMBOO[Math.max(0, i - 3)]]));
// Shadow of the board, away from the light (down and right).
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const sx = x - 5, sy = y - BOARD_Y - 7;
  if (sx >= 0 && sy >= 0 && sy < board.h && board.px[sy * board.w + sx] >>> 24) out.px[y * W + x] = darker.get(out.px[y * W + x]);
}
P.save(out, path.join(OUT, 'bamboo.png'));
console.log('wrote bamboo.png', out.w, out.h);
