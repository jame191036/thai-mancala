/**
 * Placeholder UI pieces shared by the menu screens (Settings, Stats, Credits, Title).
 * Real pixel-art panels replace these in the art pass; keeping them in one place means
 * the screens only need re-skinning, not rewriting. All text is PixelText (GDD §10).
 */
import type Phaser from 'phaser';
import { COLORS, CSS } from '../display/palette';
import { TEXT_SIZE, addPixelText, type PixelText } from '../display/pixelText';

export { TEXT_SIZE };

export function addText(scene: Phaser.Scene, x: number, y: number, text: string, size: number, color: string, bold = true): PixelText {
  return addPixelText(scene, x, y, text, { size, color, bold });
}

export interface ButtonOptions {
  width?: number;
  size?: number;
  onClick?: () => void;
  onHover?: () => void;
}

export function addButton(scene: Phaser.Scene, x: number, y: number, label: string, opts: ButtonOptions = {}): PixelText {
  const b = addPixelText(scene, x, y, label, {
    size: opts.size ?? TEXT_SIZE,
    color: CSS.cream,
    bold: true,
    background: CSS.woodDark,
    padding: { x: 6, y: 0 },
    fixedWidth: opts.width,
  }).setInteractive({ useHandCursor: true });
  if (opts.onClick) b.on('pointerdown', opts.onClick);
  if (opts.onHover) b.on('pointerover', opts.onHover);
  return b;
}

/** `on` = the chosen value / highlighted button (gold); otherwise dark wood. */
export function paintButton(b: PixelText, on: boolean): void {
  b.restyle({ color: on ? CSS.pitShadow : CSS.cream, background: on ? CSS.gold : CSS.woodDark });
}

/** The cream frame that shows where keyboard / gamepad focus is. */
export function createFocusFrame(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, 0, 10, 10).setStrokeStyle(2, COLORS.cream).setDepth(5);
}

export function frameAround(frame: Phaser.GameObjects.Rectangle, target: PixelText | undefined): void {
  if (!target) {
    frame.setVisible(false);
    return;
  }
  const b = target.getBounds();
  frame.setPosition(b.centerX, b.centerY).setSize(b.width + 4, b.height + 4).setVisible(true);
}
