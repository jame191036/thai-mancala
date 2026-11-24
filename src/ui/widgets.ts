/**
 * Placeholder UI pieces shared by the menu screens (Settings, Stats, Credits, Title).
 * Real pixel-art panels replace these in the art pass; keeping them in one place means
 * the screens only need re-skinning, not rewriting.
 */
import Phaser from 'phaser';
import { COLORS, CSS, FONT } from '../display/palette';

export function addText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color: string,
  bold = true,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
    .setOrigin(0.5);
}

export interface ButtonOptions {
  width?: number;
  size?: number;
  onClick?: () => void;
  onHover?: () => void;
}

export function addButton(scene: Phaser.Scene, x: number, y: number, label: string, opts: ButtonOptions = {}): Phaser.GameObjects.Text {
  const b = scene.add
    .text(x, y, label, {
      fontFamily: FONT,
      fontSize: `${opts.size ?? 11}px`,
      padding: { x: 6, y: 4 },
      align: 'center',
      ...(opts.width ? { fixedWidth: opts.width } : {}),
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  if (opts.onClick) b.on('pointerdown', opts.onClick);
  if (opts.onHover) b.on('pointerover', opts.onHover);
  paintButton(b, false);
  return b;
}

/** `on` = the chosen value / highlighted button (gold); otherwise dark wood. */
export function paintButton(b: Phaser.GameObjects.Text, on: boolean): void {
  b.setColor(on ? CSS.pitShadow : CSS.cream).setBackgroundColor(on ? CSS.gold : CSS.woodDark);
}

/** The cream frame that shows where keyboard / gamepad focus is. */
export function createFocusFrame(scene: Phaser.Scene): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, 0, 10, 10).setStrokeStyle(2, COLORS.cream).setDepth(5);
}

export function frameAround(frame: Phaser.GameObjects.Rectangle, target: Phaser.GameObjects.Text | undefined): void {
  if (!target) {
    frame.setVisible(false);
    return;
  }
  const b = target.getBounds();
  frame.setPosition(b.centerX, b.centerY).setSize(b.width + 6, b.height + 6).setVisible(true);
}
