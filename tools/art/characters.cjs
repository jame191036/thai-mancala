// Draws the AI characters (GDD §6): head and shoulders, 32×32 plus a 1 px outline.
//   node tools/art/characters.cjs   →  public/assets/faces.png (nine 34×33 frames)
// Rows: น้องแก้ว (easy), ลุงเคี่ยม (medium), ยายขุม (hard). Columns: normal, glad, sad.
// Keep the frame order in sync with src/display/portrait.ts.
const os = require('node:os');
const path = require('node:path');
const P = require(process.env.CODIXEL ?? path.join(os.homedir(), '.claude/skills/codixel/core/pixel.js'));
const OUT = path.join(__dirname, '../../public/assets');

const N = 32, CX = 15.5;
/** The body goes on this far below the frame, so cleaning the edge leaves the shoulders alone. */
const BELOW = 5;
const LIGHT = (() => { const v = [-0.5, -0.62, 0.6], n = Math.hypot(...v); return v.map((c) => c / n); })();

const both = (b, x, y, c) => { b.pset(x, y, c); b.pset(31 - x, y, c); };
const inEl = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
// Rounder than an ellipse.
const round = (x, y, cx, cy, rx, ry, n) => Math.abs((x - cx) / rx) ** n + Math.abs((y - cy) / ry) ** n <= 1;
// Light on an ellipsoid; `k` below 1 flattens it.
const ball = (x, y, cx, cy, rx, ry, k = 1) => {
  const nx = ((x - cx) / rx) * k, ny = ((y - cy) / ry) * k, nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
  return Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
};

