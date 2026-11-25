/**
 * All text in the game (GDD §10, owner's choice 2026-11-24): Mali drawn as crisp
 * 1-bit pixels.
 *
 * The browser's canvas shapes Thai correctly (stacked vowels and tone marks), so the text
 * is drawn there at its real pixel size, letter by letter on whole pixels, and then every
 * pixel is made fully on or fully off (binarize.ts). With the integer zoom this shows clean square pixels instead of the blurry
 * grey edges Phaser's anti-aliased Text gets when scaled up.
 *
 * `PixelText` is an Image with the bits of the Phaser Text API this game uses (setText,
 * setColor, setBackgroundColor, `text`), so scenes treat it like text. Each distinct
 * text + style becomes one texture, made once and shared by every scene.
 *
 * Sizes: Thai text at least TEXT_SIZE (13 px); short Latin labels and digits
 * may be smaller (see digits()). Use `outline` for text sitting on the wooden board.
 */
import Phaser from 'phaser';
import { binarize, hexToRgb } from './binarize';
import { FONT } from './palette';

export interface PixelTextStyle {
  /** Font size in base pixels. */
  size: number;
  /** '#RRGGBB' */
  color: string;
  /** Bold from 14 px up; smaller text is always regular (see MIN_BOLD_SIZE). */
  bold?: boolean;
  /** CSS font family stack (default: Mali, see palette FONT). */
  family?: string;
  /** Coverage needed to light a pixel, 0–1 (default THRESHOLD). Lower = bolder. */
  threshold?: number;
  /** Box only as tall as digits, so a number sits centred on its point (see DIGITS). */
  tight?: boolean;
  /** '#RRGGBB' 1-pixel outline around the letters. */
  outline?: string;
  /** '#RRGGBB' fill for the whole box (buttons). */
  background?: string;
  /** Space between the letters and the edge of the box, in base pixels. */
  padding?: { x: number; y: number };
  /** Box at least this wide; the letters are placed by `align` (default centre). */
  fixedWidth?: number;
  align?: 'left' | 'center' | 'right';
}

/** Bold below this size fills the gaps inside Thai letters once it is 1-bit: use regular. */
const MIN_BOLD_SIZE = 14;

/** Size of all ordinary text. Smaller Thai letters lose their heads (GDD §10). */
export const TEXT_SIZE = 13;

/**
 * Coverage that lights a pixel, chosen so the heads of Mali's letters stay open. Bold strokes
 * need more. Measure with white text like renderLetters: black text comes out thinner.
 */
const THRESHOLD = { regular: 0.6, bold: 0.7 } as const;

/** Style for a number on its own, centred on its point. At least 11 px. */
export function digits(size: number, color: string, bold = false): PixelTextStyle {
  return { size, color, bold, tight: true };
}

const isBold = (style: PixelTextStyle): boolean => style.bold === true && style.size >= MIN_BOLD_SIZE;

function thresholdOf(style: PixelTextStyle): number {
  return style.threshold ?? (isBold(style) ? THRESHOLD.bold : THRESHOLD.regular);
}

function cssFont(style: PixelTextStyle): string {
  const weight = isBold(style) ? 700 : 400;
  return `${weight} ${style.size}px ${style.family ?? FONT}`;
}

/**
 * Text reaching as high and as low as Thai lines do: every line of one size gets this height,
 * because the font's own line height leaves far more room than the small screen has.
 */
const TALLEST = 'ผู้ปั้นที่ญฎฐฤ';
const DIGIT_HEIGHT = '0123456789P';

/** Splits text into letters together with their vowels and tone marks (undefined: old browser). */
const LETTERS = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : undefined;

/** At TEXT_SIZE these look alike; this far off the whole pixel each keeps its own head or tail. */
const NUDGE: Readonly<Record<string, number>> = { ข: 0.4, ช: 0.2, ซ: 0.2, '!': 0.25 };
/** At TEXT_SIZE the dot of "!" runs into its stroke: drawn fainter, the gap stays open. */
const FAINTER: Readonly<Record<string, number>> = { '!': 0.6 / 0.7 };

/**
 * Every letter starts on a whole pixel. Drawn as one line, the same letter falls on different
 * fractions of a pixel and its 1-bit shape changes (ด could turn into ค).
 */
function placeLetters(ctx: CanvasRenderingContext2D, text: string, style: PixelTextStyle): { letters: { s: string; x: number }[]; width: number } {
  const parts = LETTERS ? Array.from(LETTERS.segment(text), (p) => p.segment) : [text];
  let x = 0;
  const letters = parts.map((s) => {
    const letter = { s, x: x + (style.size === TEXT_SIZE ? (NUDGE[s[0]] ?? 0) : 0) };
    x += Math.round(ctx.measureText(s).width);
    return letter;
  });
  return { letters, width: x };
}

