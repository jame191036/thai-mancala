/**
 * The title screen's board playing by itself (GDD §7, attract mode): the easy AI moves for both
 * sides by the real rules, one marble at a time, game after game. Nothing is saved or counted.
 */
import Phaser from 'phaser';
import { chooseMove } from '../ai/ai';
import { BOARD_SIZE, storeOf } from '../logic/board';
import { createGame, playMove, randomPlayer } from '../logic/rules';
import type { GameState, PitIndex, Step } from '../logic/types';
import { TITLE_BOARD, TITLE_SEED_VARIANTS, titleCapacity, titleSlot, titleSpot } from './titleLayout';

export const TITLE_BOARD_TEXTURE = 'title-board';
export const TITLE_SEEDS_TEXTURE = 'title-seeds';
/** title-seeds.png: frames 0–3 with a shadow (lying), 4–7 without (in the air, or on others). */
export const TITLE_SEED_FRAME = 6;
/** The marble's centre inside its frame. */
const SEED_AT = { x: 2, y: 3 } as const;

const FLY_MS = 300;
const REST_MS = 140;
const HOP = 14;
const DEPTH = { board: 1, seeds: 2, flying: 6 } as const;

export class TitleDemo {
  /** The position the board shows between two moves (read by playtests). */
  state: GameState;
  /** Seeds shown in each slot right now; the one in the air is in none. */
  shown: number[];
  moves = 0;
  games = 1;
  /** Smaller = faster (playtests). */
  pace = 1;
  private readonly piles: Phaser.GameObjects.Image[][] = Array.from({ length: BOARD_SIZE }, () => []);
  private readonly spare: Phaser.GameObjects.Image[] = [];
  private readonly flying: Phaser.GameObjects.Image;
  private at: { x: number; y: number } = { x: 0, y: 0 };

  /** `still`: reduced motion, the board just lies there. */
  constructor(
    private readonly scene: Phaser.Scene,
    still: boolean,
  ) {
    scene.add.image(0, TITLE_BOARD.imageY, TITLE_BOARD_TEXTURE).setOrigin(0).setDepth(DEPTH.board);
    this.flying = this.newSeed().setDepth(DEPTH.flying).setVisible(false);
    this.state = createGame('short', randomPlayer());
    this.shown = [...this.state.pits];
    this.showAll(this.state);
    if (!still) this.wait(900, () => this.move());
  }

  /** Marbles drawn in each slot (a very full slot shows fewer than it has). */
  drawn(): number[] {
    return this.piles.map((p) => p.length);
  }

  private move(): void {
    if (this.state.phase !== 'playing') {
      this.wait(2600, () => {
        this.games += 1;
        this.state = createGame('short', randomPlayer());
        this.showAll(this.state);
        this.wait(900, () => this.move());
      });
      return;
    }
    const result = playMove(this.state, chooseMove(this.state, 'easy'));
    this.play(result.steps, 0, () => {
      this.state = result.state;
      this.moves += 1;
      this.showAll(this.state); // never drift from the engine
      this.wait(700, () => this.move());
    });
  }

  private play(steps: readonly Step[], i: number, done: () => void): void {
    if (i >= steps.length) return done();
    const step = steps[i];
    const next = () => this.play(steps, i + 1, done);
    switch (step.kind) {
      case 'pickup':
      case 'relay':
        this.set(step.pit, 0);
        this.at = titleSlot(step.pit);
        return this.wait(260, next);
      case 'drop':
        return this.fly(step.pit, () => {
          this.set(step.pit, step.pitSeeds);
          this.wait(REST_MS, next);
        });
      case 'capture': {
        const store = storeOf(step.player);
        this.set(step.opposite, 0);
        this.set(step.pit, 0);
        this.at = titleSlot(step.opposite);
        return this.fly(store, () => {
          this.set(store, this.shown[store] + step.toStore);
          this.wait(500, next);
        });
      }
      default:
        return next();
    }
  }

  /** A marble hops from where the hand is to a slot. */
  private fly(to: PitIndex, then: () => void): void {
    const from = this.at;
    const goal = titleSlot(to);
    const { variant } = titleSpot(to, Math.min(this.shown[to], titleCapacity(to) - 1));
    const marble = this.flying.setFrame(TITLE_SEED_VARIANTS + variant);
    const place = (t: number) => this.put(marble, from.x + (goal.x - from.x) * t, from.y + (goal.y - from.y) * t - Math.sin(t * Math.PI) * HOP);
    place(0);
    marble.setVisible(true);
    const hop = { t: 0 };
    this.scene.tweens.add({
      targets: hop,
      t: 1,
      duration: FLY_MS * this.pace,
      ease: 'Sine.InOut',
      onUpdate: () => place(hop.t),
      onComplete: () => {
        marble.setVisible(false);
        this.at = goal;
        then();
      },
    });
  }

  private showAll(state: GameState): void {
    // Slots that lose marbles first: the others are filled with those, never with new ones.
    const before = [...this.shown];
    state.pits.forEach((n, i) => n < before[i] && this.set(i, n));
    state.pits.forEach((n, i) => n >= before[i] && this.set(i, n));
  }

  private set(i: PitIndex, seeds: number): void {
    this.shown[i] = seeds;
    const pile = this.piles[i];
    const want = Math.min(seeds, titleCapacity(i));
    while (pile.length > want) this.spare.push((pile.pop() as Phaser.GameObjects.Image).setVisible(false));
    while (pile.length < want) {
      const s = titleSpot(i, pile.length);
      const marble = this.spare.pop() ?? this.newSeed();
      marble
        .setFrame(s.layer === 0 ? s.variant : TITLE_SEED_VARIANTS + s.variant)
        .setDepth(DEPTH.seeds + s.layer + (s.y - 180) * 0.001)
        .setVisible(true);
      pile.push(this.put(marble, s.x, s.y));
    }
  }

  private newSeed(): Phaser.GameObjects.Image {
    return this.scene.add.image(0, 0, TITLE_SEEDS_TEXTURE, 0).setOrigin(0);
  }

  /** On whole pixels, the marble's centre at (x, y). */
  private put(marble: Phaser.GameObjects.Image, x: number, y: number): Phaser.GameObjects.Image {
    return marble.setPosition(Math.round(x) - SEED_AT.x, Math.round(y) - SEED_AT.y);
  }

  private wait(ms: number, then: () => void): void {
    this.scene.time.delayedCall(ms * this.pace, then);
  }
}
