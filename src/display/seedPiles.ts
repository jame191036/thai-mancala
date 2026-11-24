/**
 * The marbles on the board. There are 98 seeds in all, so at most 98 marble sprites ever
 * exist: they move between slots as the shown counts change (seedLayout.ts says where).
 */
import Phaser from 'phaser';
import type { PitIndex } from '../logic/types';
import { slotPosition } from './boardLayout';
import { SEED_VARIANTS, seedSpots } from './seedLayout';

export const SEEDS_TEXTURE = 'seeds';
/** seeds.png: frames 0–3 with a shadow (lying), 4–7 without (in the air). */
export const FLYING_FRAME = SEED_VARIANTS;
/** The marble's centre inside its 8×8 frame (the rest is shadow). */
export const SEED_ORIGIN = 3 / 8;
const DEPTH = 2;

export class SeedPiles {
  private readonly piles = new Map<PitIndex, Phaser.GameObjects.Image[]>();
  private readonly spare: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Show `seeds` marbles in a slot (or as many as it has places for). */
  set(index: PitIndex, seeds: number): void {
    const spots = seedSpots(index);
    const want = Math.min(Math.max(0, seeds), spots.length);
    const pile = this.piles.get(index) ?? [];
    this.piles.set(index, pile);
    while (pile.length > want) this.spare.push((pile.pop() as Phaser.GameObjects.Image).setVisible(false));
    while (pile.length < want) pile.push(this.take());

    const c = slotPosition(index);
    pile.forEach((marble, k) => {
      const s = spots[k];
      this.scene.tweens.killTweensOf(marble); // a bounce still running would move it back
      marble
        .setFrame(s.variant)
        .setPosition(c.x + s.dx, c.y + s.dy)
        .setDepth(DEPTH + s.layer * 0.1 + s.dy * 0.001)
        .setVisible(true);
    });
  }

  /** The newest marble of a slot drops the last few pixels into place. */
  bounce(index: PitIndex): void {
    const marble = this.piles.get(index)?.at(-1);
    if (!marble) return;
    const y = marble.y;
    this.scene.tweens.add({ targets: marble, y: { from: y - 4, to: y }, duration: 80, ease: 'Quad.In' });
  }

  /** Marbles shown in a slot (read by playtests). */
  count(index: PitIndex): number {
    return this.piles.get(index)?.length ?? 0;
  }

  private take(): Phaser.GameObjects.Image {
    return this.spare.pop() ?? this.scene.add.image(0, 0, SEEDS_TEXTURE, 0).setOrigin(SEED_ORIGIN);
  }
}
