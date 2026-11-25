/**
 * The AI's face and speech bubble (GDD §6). The face shows the mood of what it says and goes
 * back to normal when the bubble goes.
 */
import Phaser from 'phaser';
import { CHARACTERS, MOOD_OF, type Mood, type TalkEvent } from '../characters';
import type { AiLevel } from '../ai/ai';
import { COLORS, CSS } from './palette';
import { TEXT_SIZE, addPixelText, type PixelText } from './pixelText';

export const FACES_TEXTURE = 'faces';
/** faces.png: one row per level (easy, medium, hard), one column per mood. */
export const FACE_FRAME = { width: 34, height: 33 } as const;
const LEVELS: readonly AiLevel[] = ['easy', 'medium', 'hard'];
const MOODS: readonly Mood[] = ['normal', 'glad', 'sad'];

/** How long a bubble stays during a game. */
export const TALK_MS = 1600;
/** Above the board and everything that moves on it. */
const DEPTH = 20;
/** The bubble comes up this far. */
const HOP = 3;

export function faceFrame(level: AiLevel, mood: Mood): number {
  return LEVELS.indexOf(level) * MOODS.length + MOODS.indexOf(mood);
}

export interface PortraitOptions {
  /** Top left corner of the face. */
  x: number;
  y: number;
  /** Left end and middle of the bubble, which goes below the face. */
  bubble: { x: number; y: number };
  /** Reduced motion: the bubble does not hop. */
  still: boolean;
}

export class Portrait {
  mood: Mood = 'normal';
  private readonly face: Phaser.GameObjects.Image;
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly text: PixelText;
  private hideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: AiLevel,
    private readonly opts: PortraitOptions,
  ) {
    this.face = scene.add.image(opts.x, opts.y, FACES_TEXTURE, faceFrame(level, 'normal')).setOrigin(0).setDepth(DEPTH);
    this.box = scene.add.graphics().setDepth(DEPTH).setVisible(false);
    this.text = addPixelText(scene, opts.bubble.x, opts.bubble.y, '', {
      size: TEXT_SIZE,
      color: CSS.pitShadow,
      background: CSS.cream,
      padding: { x: 4, y: 0 },
    })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH + 1)
      .setVisible(false);
  }

  /** The line being said, or '' (read by playtests). */
  get line(): string {
    return this.text.visible ? this.text.text : '';
  }

  /** React to `event`: the line and the mood, for `ms` (or for good). */
  say(event: TalkEvent, ms?: number): void {
    this.hush();
    this.setMood(MOOD_OF[event]);
    this.text.setText(CHARACTERS[this.level].lines[event]).setVisible(true);
    this.drawBox();
    if (!this.opts.still) {
      const { y } = this.opts.bubble;
      this.scene.tweens.add({ targets: this.box, y: { from: HOP, to: 0 }, duration: 110, ease: 'Quad.Out' });
      this.scene.tweens.add({ targets: this.text, y: { from: y + HOP, to: y }, duration: 110, ease: 'Quad.Out' });
    }
    if (ms !== undefined) this.hideTimer = this.scene.time.delayedCall(ms, () => this.hush());
  }

  /** Put the bubble away. */
  hush(): void {
    this.hideTimer?.remove();
    this.hideTimer = null;
    this.settle();
    this.text.setVisible(false);
    this.box.setVisible(false);
    this.setMood('normal');
  }

  /** End the hop where it was going (tweens were killed). */
  settle(): void {
    this.scene.tweens.killTweensOf([this.box, this.text]);
    this.box.setY(0);
    this.text.setY(this.opts.bubble.y);
  }

  private setMood(mood: Mood): void {
    this.mood = mood;
    this.face.setFrame(faceFrame(this.level, mood));
  }

  /** A 1 px dark edge round the text's own cream box, and a small tail up to the face. */
  private drawBox(): void {
    const { bubble } = this.opts;
    const left = bubble.x;
    const top = Math.round(bubble.y - this.text.height / 2);
    const { width: w, height: h } = this.text;
    const g = this.box.clear().setVisible(true);
    g.fillStyle(COLORS.pitShadow);
    g.fillRect(left - 1, top, w + 2, h);
    g.fillRect(left, top - 1, w, h + 2);
    const x = left + 14;
    g.fillRect(x - 2, top - 4, 5, 4);
    g.fillStyle(COLORS.cream);
    g.fillRect(x - 1, top - 2, 3, 2);
    g.fillRect(x, top - 3, 1, 1);
  }
}
