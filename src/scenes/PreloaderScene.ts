import Phaser from 'phaser';
import { loadGameFont } from '../display/fonts';
import { HAND_FRAME, HAND_TEXTURE } from '../display/sowingHand';
import { SceneKeys } from '../types/scenes';

/** Loads every asset with a progress bar (and the game font), then shows the title screen. */
export class PreloaderScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Preloader);
  }

  preload(): void {
    const { width, height } = this.scale;
    const barWidth = width * 0.5;
    this.add.rectangle(width / 2, height / 2, barWidth + 4, 12).setStrokeStyle(1, 0xffffff);
    const bar = this.add.rectangle(width / 2 - barWidth / 2, height / 2, 0, 8, 0xffffff).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => {
      bar.width = barWidth * p;
    });

    // Pixel art, drawn by tools/art/ (GDD §8).
    this.load.image('bamboo', 'assets/bamboo.png');
    this.load.image('board', 'assets/board.png');
    this.load.spritesheet('seeds', 'assets/seeds.png', { frameWidth: 8, frameHeight: 8 });
    this.load.spritesheet(HAND_TEXTURE, 'assets/hand.png', { frameWidth: HAND_FRAME.width, frameHeight: HAND_FRAME.height });
  }

  create(): void {
    // Every text is drawn with the bundled font (GDD §10), so it must be ready first.
    // If it cannot load, text falls back to the system sans-serif rather than blocking.
    const next = () => this.scene.start(SceneKeys.Title);
    loadGameFont().then(next, (err: unknown) => {
      console.warn('Game font did not load; using the system font.', err);
      next();
    });
  }
}
