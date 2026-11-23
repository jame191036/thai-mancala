import Phaser from 'phaser';
import { SceneKeys } from '../types/scenes';

/** Loads every asset with a progress bar, then shows the menu. */
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

    // The board is drawn with placeholder shapes for now (circles + numbers), so there is
    // nothing to load yet. Real pixel art goes in public/assets/ and loads here, e.g.:
    // this.load.atlas('board', 'assets/board.png', 'assets/board.json');
  }

  create(): void {
    this.scene.start(SceneKeys.MainMenu);
  }
}
