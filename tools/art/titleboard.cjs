// Draws the small board of the title screen (GDD §7), lying on the platform of bg-yard.png:
//   node tools/art/titleboard.cjs   →  public/assets/title-board.png (480×82), title-seeds.png
// Run tools/art/menubg.cjs first: the board's shadow is the platform, darkened.
// Keep the positions in sync with src/display/titleLayout.ts.
const os = require('node:os');
const path = require('node:path');
const P = require(process.env.CODIXEL ?? path.join(os.homedir(), '.claude/skills/codixel/core/pixel.js'));
const OUT = path.join(__dirname, '../../public/assets');
const LIGHT = (() => { const v = [-0.5, -0.62, 0.6], n = Math.hypot(...v); return v.map((c) => c / n); })();
// Warm wood by lamp light, a little into the night.
const FACE = P.hueRamp(8, { hue: 24, shift: 18, sat: 0.3, satDrop: 0.25, light: [0.1, 0.5] });
const BOWL = P.hueRamp(9, { hue: 20, shift: 20, sat: 0.42, satDrop: 0.3, light: [0.08, 0.52] });
const B = { x: 240, y: 224, half: 30, left: 54, right: 426, taper: 66, lip: 6, rx: 15, ry: 11, cell: 34, top: 210, bot: 238, srx: 21, sry: 17, sx: [92, 388] };
const slot = (i) => (i === 7 ? { x: B.sx[1], y: B.y, rx: B.srx, ry: B.sry } : i === 15 ? { x: B.sx[0], y: B.y, rx: B.srx, ry: B.sry } : i < 7 ? { x: B.x + (i - 3) * B.cell, y: B.bot, rx: B.rx, ry: B.ry } : { x: B.x + (11 - i) * B.cell, y: B.top, rx: B.rx, ry: B.ry });
const hull = (x) => { const u = P.clamp(Math.min(x - B.left, B.right - x) / B.taper); return u <= 0 ? -1 : B.half * (1 - Math.pow(1 - u, 2.3)); };
function boardSmall() {
  const b = new P.Buf(480, 270), mask = new Uint8Array(480 * 270);
  for (let y = 188; y < 262; y++) for (let x = B.left; x <= B.right; x++) if (hull(x) >= 0 && Math.abs(y - B.y) <= hull(x)) mask[y * 480 + x] = 1;
  const face = P.smoothMask(mask, 480, 270);
  for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) if (face[y * 480 + x]) for (let d = 1; d <= B.lip; d++) if (y + d < 270 && !face[(y + d) * 480 + x]) b.pset(x, y + d, FACE[d >= B.lip ? 0 : d <= 1 ? 3 : d <= 3 ? 2 : 1]);
  const bowls = Array.from({ length: 16 }, (_, i) => slot(i));
  for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) {
    if (!face[y * 480 + x]) continue;
    const hit = bowls.find((s) => ((x - s.x + 0.5) / s.rx) ** 2 + ((y - s.y + 0.5) / s.ry) ** 2 <= 1);
    if (hit) {
      const dx = (x - hit.x + 0.5) / hit.rx, dy = (y - hit.y + 0.5) / hit.ry, d = Math.hypot(dx, dy), k0 = 0.66;
      const nx = -dx * k0, ny = -dy * k0, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      let k = P.band(P.clamp(0.06 + lit * 0.82, 0, 0.999), BOWL.length, x, y, 0.25);
      if (d > 1 - 1.4 / hit.ry) k += dx + dy < 0 ? -2 : 1;
      b.pset(x, y, BOWL[P.clamp(k, 0, 8) | 0]);
    } else {
      const up = y - (B.y - hull(x)), down = B.y + hull(x) - y, warp = (P.fbm(x * 0.014, y * 0.07, 3, 11) - 0.5) * 5;
      let v = 0.62 + (up < 2 ? 0.2 : 0) - (down < 2 ? 0.16 : 0) - 0.12 * Math.max(0, (x - 240) / 180);
      let k = P.band(P.clamp(v, 0, 0.999), FACE.length, x, y, 0.1);
      if (((((y * 0.17 + warp) % 1) + 1) % 1) < 0.14) k -= 1;
      if (bowls.some((s) => { const dx = (x - s.x + 0.5) / s.rx, dy = (y - s.y + 0.5) / s.ry, d = Math.hypot(dx, dy); return d < 1 + 1.3 / s.ry && dx + dy > 0.5; })) k += 1;
      b.pset(x, y, FACE[P.clamp(k, 0, 7) | 0]);
    }
  }
  return b;
}
const MINI = ['.332.', '3W321', '33221', '22211', '.111.'];
const RAMPS = [[150, 0.46], [174, 0.46], [206, 0.5], [84, 0.46]].map(([hue, sat]) => P.hueRamp(5, { hue, shift: 24, sat, satDrop: 0.2, light: [0.12, 0.62] }));

const small = boardSmall(), yard = P.load(path.join(OUT, 'bg-yard.png'));
const e = P.edgeCheck(small);
if (e.nubs.length + e.strips.length + e.holes.length) throw new Error('title board silhouette is not clean');
const TOP = 188, out = new P.Buf(480, 270 - TOP);
// Shadow: away from the light, on the platform.
for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) if (small.px[y * 480 + x] >>> 24) { const X = x + 5, Y = y + 5; if (X < 480 && Y < 270) out.pset(X, Y - TOP, P.mix(P.unpack(yard.px[Y * 480 + X]), [6, 5, 10], 0.65)); }
out.sprite(small, 0, -TOP);

// Marbles, 5×5 in 6×6: with their shadow, then without (in the air, or lying on others).
const frames = [true, false].flatMap((shadow) => RAMPS.map((ramp) => {
  const f = new P.Buf(6, 6);
  if (shadow) { for (let i = 1; i <= 4; i++) f.pset(i, 5, BOWL[1]); f.pset(5, 4, BOWL[1]); }
  MINI.forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') f.pset(i, j, c === 'W' ? [240, 246, 240] : ramp[+c]); }));
  return f;
}));
P.save(out, path.join(OUT, 'title-board.png'));
P.save(P.pack(frames, { cols: 8 }), path.join(OUT, 'title-seeds.png'));
console.log('wrote title-board.png', out.w, out.h, 'and title-seeds.png (8 frames of 6x6)');
