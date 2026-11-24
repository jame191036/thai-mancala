// Draws the board and the marbles in code (GDD §8) and writes the game's PNGs:
//   node tools/art/board.cjs   →  public/assets/board.png (480×120), public/assets/seeds.png
// Needs the codixel skill (README): set CODIXEL to its pixel.js if it lives elsewhere.
// The owner's photo was only used to measure proportions and colours; it is not in the repo.
// Keep the positions in sync with src/display/boardLayout.ts.
const os = require('node:os');
const path = require('node:path');
const P = require(process.env.CODIXEL ?? path.join(os.homedir(), '.claude/skills/codixel/core/pixel.js'));
const OUT = path.join(__dirname, '../../public/assets');

const W = 480, H = 120, OY = 75; // world y of the buffer's first row
const CX = 240, CY = 135, TIP = 5, HALF = 50, LIP = 5;
const PIT_R = 19.5, STORE_R = 29, TOP = 112, BOT = 158;
const pitX = (i) => 108 + 44 * i;

// One light for everything: top left.
const LIGHT = (() => { const v = [-0.5, -0.62, 0.6], n = Math.hypot(...v); return v.map((c) => c / n); })();

// Ramps: hue / saturation measured on the photo (face is grey-brown, carved bowls are warm).
const FACE = P.hueRamp(8, { hue: 26, shift: 16, sat: 0.2, satDrop: 0.25, light: [0.16, 0.66] });
const BOWL = P.hueRamp(9, { hue: 22, shift: 18, sat: 0.43, satDrop: 0.3, light: [0.09, 0.6] });

// Half height of the boat-shaped board at x.
const hull = (x) => {
  const u = P.clamp((Math.min(x, W - 1 - x) - TIP) / 95);
  return u <= 0 ? -1 : HALF * (1 - Math.pow(1 - u, 2.4));
};

const BOWLS = [];
for (let i = 0; i < 7; i++) BOWLS.push({ x: pitX(i) - 0.5, y: TOP - 0.5, r: PIT_R, deep: 0.62, id: i }, { x: pitX(i) - 0.5, y: BOT - 0.5, r: PIT_R, deep: 0.62, id: 7 + i });
BOWLS.push({ x: 52 - 0.5, y: CY - 0.5, r: STORE_R, deep: 0.58, id: 20 }, { x: 428 - 0.5, y: CY - 0.5, r: STORE_R, deep: 0.58, id: 21 });

// Yearly growth layers run along the board. A carved bowl cuts deeper into them, so the
// layer index shifts with depth and the lines close into ovals, as on the real board.
const grain = (x, y, z) => {
  const warp = (P.fbm(x * 0.012, y * 0.05, 3, 11) - 0.5) * 5;
  const f = (y * 0.13 + z * 0.16 + warp) % 1;
  return f < 0 ? f + 1 : f;
};