/** The letters alone, 1-bit, with room for every mark above and below the line. */
function renderLetters(text: string, style: PixelTextStyle): HTMLCanvasElement {
  const pad = style.outline ? 1 : 0;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('pixelText: no 2D canvas');
  ctx.font = cssFont(style);
  const m = ctx.measureText(text);
  const line = ctx.measureText(style.tight ? DIGIT_HEIGHT : TALLEST);
  // The same height for every line of one size (buttons in a row line up); the real extent
  // wins when stacked marks reach further.
  const ascent = Math.ceil(Math.max(m.actualBoundingBoxAscent, line.actualBoundingBoxAscent));
  const descent = Math.ceil(Math.max(m.actualBoundingBoxDescent, line.actualBoundingBoxDescent));
  const left = Math.max(0, Math.ceil(m.actualBoundingBoxLeft));
  const { letters, width } = placeLetters(ctx, text, style);
  // A last letter may reach past its own width.
  const overhang = Math.max(0, Math.ceil(m.actualBoundingBoxRight - m.width));
  canvas.width = Math.max(1, left + width + overhang + pad * 2);
  canvas.height = Math.max(1, ascent + descent + pad * 2);

  ctx.font = cssFont(style); // resizing the canvas resets the context
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  for (const l of letters) {
    ctx.globalAlpha = style.size === TEXT_SIZE ? (FAINTER[l.s] ?? 1) : 1;
    ctx.fillText(l.s, pad + left + l.x, pad + ascent);
  }
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  img.data.set(
    binarize(img.data, canvas.width, canvas.height, thresholdOf(style), hexToRgb(style.color), style.outline ? hexToRgb(style.outline) : undefined),
  );
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Letters plus the optional box (background, padding, fixed width). */
export function renderPixelTextCanvas(text: string, style: PixelTextStyle): HTMLCanvasElement {
  const letters = renderLetters(text, style);
  const padX = style.padding?.x ?? 0;
  const padY = style.padding?.y ?? 0;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(style.fixedWidth ?? 0, letters.width + padX * 2);
  canvas.height = letters.height + padY * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('pixelText: no 2D canvas');
  ctx.imageSmoothingEnabled = false;
  if (style.background) {
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const align = style.align ?? 'center';
  const x = align === 'left' ? padX : align === 'right' ? canvas.width - padX - letters.width : Math.floor((canvas.width - letters.width) / 2);
  ctx.drawImage(letters, x, padY);
  return canvas;
}

function styleKey(style: PixelTextStyle): string {
  const p = style.padding;
  return [
    cssFont(style),
    style.color,
    thresholdOf(style),
    style.tight ? 'tight' : '',
    style.outline ?? '',
    style.background ?? '',
    p ? `${p.x},${p.y}` : '',
    style.fixedWidth ?? '',
    style.align ?? '',
  ].join('|');
}

/** Texture key for `text` in `style`, created once and reused by every scene. */
export function pixelTextTexture(scene: Phaser.Scene, text: string, style: PixelTextStyle): string {
  const key = `ptext|${styleKey(style)}|${text}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, renderPixelTextCanvas(text, style));
  return key;
}

export class PixelText extends Phaser.GameObjects.Image {
  private content: string;
  private look: PixelTextStyle;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, style: PixelTextStyle) {
    super(scene, x, y, pixelTextTexture(scene, text, style));
    this.content = text;
    this.look = { ...style };
  }

  /** The text shown (read by playtests too). */
  get text(): string {
    return this.content;
  }

  setText(text: string | number): this {
    const t = String(text);
    if (t === this.content) return this;
    this.content = t;
    return this.redraw();
  }

  setColor(color: string): this {
    return color === this.look.color ? this : this.restyle({ color });
  }

  setBackgroundColor(background: string | undefined): this {
    return background === this.look.background ? this : this.restyle({ background });
  }

  restyle(patch: Partial<PixelTextStyle>): this {
    this.look = { ...this.look, ...patch };
    return this.redraw();
  }

  private redraw(): this {
    this.setTexture(pixelTextTexture(this.scene, this.content, this.look));
    // A clickable label keeps a hit area the size of its new text.
    const hit = this.input?.hitArea as unknown;
    if (hit instanceof Phaser.Geom.Rectangle) hit.setSize(this.width, this.height);
    return this;
  }
}

/** Add a PixelText to `scene` (origin at its centre, like the game's old Text labels). */
export function addPixelText(scene: Phaser.Scene, x: number, y: number, text: string, style: PixelTextStyle): PixelText {
  return scene.add.existing(new PixelText(scene, x, y, text, style));
}
