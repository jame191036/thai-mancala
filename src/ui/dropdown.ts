/**
 * A pixel-text dropdown for the menus (placeholder look until the art pass).
 *
 * Closed: a box showing the current choice and a ▼. Click / tap / Enter / gamepad A opens
 * the list below it; ← → (or the stick) change the choice without opening.
 * Open: ↑ ↓ move the highlight, Enter / A picks, Esc / B or a click outside closes.
 * While open, a transparent blocker covers the rest of the screen so nothing else reacts.
 */
import type Phaser from 'phaser';
import { COLORS, CSS } from '../display/palette';
import { TEXT_SIZE, addPixelText, type PixelText } from '../display/pixelText';
import type { PadAction } from '../input/gamepad';

export interface DropdownConfig<T> {
  x: number;
  y: number;
  width: number;
  values: readonly T[];
  labelOf: (v: T) => string;
  get: () => T;
  set: (v: T) => void;
}

/** Height of one row of the open list (base px); the first row is centred at y + ROW_H. */
export const DROPDOWN_ROW_H = 24;
const DEPTH = 30;

export class Dropdown<T> {
  readonly box: PixelText;
  private readonly arrow: Phaser.GameObjects.Graphics;
  private rows: PixelText[] = [];
  private blocker: Phaser.GameObjects.Rectangle | null = null;
  private highlight = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cfg: DropdownConfig<T>,
  ) {
    this.box = addPixelText(scene, cfg.x, cfg.y, '', {
      size: TEXT_SIZE,
      color: CSS.cream,
      background: CSS.woodDark,
      padding: { x: 6, y: 0 },
      fixedWidth: cfg.width,
      align: 'left',
    }).setInteractive({ useHandCursor: true });
    this.box.on('pointerdown', () => (this.isOpen ? this.close() : this.open()));
    this.arrow = scene.add.graphics();
    this.refresh();
  }

  get isOpen(): boolean {
    return this.rows.length > 0;
  }

  /** Show the current choice in the closed box. */
  refresh(): void {
    this.box.setText(this.cfg.labelOf(this.cfg.get()));
    // ▼ drawn as pixels at the right end of the box.
    const right = Math.round(this.cfg.x + this.cfg.width / 2) - 8;
    const top = Math.round(this.cfg.y) - 2;
    this.arrow.clear().fillStyle(COLORS.gold).fillTriangle(right - 7, top, right, top, right - 3.5, top + 4);
  }

  /** Change the choice without opening (← →, or the stick). */
  step(dir: 1 | -1): void {
    const { values } = this.cfg;
    const i = values.indexOf(this.cfg.get());
    this.cfg.set(values[Math.max(0, Math.min(values.length - 1, i + dir))]);
    this.refresh();
  }

  open(): void {
    if (this.isOpen) return;
    const { x, y, width, values, labelOf } = this.cfg;
    const { width: w, height: h } = this.scene.scale;
    this.blocker = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.001).setOrigin(0).setDepth(DEPTH - 1).setInteractive();
    this.blocker.on('pointerdown', () => this.close());
    this.highlight = Math.max(0, values.indexOf(this.cfg.get()));
    this.rows = values.map((v, i) => {
      const row = addPixelText(this.scene, x, y + (i + 1) * DROPDOWN_ROW_H, labelOf(v), {
        size: TEXT_SIZE,
        color: CSS.cream,
        background: CSS.pitShadow,
        padding: { x: 6, y: 0 },
        fixedWidth: width,
        align: 'left',
      })
        .setDepth(DEPTH)
        .setInteractive({ useHandCursor: true });
      row.on('pointerover', () => this.setHighlight(i));
      row.on('pointerdown', () => this.choose(i));
      return row;
    });
    this.paintRows();
  }

  close(): void {
    for (const r of this.rows) r.destroy();
    this.rows = [];
    this.blocker?.destroy();
    this.blocker = null;
  }

  /**
   * Keyboard / gamepad while the list is open. Returns true when the action was used
   * (the caller should then ignore it).
   */
  nav(action: PadAction): boolean {
    if (!this.isOpen) return false;
    const n = this.cfg.values.length;
    if (action === 'up') this.setHighlight(Math.max(0, this.highlight - 1));
    else if (action === 'down') this.setHighlight(Math.min(n - 1, this.highlight + 1));
    else if (action === 'confirm') this.choose(this.highlight);
    else if (action === 'cancel') this.close();
    return true;
  }

  private choose(i: number): void {
    this.cfg.set(this.cfg.values[i]);
    this.close();
    this.refresh();
  }

  private setHighlight(i: number): void {
    this.highlight = i;
    this.paintRows();
  }

  private paintRows(): void {
    this.rows.forEach((r, i) => {
      const on = i === this.highlight;
      r.restyle({ color: on ? CSS.pitShadow : CSS.cream, background: on ? CSS.gold : CSS.pitShadow });
    });
  }
}
