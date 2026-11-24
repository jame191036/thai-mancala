/**
 * All text in the game (GDD §10, owner's choice 2026-11-24): Chakra Petch drawn as crisp
 * 1-bit pixels.
 *
 * The browser's canvas shapes Thai correctly (stacked vowels and tone marks), so the text
 * is drawn there at its real pixel size, then every pixel is made fully on or fully off
 * (binarize.ts). With the integer zoom this shows clean square pixels instead of the blurry
 * grey edges Phaser's anti-aliased Text gets when scaled up.
 *
 * `PixelText` is an Image with the bits of the Phaser Text API this game uses (setText,
 * setColor, setBackgroundColor, `text`), so scenes treat it like text. Each distinct
 * text + style becomes one texture, made once and shared by every scene.
 *
 * Sizes: Thai text at least 12 px (10 px is hard to read); short Latin labels and digits
 * may be smaller. Use `outline` for text sitting on the wooden board.
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
  /** CSS font family stack (default: Chakra Petch, see palette FONT). */
  family?: string;
  /** Coverage needed to light a pixel, 0–1 (default 0.5). Lower = bolder. */
  threshold?: number;
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

function cssFont(style: PixelTextStyle): string {
  const weight = style.bold && style.size >= MIN_BOLD_SIZE ? 700 : 400;
  return `${weight} ${style.size}px ${style.family ?? FONT}`;
}

/** The letters alone, 1-bit, with room for every mark above and below the line. */
function renderLetters(text: string, style: PixelTextStyle): HTMLCanvasElement {
  const pad = style.outline ? 1 : 0;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('pixelText: no 2D canvas');
  ctx.font = cssFont(style);
  const m = ctx.measureText(text);
  // Font-wide ascent/descent keep every line of one size the same height (buttons in a
  // row line up); the real extent wins when stacked marks reach further.
  const ascent = Math.ceil(Math.max(m.actualBoundingBoxAscent, m.fontBoundingBoxAscent || 0));
  const descent = Math.ceil(Math.max(m.actualBoundingBoxDescent, m.fontBoundingBoxDescent || 0));
  const left = Math.max(0, Math.ceil(m.actualBoundingBoxLeft));
  canvas.width = Math.max(1, Math.ceil(Math.max(m.width, m.actualBoundingBoxRight + left)) + left + pad * 2);
  canvas.height = Math.max(1, ascent + descent + pad * 2);

  ctx.font = cssFont(style); // resizing the canvas resets the context
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, pad + left, pad + ascent);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  img.data.set(
    binarize(img.data, canvas.width, canvas.height, style.threshold ?? 0.5, hexToRgb(style.color), style.outline ? hexToRgb(style.outline) : undefined),
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
    style.threshold ?? 0.5,
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
