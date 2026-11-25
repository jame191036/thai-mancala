// Draws the logo "หมากขุม" (GDD §8): gold letters whose heads are little pits with marbles.
//   node tools/art/logo.cjs   →  public/assets/logo.png (219×64), logo-small.png (135×42)
// The letters are Mali Bold at 52 px and Mali Medium at 32 px (OFL), kept as 1-bit shapes in
// logo-letters.json so the logo comes out the same on every machine.
const os = require('node:os');
const path = require('node:path');
const P = require(process.env.CODIXEL ?? path.join(os.homedir(), '.claude/skills/codixel/core/pixel.js'));
const OUT = path.join(__dirname, '../../public/assets');
const LETTERS = require('./logo-letters.json');
const LIGHT = (() => { const v = [-0.5, -0.62, 0.6], n = Math.hypot(...v); return v.map((c) => c / n); })();
const GOLD = P.hueRamp(8, { hue: 41, shift: 22, sat: 0.66, satDrop: 0.2, light: [0.16, 0.82] });
const BOWL = P.hueRamp(9, { hue: 22, shift: 18, sat: 0.43, satDrop: 0.3, light: [0.09, 0.6] });
const EDGE = [44, 24, 18], SHADOW = [16, 11, 14];
const glass = (hue, sat = 0.5) => P.hueRamp(6, { hue, shift: 26, sat, satDrop: 0.2, light: [0.15, 0.72] });
const MARBLES = [glass(150), glass(208, 0.56), glass(74, 0.52), glass(178)];

/** The shape of the word with `pad` empty pixels round it, its outline cleaned unless it is thin. */
const letters = (key, pad, smooth) => {
  const rows = LETTERS[key], w = rows[0].length + pad * 2, h = rows.length + pad * 2, m = new Uint8Array(w * h);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') m[(y + pad) * w + x + pad] = 1; }));
  return { w, h, m: smooth ? P.smoothMask(m, w, h) : m };
};
/** Closed-in areas of a mask: the heads of the letters. */
const holes = ({ w, h, m }) => {
  const seen = new Uint8Array(w * h), out = [];
  const flood = (s) => { const st = [s], got = []; seen[s] = 1; while (st.length) { const i = st.pop(); got.push(i); const x = i % w, y = (i / w) | 0; for (const [a, b] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) { if (a < 0 || b < 0 || a >= w || b >= h) continue; const j = b * w + a; if (!m[j] && !seen[j]) { seen[j] = 1; st.push(j); } } } return got; };
  flood(0);
  for (let i = 0; i < m.length; i++) if (!m[i] && !seen[i]) { const px = flood(i); if (px.length > 60) continue; out.push({ px, x: px.reduce((n, p) => n + (p % w), 0) / px.length, y: px.reduce((n, p) => n + ((p / w) | 0), 0) / px.length }); }
  return out.sort((a, b) => a.x - b.x);
};

/** Letters whose heads are opened by one pixel all round, so a marble fits. */
const withHeads = (L) => {
  for (const h of holes(L)) for (const i of h.px) for (const j of [i - 1, i + 1, i - L.w, i + L.w]) L.m[j] = 0;
  return L;
};

/** Distance of every lit pixel to the edge of its shape (chamfer). */
const distance = ({ w, h, m }) => {
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = m[i] ? 99 : 0;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) d[y * w + x] = Math.min(d[y * w + x], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.41, at(x + 1, y - 1) + 1.41);
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) if (m[y * w + x]) d[y * w + x] = Math.min(d[y * w + x], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.41, at(x - 1, y + 1) + 1.41);
  return { d, at };
};

/** A marble filling a hole: every pixel of the hole gets a place on the ball. */
const marble = (b, ox, oy, w, hole, ramp) => {
  const r = Math.max(1.6, Math.sqrt(hole.px.length / Math.PI) + 0.35);
  for (const i of hole.px) {
    const x = i % w, y = (i / w) | 0, nx = (x - hole.x) / r, ny = (y - hole.y) / r, q = Math.min(0.98, nx * nx + ny * ny), nz = Math.sqrt(1 - q);
    const lit = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]));
    const v = 0.1 + 0.72 * lit + 0.9 * Math.max(0, nx * 0.6 + ny * 0.72 - 0.42);
    b.pset(ox + x, oy + y, ramp[P.band(P.clamp(v, 0, 0.999), 6, x, y, 0.15)]);
  }
  const gx = Math.round(hole.x - r * 0.38), gy = Math.round(hole.y - r * 0.4);
  if (hole.px.includes(gy * w + gx)) b.pset(ox + gx, oy + gy, [250, 252, 246]);
};