/** The three faces of one character: clean the edge, draw the expression, add the outline. */
const finish = (drawBase, faces, edge, after = () => {}) => ['normal', 'glad', 'sad'].map((mood) => {
  const b = P.crop(P.smoothEdge(drawBase()), 0, 0, N, N);
  faces[mood](b);
  after(b);
  const o = P.selout(b, P.unpack(P.col(edge[1])), P.unpack(P.col(edge[0])));
  return P.crop(o, 0, 0, N + 2, N + 1); // no outline along the bottom: the body goes on
});
// น้องแก้ว: a child with a topknot, impatient.
const kaew = (() => {
  const SKIN = P.hueRamp(7, { hue: 22, shift: 10, sat: 0.6, satDrop: 0.12, light: [0.2, 0.76] });
  const SCALP = P.hueRamp(6, { hue: 20, shift: 14, sat: 0.27, satDrop: 0.2, light: [0.14, 0.52] });
  const HAIR = P.hueRamp(5, { hue: 16, shift: 22, sat: 0.26, satDrop: 0.2, light: [0.05, 0.32] });
  const SHIRT = P.hueRamp(5, { hue: 22, shift: 14, sat: 0.72, satDrop: 0.2, light: [0.22, 0.6] }); // P2 orange
  const FLOWER = P.hueRamp(4, { hue: 44, shift: 14, sat: 0.4, satDrop: 0.2, light: [0.46, 0.88] });

  const head = (x, y) => round(x, y, CX, 18, 9.7, 8.6, 3.1) || inEl(x, y, CX, 20.6, 10, 5.8);
  const ear = (x, y) => inEl(x, y, 5.6, 19.5, 2.1, 2.4) || inEl(x, y, 25.4, 19.5, 2.1, 2.4);
  const knot = (x, y) => inEl(x, y, CX, 4.6, 4, 3.6);
  const tie = (x, y) => (y === 8 && x >= 12 && x <= 19) || (y === 9 && x >= 11 && x <= 20);
  const body = (x, y) => inEl(x, y, CX, 34.5, 13.2, 8);
  const neck = (x, y) => x >= 12 && x <= 19 && y >= 25 && y <= 28;
  const hairline = (x, y) => y < 12.2 + ((x - CX) / 9) ** 2 * 3.4; // shaved part of the head

  function drawBase() {
    const b = new P.Buf(N, N + BELOW);
    const put = (x, y, ramp, v, strip = 0.2) => b.pset(x, y, ramp[P.band(P.clamp(v, 0, 0.999), ramp.length, x, y, strip)]);
    for (let y = 0; y < N + BELOW; y++) for (let x = 0; x < N; x++) {
      if (body(x, y)) put(x, y, SHIRT, 0.16 + 0.8 * ball(x, y, CX, 34.5, 13.2, 10, 0.95));
      if (neck(x, y)) put(x, y, SKIN, y < 27 ? 0.3 : 0.44); // under the chin: shadow
      if (y === 28 && x >= 13 && x <= 18) put(x, y, SKIN, 0.44);
      if (ear(x, y)) put(x, y, SKIN, x < CX ? 0.74 : 0.5);
      if (knot(x, y)) put(x, y, HAIR, 0.1 + 0.86 * ball(x, y, CX, 4.6, 4, 3.6));
      if (head(x, y)) {
        // A face is lit in big calm areas: light toward the top left, one band of shade along
        // the far side and the jaw.
        const t = ((x - CX) / 10) * 0.62 + ((y - 17.5) / 9) * 0.5;
        let v = Math.min(0.84, 0.8 - 0.2 * t);
        if (t > 0.62) v -= 0.14;
        if (hairline(x, y)) put(x, y, SCALP, v * 0.86);
        else put(x, y, SKIN, v);
      }
      // Garland round the knot: one bright row of buds, its shade below.
      if (tie(x, y)) b.pset(x, y, FLOWER[y === 8 ? (x < 18 ? 3 : 2) : x < 13 ? 2 : x < 18 ? 1 : 0]);
    }
    both(b, 5, 19, SKIN[3]); both(b, 5, 20, SKIN[3]); // inner ears
    b.pset(15, 21, SKIN[3]); b.pset(16, 21, SKIN[3]); // nose
    b.pset(13, 3, HAIR[4]); b.pset(14, 2, HAIR[4]); b.pset(14, 3, HAIR[4]); // glint on the knot
    return b;
  }
  const DARK = [44, 24, 26], WHITE = [250, 244, 232], BLUSH = [218, 124, 96], TONGUE = [190, 78, 72], TEAR = [150, 206, 226];
  const cheeks = (b) => { for (const [x, y] of [[8, 22], [9, 22], [8, 23]]) both(b, x, y, BLUSH); };
  const eyes = (b, dy = 0) => { for (let y = 17; y <= 19; y++) { both(b, 11, y + dy, DARK); both(b, 12, y + dy, DARK); } b.pset(11, 17 + dy, WHITE); b.pset(19, 17 + dy, WHITE); };

  const FACES = {
    // Impatient: brows down toward the nose, a lopsided grin.
    normal: (b) => {
      eyes(b); cheeks(b);
      for (const [x, y] of [[9, 14], [10, 14], [11, 15], [12, 15]]) both(b, x, y, DARK);
      for (const [x, y] of [[13, 23], [14, 24], [15, 24], [16, 24], [17, 24], [18, 23], [19, 22]]) b.pset(x, y, DARK);
    },
    glad: (b) => {
      cheeks(b);
      for (const [x, y] of [[9, 18], [10, 17], [11, 16], [12, 17], [13, 18]]) both(b, x, y, DARK);
      for (const [x, y] of [[9, 14], [10, 13], [11, 13], [12, 14]]) both(b, x, y, DARK);
      for (let x = 11; x <= 20; x++) b.pset(x, 22, DARK);
      for (let x = 12; x <= 19; x++) b.pset(x, 23, WHITE);
      for (let x = 12; x <= 19; x++) b.pset(x, 24, x === 12 || x === 19 ? DARK : TONGUE);
      for (let x = 13; x <= 18; x++) b.pset(x, 25, DARK);
    },
    // Outplayed: brows up in the middle, pout, a tear.
    sad: (b) => {
      eyes(b); cheeks(b);
      for (const [x, y] of [[9, 15], [10, 14], [11, 14], [12, 13]]) both(b, x, y, DARK);
      for (const [x, y] of [[13, 24], [14, 23], [15, 23], [16, 23], [17, 23], [18, 24]]) b.pset(x, y, DARK);
      for (const [x, y] of [[21, 20], [21, 21], [22, 21], [21, 22], [22, 22]]) b.pset(x, y, TEAR);
      b.pset(21, 21, WHITE);
    },
  };

  return finish(drawBase, FACES, HAIR);
})();