function drawBoard() {
  const b = new P.Buf(W, H);
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const wy = y + OY, h = hull(x);
    if (h >= 0 && Math.abs(wy - CY + 0.5) <= h) mask[y * W + x] = 1;
  }
  const face = P.smoothMask(mask, W, H);

  // Front side of the plank (its thickness), below the face.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!face[y * W + x]) continue;
    for (let d = 1; d <= LIP; d++) {
      const yy = y + d;
      if (yy < H && !face[yy * W + x]) b.px[yy * W + x] = FACE[d >= LIP ? 0 : d === 1 ? 2 : 1];
    }
  }

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!face[y * W + x]) continue;
    const wy = y + OY;
    let hit = null, dist = 0;
    for (const p of BOWLS) {
      const d = Math.hypot(x - p.x, wy - p.y);
      if (d <= p.r) { hit = p; dist = d; break; }
    }
    if (hit) {
      // A bowl cut as part of a sphere: the wall rises toward the rim.
      const R = hit.r / hit.deep, dx = x - hit.x, dy = wy - hit.y;
      const nz = Math.sqrt(R * R - dist * dist) / R, nx = -dx / R, ny = -dy / R;
      const lit = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
      const depth = Math.sqrt(R * R - dist * dist) - Math.sqrt(R * R - hit.r * hit.r);
      let v = 0.08 + P.clamp((lit - 0.02) / 1.0) * 0.86;
      v -= 0.05 * (depth / hit.r); // the bottom sees less sky
      let k = P.band(v, BOWL.length, x, wy, 0.28);
      if (grain(x, wy, depth * 1.6) < 0.16 && dist < hit.r - 2) k -= 1;
      if (dist > hit.r - 1.3) k += dx + dy < 0 ? -2 : 1; // rim edge: shadow at top left, light at bottom right
      b.px[y * W + x] = BOWL[P.clamp(k, 0, BOWL.length - 1) | 0];
    } else {
      // The flat face: only the rounded edge and the growth lines change its tone.
      const h = hull(x), up = wy - (CY - h), down = CY + h - wy;
      let v = 0.64 + (P.fbm(x * 0.02, wy * 0.06, 2, 5) - 0.5) * 0.22;
      const left = x < CX;
      if (up < 3) v += 0.2 - up * 0.05;
      if (down < 4) v -= 0.24 - down * 0.05;
      if (!left && h < HALF - 2 && Math.min(up, down) < 5) v -= 0.06;
      let k = P.band(v, FACE.length, x, wy, 0.1);
      if (grain(x, wy, 0) < 0.14) k -= 1;
      // Light catching the rim of each bowl, on the side away from the light.
      for (const p of BOWLS) {
        const dx = x - p.x, dy = wy - p.y, d = Math.hypot(dx, dy);
        if (d <= p.r + 1.2 && dx + dy > p.r * 0.5) { k += 1; break; }
      }
      b.px[y * W + x] = FACE[P.clamp(k, 0, FACE.length - 1) | 0];
    }
  }
  return b;
}

// ── Marbles, 6×6: glass lit from the top left (white glint), light gathered at the bottom
// right, and the coloured cat's-eye vane across the middle (s).
const MARBLE = ['.2331.', '2W4321', '344s21', '33s211', '221142', '.1122.'];
const VARIANTS = [
  { name: 'GREEN', hue: 150, vane: [236, 214, 92] },
  { name: 'TEAL', hue: 174, vane: [226, 236, 226] },
  { name: 'BLUE', hue: 200, vane: [92, 150, 226] },
  { name: 'OLIVE', hue: 112, vane: [206, 92, 66] },
].map((v) => ({ ...v, ramp: P.hueRamp(5, { hue: v.hue, shift: 26, sat: 0.46, satDrop: 0.2, light: [0.07, 0.54] }) }));

function drawMarble(b, x, y, variant) {
  MARBLE.forEach((row, j) => [...row].forEach((c, i) => {
    if (c === '.') return;
    b.pset(x + i, y + j, c === 'W' ? [244, 250, 244] : c === 's' ? variant.vane : P.unpack(variant.ramp[+c]));
  }));
}

/** 8 frames of 8×8: the four marbles with their shadow, then without (seeds in the air). */
function seedFrames() {
  return [true, false].flatMap((shadow) => VARIANTS.map((v) => {
    const f = new P.Buf(8, 8);
    if (shadow) MARBLE.forEach((row, j) => [...row].forEach((c, i) => { if (c !== '.') f.pset(i + 1, j + 2, P.unpack(BOWL[1])); }));
    drawMarble(f, 0, 0, v);
    return f;
  }));
}

const board = drawBoard();
const e = P.edgeCheck(board);
if (e.nubs.length + e.strips.length + e.holes.length) throw new Error('board silhouette is not clean');
P.save(board, path.join(OUT, 'board.png'));
P.save(P.pack(seedFrames(), { cols: 8 }), path.join(OUT, 'seeds.png'));
console.log('wrote board.png', board.w, board.h, 'and seeds.png (8 frames of 8x8)');
