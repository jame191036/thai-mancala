// Draws the browser-tab icon (GDD §8): a wooden bowl with three marbles.
//   node tools/art/favicon.cjs   →  public/favicon-16.png, public/favicon-32.png
const os = require('node:os');
const path = require('node:path');
const P = require(process.env.CODIXEL ?? path.join(os.homedir(), '.claude/skills/codixel/core/pixel.js'));
const OUT = path.join(__dirname, '../../public');
const LIGHT = (() => { const v = [-0.5, -0.62, 0.6], n = Math.hypot(...v); return v.map((c) => c / n); })();
const FACE = P.hueRamp(8, { hue: 26, shift: 16, sat: 0.3, satDrop: 0.25, light: [0.16, 0.68] });
const BOWL = P.hueRamp(9, { hue: 22, shift: 18, sat: 0.43, satDrop: 0.3, light: [0.09, 0.6] });
const glass = (hue, sat = 0.5) => P.hueRamp(6, { hue, shift: 26, sat, satDrop: 0.2, light: [0.15, 0.72] });
const GREEN = { ramp: glass(150), vane: [236, 214, 92] };
const BLUE = { ramp: glass(208, 0.56), vane: [236, 190, 110] };
// The olive marble of the game, a little warmer so three colours stay apart at 16 px.
const AMBER = { ramp: glass(74, 0.52), vane: [206, 92, 66] };

/** A glass marble of radius r: round shading, white glint, a bright curved vane. */
const marble = (b, cx, cy, r, m, big = false) => {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > r) continue;
    const nx = dx / r, ny = dy / r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
    // Glass: lit at the top left, and light gathered at the bottom right.
    let v = 0.16 + 0.66 * Math.max(0, lit) + 1.1 * Math.max(0, nx * 0.6 + ny * 0.72 - 0.42);
    if (d > r - 1 && nx + ny > -0.3) v -= 0.1;
    let c = m.ramp[P.band(P.clamp(v, 0, 0.999), m.ramp.length, x, y, 0.2)];
    if (big) { // the vane: a curved band across the middle
      // Widest in the middle, a point at each end, like a cat's eye.
      const along = nx * 0.66 + ny * 0.75, s = nx * 0.75 - ny * 0.66 + along * along * 0.3 - 0.05, w = 0.24 * (1 - (along / 0.74) ** 2);
      if (Math.abs(s) < w) c = P.mix(P.unpack(P.col(c)), m.vane, Math.abs(s) < w * 0.6 ? 0.92 : 0.55);
    }
    b.pset(x, y, c);
  }
  // The glint.
  const gx = Math.round(cx - r * 0.42), gy = Math.round(cy - r * 0.46);
  b.pset(gx, gy, [250, 252, 246]);
  if (r >= 4) b.pset(gx + 1, gy, [250, 252, 246]);
};

/** A wooden bowl filling the icon: a rim, then the carved hollow. */
const bowl = (b, n, rim) => {
  const c = (n - 1) / 2, R = n / 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), t = (dx + dy) / Math.max(1, d);
    if (d > R) continue;
    if (d > R - rim) b.pset(x, y, FACE[d > R - 0.9 ? (t < 0 ? 4 : 1) : t < -0.6 ? 7 : t < 0.5 ? 6 : 4]);
    else {
      const r = R - rim, Q = r / 0.62, nz = Math.sqrt(Q * Q - d * d) / Q, lit = (-dx / Q) * LIGHT[0] + (-dy / Q) * LIGHT[1] + nz * LIGHT[2];
      let k = P.band(P.clamp(0.04 + lit * 0.74, 0, 0.999), BOWL.length, x, y, 0.2);
      if (d > r - 1) k += t < 0 ? -2 : 0;
      b.pset(x, y, BOWL[P.clamp(k, 0, 8) | 0]);
    }
  }
};

/** The bowl with three marbles; the 16 px one is its own drawing, not the 32 px one shrunk. */
const icon = (n) => {
  const b = new P.Buf(n, n);
  bowl(b, n, n === 32 ? 3 : 1.6);
  const shade = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (Math.hypot(i, j) <= r) b.pset(Math.round(x) + i, Math.round(y) + j, BOWL[1]); };
  if (n === 32) { for (const [x, y] of [[11.5, 13], [21, 13.5], [16.5, 21.5]]) shade(x + 1, y + 1.5, 4.6); marble(b, 11, 12.5, 4.6, GREEN, true); marble(b, 20.5, 13, 4.6, BLUE, true); marble(b, 16, 20.5, 4.6, AMBER, true); }
  else { marble(b, 4.5, 5.5, 2.6, GREEN); marble(b, 10.5, 5.5, 2.6, BLUE); marble(b, 7.5, 10.5, 2.6, AMBER); }
  return b;
};

for (const n of [16, 32]) {
  const b = icon(n), e = P.edgeCheck(b);
  if (e.nubs.length + e.strips.length + e.holes.length) throw new Error(`favicon ${n} is not clean`);
  P.save(b, path.join(OUT, `favicon-${n}.png`));
}
console.log('wrote favicon-16.png and favicon-32.png');