// ลุงเคี่ยม: the calm tea-shop owner, moustache and checked cloth.
const khiam = (() => {
  const SKIN = P.hueRamp(7, { hue: 21, shift: 10, sat: 0.52, satDrop: 0.12, light: [0.16, 0.68] }); // older and more tanned
  const HAIR = P.hueRamp(5, { hue: 20, shift: 18, sat: 0.16, satDrop: 0.2, light: [0.06, 0.34] });
  const GREY = P.hueRamp(5, { hue: 34, shift: 16, sat: 0.1, satDrop: 0.2, light: [0.22, 0.66] });
  const SHIRT = P.hueRamp(5, { hue: 42, shift: 14, sat: 0.22, satDrop: 0.2, light: [0.36, 0.84] });
  const CLOTH = { deep: [142, 46, 34], mid: [206, 104, 58], pale: [238, 214, 170] }; // ผ้าขาวม้า: P2's orange in checks

  // A longer face with a square jaw, hair going back at the temples.
  const head = (x, y) => round(x, y, CX, 15.4, 9.4, 10.4, 2.7) || round(x, y, CX, 19.4, 9, 7.2, 3);
  const ear = (x, y) => inEl(x, y, 5.9, 18, 2, 2.6) || inEl(x, y, 25.1, 18, 2, 2.6);
  const cap = (x, y) => round(x, y, CX, 13.6, 10.1, 10.6, 2.6);
  const hairline = (x) => { const d = Math.abs(x - CX); return d < 2 ? 9.2 : d < 6.5 ? 9.2 - (d - 2) * 0.55 : d < 8 ? 9.5 : 17.5; };
  const body = (x, y) => inEl(x, y, CX, 34.6, 14.2, 8.2);
  const neck = (x, y) => x >= 11 && x <= 20 && y >= 25 && y <= 28;
  // The cloth lies round the neck and hangs down on both sides.
  const cloth = (x, y) => (inEl(x, y, CX, 27.4, 9.6, 3.5) && !inEl(x, y, CX, 25.2, 5.2, 2.6) && y >= 25) || (y >= 28 && ((x >= 7 && x <= 11) || (x >= 20 && x <= 24)));

  function drawBase() {
    const b = new P.Buf(N, N + BELOW);
    const put = (x, y, ramp, v, strip = 0.2) => b.pset(x, y, ramp[P.band(P.clamp(v, 0, 0.999), ramp.length, x, y, strip)]);
    for (let y = 0; y < N + BELOW; y++) for (let x = 0; x < N; x++) {
      if (body(x, y)) put(x, y, SHIRT, 0.14 + 0.82 * ball(x, y, CX, 34.6, 14.2, 10.4, 0.95));
      if (neck(x, y)) put(x, y, SKIN, y < 27 ? 0.26 : 0.4);
      if (cloth(x, y)) {
        const n = ((x >> 1) & 1) + ((y >> 1) & 1);
        let c = n === 2 ? CLOTH.deep : n === 1 ? CLOTH.mid : CLOTH.pale;
        if (x > 20) c = P.mix(c, [60, 26, 30], 0.28); // the side away from the light
        b.pset(x, y, c);
      }
      if (ear(x, y)) put(x, y, SKIN, x < CX ? 0.72 : 0.48);
      const isHead = head(x, y), t = ((x - CX) / 10) * 0.62 + ((y - 16.5) / 10) * 0.5;
      if (isHead) {
        let v = Math.min(0.84, 0.8 - 0.2 * t);
        if (t > 0.6) v -= 0.14;
        put(x, y, SKIN, v);
      }
      if (cap(x, y) && y < hairline(x)) {
        // Dark on top, grey at the sides.
        const side = Math.abs(x - CX) >= 8 && y > 10;
        put(x, y, side ? GREY : HAIR, side ? 0.66 - 0.3 * t : 0.14 + 0.8 * ball(x, y, CX, 13.6, 10.1, 10.6, 0.96) * 0.95);
      }
    }
    both(b, 5, 18, SKIN[3]); both(b, 5, 19, SKIN[3]); // inner ears
    // A broad nose: lit ridge, shade under it.
    b.pset(15, 19, SKIN[6]); b.pset(15, 18, SKIN[6]);
    for (let x = 14; x <= 17; x++) b.pset(x, 21, SKIN[x < 16 ? 3 : 2]);
    // Lines from the nose to the mouth, and one on the forehead.
    for (const [x, y] of [[9, 21], [9, 22]]) both(b, x, y, SKIN[3]);
    for (let x = 13; x <= 18; x++) b.pset(x, 12, SKIN[4]);
    return b;
  }

  const DARK = [40, 22, 24], WHITE = [250, 244, 232], TONGUE = [182, 74, 68], SWEAT = [150, 206, 226];
  // The moustache: grey-dark, thick under the nose, ends hanging past the mouth. `lift` raises the ends.
  const moustache = (b, lift = 0) => {
    const at = [[14, 22], [15, 22], [16, 22], [17, 22]];
    for (let x = 11; x <= 20; x++) at.push([x, 23]);
    if (lift) at.push([10, 22], [21, 22], [12, 22], [13, 22], [18, 22], [19, 22]);
    else { for (const x of [10, 11, 12, 19, 20, 21]) at.push([x, 24]); at.push([12, 22], [13, 22], [18, 22], [19, 22]); }
    for (const [x, y] of at) b.pset(x, y, GREY[x < 13 ? 2 : x < 18 ? 1 : 0]);
    for (const [x, y] of [[12, 22], [13, 22]]) b.pset(x, y, GREY[3]);
  };
  const brows = (b, pts) => { for (const [x, y] of pts) both(b, x, y, GREY[0]); };
  const bags = (b) => { for (const x of [11, 12]) both(b, x, 19, SKIN[4]); };

  const FACES = {
    // Calm and teasing: half-closed eyes, one brow a little higher, a small smile on one side.
    normal: (b) => {
      for (const x of [9, 10, 11, 12]) b.pset(x, 15, GREY[0]);
      for (const [x, y] of [[19, 14], [20, 14], [21, 14], [22, 15], [12, 15]]) b.pset(x, y, GREY[0]);
      for (const x of [10, 11, 12]) both(b, x, 17, DARK);
      both(b, 11, 18, DARK); both(b, 12, 18, DARK);
      bags(b); moustache(b);
      for (const [x, y] of [[14, 25], [15, 25], [16, 25], [17, 25], [18, 24]]) b.pset(x, y, DARK);
    },
    glad: (b) => {
      brows(b, [[9, 15], [10, 14], [11, 14], [12, 15]]);
      for (const [x, y] of [[9, 18], [10, 17], [11, 17], [12, 17], [13, 18]]) both(b, x, y, DARK);
      moustache(b, 1);
      for (let x = 12; x <= 19; x++) b.pset(x, 24, WHITE);
      for (let x = 12; x <= 19; x++) b.pset(x, 25, x === 12 || x === 19 ? DARK : TONGUE);
      for (let x = 13; x <= 18; x++) b.pset(x, 26, DARK);
    },
    // Outplayed: brows up in the middle, eyes wide open, a drop of sweat.
    sad: (b) => {
      brows(b, [[9, 15], [10, 14], [11, 14], [12, 13]]);
      for (const y of [16, 17, 18]) { both(b, 10, y, WHITE); both(b, 13, y, WHITE); both(b, 11, y, DARK); both(b, 12, y, DARK); }
      b.pset(11, 16, WHITE); b.pset(19, 16, WHITE);
      moustache(b);
      for (const [x, y] of [[14, 25], [15, 25], [16, 25], [17, 25], [13, 26], [18, 26]]) b.pset(x, y, DARK);
      for (const [x, y] of [[23, 11], [23, 12], [22, 12], [23, 13], [22, 13]]) b.pset(x, y, SWEAT);
      b.pset(22, 12, WHITE);
    },
  };

  return finish(drawBase, FACES, HAIR);
})();