/**
 * ข with the head of ม (owner's choice): the pixels of ม's upper head, copied onto ข's stem.
 * `from`: x0, x1, y0, y1 of that head; `dx`: how far over ข is; `clear`: ข's own head.
 */
const KHO = {
  '700-52': { from: [45, 62, 4, 20], dx: 102, clear: [143, 167, 20] },
  '500-32': { from: [29, 38, 4, 13], dx: 62, clear: [90, 102, 13] },
};
const withMoHead = (L, { from, dx, clear }) => {
  const m = L.m.slice();
  for (let y = 0; y <= clear[2]; y++) for (let x = clear[0]; x <= clear[1]; x++) m[y * L.w + x] = 0;
  for (let y = from[2]; y <= from[3]; y++) for (let x = from[0]; x <= from[1]; x++) if (L.m[y * L.w + x]) m[y * L.w + x + dx] = 1;
  return { ...L, m };
};
/** Gold letters with marbles in their heads. `thin`: small strokes, left as they are. */
function gold(key, { bevel, shadow, thin = false }) {
  let L = withMoHead(letters(key, 4, !thin), KHO[key]);
  if (!thin) L = withHeads(L);
  const { d, at } = distance(L), H = holes(L);
  const b = new P.Buf(L.w, L.h + 2);
  const lit = (x, y) => x >= 0 && y >= 0 && x < L.w && y < L.h && L.m[y * L.w + x];
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (lit(x, y)) for (const [dx, dy] of shadow) b.pset(x + dx, y + dy, SHADOW);
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (lit(x, y)) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) b.pset(x + i, y + j, EDGE);
  for (const h of H) for (const i of h.px) b.pset(i % L.w, (i / L.w) | 0, BOWL[0]);
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    if (!lit(x, y)) continue;
    // Averaged over 3×3, so steps in the outline do not show as spikes in the light.
    const hgt = (p, q) => { let s = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += Math.min(bevel, at(p + i, q + j)); return s / 9; };
    const gx = (hgt(x + 1, y) - hgt(x - 1, y)) / 2, gy = (hgt(x, y + 1) - hgt(x, y - 1)) / 2, n = Math.hypot(gx, gy, 1);
    const l = (-gx * LIGHT[0] - gy * LIGHT[1] + LIGHT[2]) / n, flat = d[y * L.w + x] >= bevel;
    const v = flat ? 0.76 - 0.26 * (y / L.h) : 0.16 + 0.8 * Math.max(0, l);
    b.pset(x, y, GOLD[P.band(P.clamp(v, 0, 0.999), GOLD.length, x, y, 0.18)]);
  }
  // ข gets the marble of the ม it took its head from; the others go round the colours.
  const khoX = KHO[key].dx + (KHO[key].from[0] + KHO[key].from[1]) / 2, isKho = (h) => Math.abs(h.x - khoX) < 6 && h.y < L.h / 2;
  H.forEach((h, n) => marble(b, 0, 0, L.w, h, MARBLES[(isKho(h) ? 3 : n) % MARBLES.length]));
  return { b, H, L };
}
const SH_BIG = [[1, 2], [2, 3], [1, 3], [0, 2]], SH_SMALL = [[1, 1], [1, 2], [0, 2]];

P.save(gold('700-52', { bevel: 2.6, shadow: SH_BIG }).b, path.join(OUT, 'logo.png'));
// Small: the strokes are too thin to clean their edge or to open the heads any further.
P.save(gold('500-32', { bevel: 1.6, shadow: SH_SMALL, thin: true }).b, path.join(OUT, 'logo-small.png'));
console.log('wrote logo.png and logo-small.png');
