import Phaser from 'phaser';
import { CSS } from '../display/palette';
import { TitleDemo } from '../display/titleDemo';
import { REDUCED_MOTION, loadFlag } from '../settings';
import { SceneKeys } from '../types/scenes';
import { TEXT_SIZE, addBackground, addLogo, addText } from '../ui/widgets';

/**
 * Title (GDD §7): logo, a board playing by itself, and "press anything".
 * The first input also matters technically: browsers only report a gamepad after one of
 * its buttons is pressed, and mobile browsers only allow sound after a tap.
 */
export class TitleScene extends Phaser.Scene {
  /** The board that plays by itself (read by playtests). */
  demo!: TitleDemo;
  private leaving = false;

  constructor() {
    super(SceneKeys.Title);
  }

  create(): void {
    this.leaving = false;
    const { width } = this.scale;
    const still = loadFlag(this.registry, REDUCED_MOTION);

    addBackground(this, 'bg-yard');
    addLogo(this, 'logo', 26);
    addText(this, width / 2, 108, 'การละเล่นพื้นบ้านไทย · 2 คน หรือเล่นกับ AI', TEXT_SIZE, CSS.cream, false);

    this.demo = new TitleDemo(this, still);

    const prompt = addText(this, width / 2, 152, 'แตะ / คลิก / กดปุ่มใดก็ได้เพื่อเริ่ม', TEXT_SIZE, CSS.cream);
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
}