// ยายขุม: the village master, white bun, glasses, few words.
const khum = (() => {
  const SKIN = P.hueRamp(7, { hue: 20, shift: 10, sat: 0.46, satDrop: 0.14, light: [0.2, 0.74] });
  const HAIR = P.hueRamp(6, { hue: 40, shift: 30, sat: 0.1, satDrop: 0.2, light: [0.3, 0.92] });
  const BLOUSE = P.hueRamp(5, { hue: 285, shift: 24, sat: 0.28, satDrop: 0.2, light: [0.14, 0.44] });
  const SABAI = P.hueRamp(5, { hue: 22, shift: 14, sat: 0.7, satDrop: 0.2, light: [0.24, 0.6] }); // P2 orange
  const EDGE = P.hueRamp(5, { hue: 16, shift: 22, sat: 0.26, satDrop: 0.2, light: [0.05, 0.32] }); // the same outline as Kaew's

  const head = (x, y) => round(x, y, CX, 17.6, 9.2, 9, 2.6) || inEl(x, y, CX, 21, 8.8, 6);
  const ear = (x, y) => inEl(x, y, 6, 20, 1.8, 2.4) || inEl(x, y, 25, 20, 1.8, 2.4);
  const cap = (x, y) => round(x, y, CX, 15.6, 10, 9, 2.5);
  const bun = (x, y) => inEl(x, y, CX, 4.8, 5, 3.9);
  const hairline = (x) => 11 + ((x - CX) / 9) ** 2 * 6; // parted in the middle, combed back to the bun
  const body = (x, y) => inEl(x, y, CX, 34.6, 13.4, 8);
  const neck = (x, y) => x >= 12 && x <= 19 && y >= 25 && y <= 28;
  const sabai = (x, y) => { const d = x - 5 - (y - 27) * 1.6; return d >= 0 && d < 8; }; // over her right shoulder, across the chest

  function drawBase() {
    const b = new P.Buf(N, N + BELOW);
    const put = (x, y, ramp, v, strip = 0.2) => b.pset(x, y, ramp[P.band(P.clamp(v, 0, 0.999), ramp.length, x, y, strip)]);
    for (let y = 0; y < N + BELOW; y++) for (let x = 0; x < N; x++) {
      if (body(x, y)) put(x, y, sabai(x, y) ? SABAI : BLOUSE, 0.16 + 0.8 * ball(x, y, CX, 34.6, 13.4, 10, 0.95));
      if (neck(x, y) && !(y === 28 && (x < 13 || x > 18))) put(x, y, SKIN, y < 27 ? 0.3 : 0.44);
      if (bun(x, y)) put(x, y, HAIR, 0.08 + 0.9 * ball(x, y, CX, 4.8, 5, 3.9));
      if (ear(x, y)) put(x, y, SKIN, x < CX ? 0.72 : 0.5);
      const t = ((x - CX) / 10) * 0.62 + ((y - 17.5) / 9) * 0.5;
      if (head(x, y)) {
        let v = Math.min(0.84, 0.8 - 0.2 * t);
        if (t > 0.62) v -= 0.14;
        put(x, y, SKIN, v);
      }
      if (cap(x, y) && y < hairline(x)) put(x, y, HAIR, 0.2 + 0.74 * ball(x, y, CX, 15.6, 10.4, 10, 0.95));
    }
    // Strands combed up to the bun, the parting, and the crease under the bun: one step darker.
    for (const [x, y] of [[15, 9], [15, 10], [9, 12], [10, 11], [11, 10], [12, 9], [21, 10], [22, 11], [20, 9], [19, 9]]) b.pset(x, y, HAIR[x < CX ? 3 : 2]);
    for (let x = 12; x <= 19; x++) b.pset(x, 8, HAIR[x < 16 ? 2 : 1]);
    // A coil line on the bun.
    for (const [x, y] of [[12, 5], [13, 6], [14, 6], [15, 6], [16, 5], [17, 4]]) b.pset(x, y, HAIR[3]);
    both(b, 6, 20, SKIN[3]); both(b, 6, 21, SKIN[3]);
    b.pset(15, 22, SKIN[3]); b.pset(16, 22, SKIN[3]); // small nose
    // Age: lines beside the mouth, under the cheeks, one on the forehead.
    for (const [x, y] of [[11, 24], [11, 25], [8, 22]]) both(b, x, y, SKIN[3]);
    for (let x = 14; x <= 17; x++) b.pset(x, 13, SKIN[4]);
    return b;
  }

  const DARK = [44, 24, 26], WHITE = [250, 244, 232], SWEAT = [150, 206, 226], PIN = [224, 176, 64], PIN_DARK = [150, 96, 34];
  // The hairpin goes through the bun (drawn after the edge is cleaned: it is thin on purpose).
  const pin = (b) => { for (const [x, y] of [[11, 5], [10, 5], [10, 6], [9, 6], [8, 6], [20, 4], [21, 4], [21, 3], [22, 3], [23, 3]]) b.pset(x, y, PIN); for (const [x, y] of [[7, 7], [8, 7]]) b.pset(x, y, PIN_DARK); b.pset(23, 2, PIN); b.pset(24, 2, PIN); };
  // Round glasses: rings 7 wide at `dy`, thin bridge and arms, a pale lens.
  const RING = [[-1, -3], [0, -3], [1, -3], [-2, -2], [2, -2], [-3, -1], [3, -1], [-3, 0], [3, 0], [-3, 1], [3, 1], [-2, 2], [2, 2], [-1, 3], [0, 3], [1, 3]];
  const FRAME = [78, 44, 34], FRAME_LIT = [176, 124, 66];
  const lenses = (b, dy = 0, shine = false) => {
    for (const cx of [11, 20]) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.hypot(x, y) < 2.7) {
      const px = cx + x, py = 18 + dy + y, c = P.unpack(b.px[py * b.w + px]);
      b.pset(px, py, shine ? P.mix(c, [236, 240, 236], x + y < 0 ? 0.85 : 0.6) : P.mix(c, [240, 226, 206], 0.34));
    }
  };
  const rings = (b, dy = 0) => {
    for (const cx of [11, 20]) for (const [x, y] of RING) b.pset(cx + x, 18 + dy + y, x + y < -2 ? FRAME_LIT : FRAME);
    b.pset(15, 17 + dy, FRAME); b.pset(16, 17 + dy, FRAME);
    both(b, 7, 17 + dy, FRAME);
  };
  const brows = (b, pts) => { for (const [x, y] of pts) both(b, x, y, HAIR[2]); };

  const FACES = {
    // Quiet and sure: narrow eyes, the corners of the mouth barely up.
    normal: (b) => {
      lenses(b); brows(b, [[9, 14], [10, 13], [11, 13], [12, 14]]);
      for (const x of [10, 11, 12]) both(b, x, 17, DARK);
      both(b, 11, 18, DARK); both(b, 12, 18, DARK);
      rings(b);
      for (const [x, y] of [[14, 25], [15, 25], [16, 25], [17, 25], [13, 24], [18, 24]]) b.pset(x, y, DARK);
    },
    // Glad: the glasses catch the light, a toothy little smile.
    glad: (b) => {
      lenses(b, 0, true); brows(b, [[9, 13], [10, 12], [11, 12], [12, 13]]);
      rings(b);
      for (let x = 12; x <= 19; x++) b.pset(x, 24, DARK);
      for (let x = 13; x <= 18; x++) b.pset(x, 25, x === 16 ? DARK : WHITE); // one tooth missing
      for (let x = 14; x <= 17; x++) b.pset(x, 26, DARK);
    },
    // Outplayed: the glasses slip down, eyes wide over a small round mouth.
    sad: (b) => {
      lenses(b, 1); brows(b, [[9, 14], [10, 13], [11, 13], [12, 12]]);
      for (const y of [17, 18, 19]) { both(b, 10, y, WHITE); both(b, 13, y, WHITE); both(b, 11, y, DARK); both(b, 12, y, DARK); }
      b.pset(11, 17, WHITE); b.pset(19, 17, WHITE);
      rings(b, 1);
      for (const [x, y] of [[15, 24], [16, 24], [14, 25], [17, 25], [15, 26], [16, 26]]) b.pset(x, y, DARK);
      b.pset(15, 25, [150, 60, 56]); b.pset(16, 25, [150, 60, 56]);
      for (const [x, y] of [[25, 12], [25, 13], [24, 13], [25, 14], [24, 14]]) b.pset(x, y, SWEAT);
      b.pset(24, 13, WHITE);
    },
  };

  return finish(drawBase, FACES, EDGE, pin);
})();

P.save(P.pack([...kaew, ...khiam, ...khum], { cols: 3 }), path.join(OUT, 'faces.png'));
console.log('wrote faces.png (9 frames of 34x33)');
