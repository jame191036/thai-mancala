import Phaser from 'phaser';
import { COLORS, CSS } from '../display/palette';
import { REDUCED_MOTION, loadFlag } from '../settings';
import { SceneKeys } from '../types/scenes';
import { addText } from '../ui/widgets';

/** Mini row drawn under the logo: 7 pits and a store (base px). */
const PIT_XS = [150, 180, 210, 240, 270, 300, 330];
const STORE_X = 368;
const ROW_Y = 168;

/**
 * Title (GDD §7): logo, a seed hopping along a row of pits, and "press anything".
 * The first input also matters technically: browsers only report a gamepad after one of
 * its buttons is pressed, and mobile browsers only allow sound after a tap.
 * Placeholder graphics; the attract-mode board comes with the art pass.
 */
export class TitleScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super(SceneKeys.Title);
  }

  create(): void {
    this.leaving = false;
    const { width } = this.scale;
    const still = loadFlag(this.registry, REDUCED_MOTION);

    addText(this, width / 2, 78, 'หมากขุม', 44, CSS.gold);
    addText(this, width / 2, 116, 'การละเล่นพื้นบ้านไทย · 2 คน หรือเล่นกับ AI', 12, CSS.cream, false);

    for (const x of PIT_XS) this.add.circle(x, ROW_Y, 9, COLORS.pitShadow).setStrokeStyle(1, COLORS.woodLight);
    this.add.rectangle(STORE_X, ROW_Y, 22, 30, COLORS.pitShadow).setStrokeStyle(2, COLORS.p1);
    const seed = this.add.circle(PIT_XS[0], ROW_Y, 3, COLORS.seedLight).setStrokeStyle(1, COLORS.gold);
    if (!still) this.hopSeeds(seed);

    const prompt = addText(this, width / 2, 222, 'แตะ / คลิก / กดปุ่มใดก็ได้เพื่อเริ่ม', 12, CSS.cream);
    if (!still) this.tweens.add({ targets: prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    // Any pointer, key or gamepad button. A pad that only now becomes visible to the
    // browser reports "connected" rather than a button press, so that counts too.
    this.input.once('pointerdown', () => this.start());
    this.input.keyboard?.once('keydown', () => this.start());
    this.input.gamepad?.once('down', () => this.start());
    this.input.gamepad?.once('connected', () => this.start());
  }

  /** Go to the main menu (also called by playtests). */
  start(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.scene.start(SceneKeys.MainMenu);
  }

  /** A seed hops from pit to pit into the store, again and again. */
  private hopSeeds(seed: Phaser.GameObjects.Arc): void {
    const stops = [...PIT_XS, STORE_X];
    let at = 0;
    this.time.addEvent({
      delay: 420,
      loop: true,
      callback: () => {
        at = (at + 1) % stops.length;
        if (at === 0) {
          seed.setPosition(stops[0], ROW_Y);
          return;
        }
        this.tweens.add({ targets: seed, x: stops[at], duration: 300, ease: 'Sine.InOut' });
        this.tweens.add({ targets: seed, y: ROW_Y - 10, duration: 150, yoyo: true, ease: 'Quad.Out' });
      },
    });
  }
}
