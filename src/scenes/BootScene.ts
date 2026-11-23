import Phaser from 'phaser';
import { SceneKeys } from '../types/scenes';

/** Loads only what the loading screen itself needs, then hands off. Keep it tiny. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Boot);
  }

  create(): void {
    this.scene.start(SceneKeys.Preloader);
  }
}
