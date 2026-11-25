// Draws the menu backgrounds (GDD §8), 480×270 each:
//   node tools/art/menubg.cjs   →  public/assets/bg-night.png, bg-yard.png
// night: the bamboo platform of the game after dark, lit by a lamp at the top left. It stays
// dark enough for the dim text everywhere (checked below).
// yard: a Thai house and sugar palms under the moon, seen from the platform.
const os = require('node:os');
const path = require('node:path');
const P = require(process.env.CODIXEL ?? path.join(os.homedir(), '.claude/skills/codixel/core/pixel.js'));
const OUT = path.join(__dirname, '../../public/assets');
const W = 480, H = 270;
const LIGHT = (() => { const v = [-0.5, -0.62, 0.6], n = Math.hypot(...v); return v.map((c) => c / n); })();

const lum = ([r, g, b]) => { const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const DIM = [156, 143, 122];

// ── Bamboo at night: the game's slats on a ramp from the menu's deep purple to a dark warm brown.
const NIGHT = [[16, 13, 24], [22, 18, 32], [28, 23, 38], [34, 27, 41], [41, 31, 43], [48, 36, 44], [56, 42, 45], [64, 48, 47]];
const slats = (b, { y0, y1, height, tone, seed = 7 }) => {
  const rnd = P.rng(seed);
  let y = y0, id = 0;
  while (y < y1) {
    const h = height(y, rnd), shift = (rnd() - 0.5) * 0.14, nodes = [];
    for (let x = -20 - rnd() * 140; x < W + 20; x += 120 + rnd() * 70) nodes.push(Math.round(x));
    for (let j = 0; j < h; j++) {
      const yy = y + j;
      if (yy < 0 || yy >= Math.min(H, y1)) continue;
      for (let x = 0; x < W; x++) {
        const near = h > 7 ? nodes.find((n) => x >= n - 2 && x <= n + 2) : undefined;
        if (j === h - 1 && near === undefined) { b.pset(x, yy, NIGHT[0]); continue; }
        const t = (j + 0.5) / (h - 1), ny = (t - 0.5) * 1.75, nz = Math.sqrt(Math.max(0, 1 - ny * ny)), lit = ny * LIGHT[1] + nz * LIGHT[2];
        let v = tone(x, yy) * (0.22 + P.clamp(lit, 0, 1) * 0.7 + shift + (P.fbm(x * 0.012, id * 9 + t * 1.2, 2, 3) - 0.5) * 0.14);
        let k = P.band(P.clamp(v, 0, 0.999), NIGHT.length, x, yy, 0.14);
        if (j > 1 && j < h - 3 && P.noise(x * 0.018, yy * 3.1 + id * 5, 21) > 0.82) k -= 1;
        if (near !== undefined) { const d = x - near; k += d === -2 ? 1 : d === -1 ? 1 : d === 0 ? -1 : d === 1 ? -2 : 0; if (j === h - 1) k -= 2; }
        b.pset(x, yy, NIGHT[P.clamp(k, 0, NIGHT.length - 1) | 0]);
      }
    }
    y += h; id += 1;
  }
};

/** Pages full of text: the platform alone. */
function night() {
  const b = new P.Buf(W, H);
  // The lamp stands just outside the top left corner.
  const lamp = (x, y) => P.clamp(1.12 - Math.hypot((x + 30) / 520, (y + 40) / 330) * 0.72, 0.26, 1.0);
  slats(b, { y0: -5, y1: H, height: (y, r) => 12 + Math.floor(r() * 4), tone: lamp });
  return b;
}

// ── The yard at night.
const SKY = [[17, 15, 30], [21, 18, 35], [25, 21, 40], [30, 25, 46], [36, 29, 52], [43, 33, 56], [51, 38, 58], [59, 43, 58]];
const DARK = [13, 11, 20], DARK2 = [18, 15, 27];
function palm(b, x, base, top, lean) {
  for (let y = top; y <= base; y++) { const t = (base - y) / (base - top), cx = x + lean * t * t, w = 1.6 + (1 - t) * 1.2; b.rect(Math.round(cx - w), y, Math.round(cx + w), y + 1, DARK); }
  const cx = x + lean, cy = top + 1;
  // A sugar palm's crown: many stiff fan leaves, the lower ones hanging, their tips ragged.
  for (let i = 0; i < 15; i++) {
    const a = -Math.PI * 1.3 + (i / 14) * Math.PI * 1.6, len = 8.5 + 2.2 * Math.abs(Math.sin(i * 1.9)), lx = cx + Math.cos(a) * len, ly = cy + Math.sin(a) * len * 0.9 + (Math.sin(a) > 0 ? 1.5 : 0);
    b.line(Math.round(cx), cy, Math.round(lx), Math.round(ly), DARK);
    const rr = 4.4 + 0.8 * Math.sin(i * 3.1);
    for (let j = -6; j <= 6; j++) for (let k = -6; k <= 6; k++) {
      const d = Math.hypot(k, j), fa = Math.atan2(j, k), off = Math.abs(Math.atan2(Math.sin(fa - a), Math.cos(fa - a)));
      if (d > rr || off > 1.25) continue;
      if (d > rr - 1.6 && Math.round((fa + 9) * 4.2) % 2 === 0) continue; // the cut between the leaf's fingers
      b.pset(Math.round(lx) + k, Math.round(ly) + j, DARK);
    }
  }
  for (let y = -4; y <= 4; y++) for (let i = -4; i <= 4; i++) if (Math.hypot(i, y) <= 3.6) b.pset(Math.round(cx) + i, cy + y, DARK);
}/** A Thai house: steep concave roof with the curled ends of the bargeboards, on posts. */
function house(b, x, base, w, hRoof, hWall) {
  const eave = base - 9 - hWall, peak = eave - hRoof;
  for (let y = peak; y <= eave; y++) { const t = (y - peak) / hRoof, half = (w / 2 + 5) * (0.1 * t + 0.9 * t ** 1.45); b.rect(Math.round(x - half), y, Math.round(x + half) + 1, y + 1, DARK); }
  // Finial and the curled ends.
  b.rect(x, peak - 5, x + 1, peak, DARK); b.pset(x - 1, peak - 1, DARK); b.pset(x + 1, peak - 1, DARK);
  for (const s of [-1, 1]) { const ex = x + s * Math.round(w / 2 + 5); for (const [i, j] of [[0, 0], [1, -1], [2, -2], [2, -3], [1, 0], [0, -1]]) b.pset(ex + s * i, eave + j, DARK); }
  b.rect(Math.round(x - w / 2 + 3), eave, Math.round(x + w / 2 - 2), base - 9, DARK);
  // Wall boards a shade lighter, a lit window, posts and the floor beam.
  for (let i = Math.round(x - w / 2 + 6); i < x + w / 2 - 4; i += 5) b.rect(i, eave + 2, i + 1, base - 10, DARK2);
  const wx = x - 5, wy = eave + 4;
  for (let j = 0; j < 9; j++) for (let i = 0; i < 10; i++) b.pset(wx + i, wy + j, i === 4 || i === 5 ? [60, 36, 22] : j < 3 ? [196, 136, 62] : [164, 104, 46]);
  b.rect(Math.round(x - w / 2), base - 10, Math.round(x + w / 2) + 1, base - 8, DARK);
  for (const p of [-0.42, -0.14, 0.14, 0.42]) b.rect(Math.round(x + p * w), base - 8, Math.round(x + p * w) + 2, base + 1, DARK);
}

/** Title and menu: the scenery stands where the menu leaves room (MENU_LAYOUT). */
function yard() {
  const b = new P.Buf(W, H), HZ = 190;
  for (let y = 0; y < HZ; y++) for (let x = 0; x < W; x++) b.pset(x, y, SKY[P.band(P.clamp((y / HZ) ** 1.25, 0, 0.999), SKY.length, x, y, 0.3)]);
  // Stars: few, faint, none near the horizon.
  const r = P.rng(31);
  for (let i = 0; i < 80; i++) { const x = Math.floor(r() * W), y = Math.floor(r() ** 1.6 * 130); b.pset(x, y, r() > 0.8 ? [112, 104, 130] : [62, 55, 84]); }
  // Moon at the top right, with two rings of haze.
  const MX = 437.5, MY = 70.5;
  for (let y = 30; y < 112; y++) for (let x = 400; x < W; x++) {
    const d = Math.hypot(x - MX, y - MY);
    if (d <= 9.3) b.pset(x, y, Math.hypot(x - MX + 2.5, y - MY + 2) <= 7.8 ? [226, 214, 182] : [196, 180, 150]);
    else if (d <= 14) b.pset(x, y, P.mix(P.unpack(b.px[y * W + x]), [110, 92, 110], 0.28));
    else if (d <= 21) b.pset(x, y, P.mix(P.unpack(b.px[y * W + x]), [110, 92, 110], 0.12));
  }
  for (const [x, y, rr] of [[434, 72, 1.6], [440, 67, 1.2], [438, 75, 1]]) for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (Math.hypot(i, j) <= rr) b.pset(x + i, y + j, [204, 188, 156]);
  // Far trees, then the near silhouettes.
  for (let x = 0; x < W; x++) { const h = 8 + P.fbm(x * 0.03, 2, 3, 5) * 18; for (let y = Math.round(HZ - h); y < HZ; y++) b.pset(x, y, [30, 23, 40]); }
  // Where the menu leaves room: the far left edge and the right of the rows.
  house(b, 437, HZ + 1, 60, 29, 17);
  palm(b, 10, HZ, 104, -2); palm(b, 396, HZ, 128, 3);
  for (let x = 0; x < W; x++) { const h = 1 + P.fbm(x * 0.09, 7, 2, 9) * 5; for (let y = Math.round(HZ - h); y < HZ; y++) if (x < 96 || x > 350) b.pset(x, y, DARK); }
  // The platform we sit on: slats get wider toward us.
  slats(b, { y0: HZ, y1: H + 12, height: (y) => Math.max(5, Math.round(5 + (y - HZ) * 0.13)), tone: (x, y) => 0.46 + 0.34 * ((y - HZ) / (H - HZ)) - 0.1 * Math.abs(x - 240) / 240, seed: 11 });
  b.rect(0, HZ, W, HZ + 1, [60, 45, 46]); // the far edge catches the moon
  return b;
}

/** The edges sink into the colour outside the game (style.css), so no frame shows round them. */
const OUTSIDE = NIGHT[0], FADE = 26, STEPS = 8;
const sink = (b) => {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // Rounded corners: the two nearest edges add up.
    const ex = P.clamp(1 - Math.min(x, W - 1 - x) / FADE), ey = P.clamp(1 - Math.min(y, H - 1 - y) / FADE), t = Math.min(1, Math.hypot(ex, ey));
    if (t <= 0) continue;
    const k = P.band(Math.min(0.999, t * t * (3 - 2 * t)), STEPS, x, y, 0.35) / (STEPS - 1);
    b.pset(x, y, P.mix(P.unpack(b.px[y * W + x]), OUTSIDE, k));
  }
  return b;
};
const bg = { night: sink(night()), yard: sink(yard()) };
let worst = 99;
for (const c of new Set(bg.night.px)) worst = Math.min(worst, contrast(DIM, P.unpack(c).slice(0, 3)));
if (worst < 3.5) throw new Error(`bg-night is too bright for the dim text: contrast ${worst.toFixed(2)}`);
for (const [name, b] of Object.entries(bg)) P.save(b, path.join(OUT, `bg-${name}.png`));
console.log('wrote bg-night.png and bg-yard.png, dim text contrast on night', worst.toFixed(2));
