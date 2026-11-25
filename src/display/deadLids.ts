/**
 * The wooden lids over dead pits (lid.png from tools/art/lid.cjs). A lid that closes plays its
 * five frames (it comes down, lands with a little dust) and then lies on the pit until the pit
 * is filled again. The same lid in every board style.
 */
import type Phaser from 'phaser';
import type { PitIndex } from '../logic/types';
import { slotPosition } from './boardLayout';

export const LID_TEXTURE = 'lid';
/** lid.png: five square frames; the last one is the closed lid. */
export const LID_FRAME = 56;
const CLOSED_FRAME = 4;
const CLOSE_FPS = 10;
const CLOSE_ANIM = 'lid-close';
/** Above the marbles, below the sowing hand. */
const DEPTH = 6;

export class DeadLids {
  private readonly lids = new Map<PitIndex, Phaser.GameObjects.Sprite>();

  constructor(private readonly scene: Phaser.Scene) {
    // Animations belong to the game, not the scene: made once.
    if (!scene.anims.exists(CLOSE_ANIM)) {
      scene.anims.create({
        key: CLOSE_ANIM,
        frames: scene.anims.generateFrameNumbers(LID_TEXTURE, { start: 0, end: CLOSED_FRAME }),
        frameRate: CLOSE_FPS,
      });
    }
  }

  /** The lid lying on (or coming down onto) a pit. */
  at(pit: PitIndex): Phaser.GameObjects.Sprite | undefined {
    return this.lids.get(pit);
  }

  /** Lids still coming down. */
  get closing(): PitIndex[] {
    return [...this.lids].filter(([, lid]) => lid.anims.isPlaying).map(([pit]) => pit);
  }

  /** Put a lid on `pit`; `speed` 0 = at once, 1 = the normal pace. A lid already there stays. */
  close(pit: PitIndex, speed = 0): void {
    if (this.lids.has(pit)) return;
    const { x, y } = slotPosition(pit);
    const lid = this.scene.add.sprite(x, y, LID_TEXTURE, CLOSED_FRAME).setDepth(DEPTH);
    this.lids.set(pit, lid);
    if (speed > 0) lid.play({ key: CLOSE_ANIM, frameRate: CLOSE_FPS * speed });
  }

  /** The pit is alive again. */
  open(pit: PitIndex): void {
    this.lids.get(pit)?.destroy();
    this.lids.delete(pit);
  }

  /** End every closing at once (the player skips the animation). */
  finish(): void {
    for (const lid of this.lids.values()) {
      if (lid.anims.isPlaying) lid.stop().setFrame(CLOSED_FRAME);
    }
  }
}
