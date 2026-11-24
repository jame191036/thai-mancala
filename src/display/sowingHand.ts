/**
 * What carries the seeds while sowing (settings: board style).
 *  - a circle with the number of seeds in it, hovering at the inner edge of each pit, or
 *  - a picture of a hand (hand.png): its sleeve shows whose it is, P1's reaches in from below
 *    and P2's from above, and the point the marbles drop from sits over the pit.
 */
import Phaser from 'phaser';
import type { PitIndex, Player } from '../logic/types';
import { handPosition, slotPosition, type Point } from './boardLayout';
import { COLORS, CSS } from './palette';
import { TEXT_SIZE, addPixelText, digits, type PixelText } from './pixelText';

export const HAND_TEXTURE = 'hand';
/** hand.png: 32×40 frames, P1 open / carry / drop, then P2 open / carry / drop. */
export const HAND_FRAME = { width: 32, height: 40 } as const;

export type HandPose = 'open' | 'carry' | 'drop';
const POSES: readonly HandPose[] = ['open', 'carry', 'drop'];
/** Where the marbles leave the hand, inside its frame, per player. */
const DROP_POINT: readonly Point[] = [
  { x: 6, y: 10 },
  { x: 26, y: 30 },
];
/** The back of the hand, where the number is written, from the drop point. */
const NUMBER_AT: readonly Point[] = [
  { x: 10, y: 17 },
  { x: -10, y: -17 },
];
/** How much of the way to the next pit the fingers stay open after letting a marble go. */
const RELEASE = 0.35;

export class SowingHand {
  /** Moves as one piece: tween its x / y. */
  readonly body: Phaser.GameObjects.Container;
  pose: HandPose = 'open';
  player: Player = 0;
  private readonly sprite: Phaser.GameObjects.Image | null;
  private readonly label: PixelText;
  /** Nothing has been dropped since the seeds were taken: the hand stays closed. */
  private fresh = true;

  /** `picture`: the hand instead of the circle. `facing`: P2's number upside down. */
  constructor(
    scene: Phaser.Scene,
    private readonly picture: boolean,
    private readonly facing: boolean,
  ) {
    if (picture) {
      this.sprite = scene.add.image(0, 0, HAND_TEXTURE, 0);
      this.label = addPixelText(scene, 0, 0, '', { ...digits(TEXT_SIZE, CSS.cream), outline: CSS.textEdge });
      this.body = scene.add.container(0, 0, [this.sprite, this.label]);
    } else {
      this.sprite = null;
      const circle = scene.add.circle(0, 0, 8, COLORS.gold).setStrokeStyle(1, COLORS.woodDark);
      this.label = addPixelText(scene, 0, 0, '', digits(11, CSS.pitShadow));
      this.body = scene.add.container(0, 0, [circle, this.label]);
    }
    this.body.setDepth(10).setVisible(false);
  }

  /** Where the hand belongs over a pit or store. */
  spot(index: PitIndex): Point {
    return this.picture ? slotPosition(index) : handPosition(index);
  }

  /** Pick up every seed of `index`. */
  take(player: Player, index: PitIndex, seeds: number): void {
    const p = this.spot(index);
    this.player = player;
    this.fresh = true;
    this.body.setPosition(p.x, p.y).setVisible(true);
    this.setSeeds(seeds);
    this.setPose('carry');
  }

  /** On the way to the next pit (`progress` 0–1): let go first, then close again. */
  travel(progress: number): void {
    this.setPose(!this.fresh && progress < RELEASE ? 'drop' : 'carry');
  }

  /** One seed was dropped; `left` remain in the hand. */
  dropped(left: number): void {
    this.fresh = false;
    this.setSeeds(left);
    if (left === 0) this.setPose('open');
  }

  hide(): void {
    this.body.setVisible(false);
  }

  private setSeeds(seeds: number): void {
    this.label.setText(seeds > 0 ? String(seeds) : '');
  }

  private setPose(pose: HandPose): void {
    this.pose = pose;
    if (!this.sprite) return;
    const drop = DROP_POINT[this.player];
    const number = NUMBER_AT[this.player];
    this.sprite.setFrame(this.player * POSES.length + POSES.indexOf(pose)).setOrigin(drop.x / HAND_FRAME.width, drop.y / HAND_FRAME.height);
    this.label.setPosition(number.x, number.y).setRotation(this.facing && this.player === 1 ? Math.PI : 0);
  }
}
