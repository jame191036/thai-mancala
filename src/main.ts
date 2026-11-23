import Phaser from 'phaser';
import './style.css';
import { BootScene } from './scenes/BootScene';
import { PreloaderScene } from './scenes/PreloaderScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { GameOverScene } from './scenes/GameOverScene';
import { BASE_HEIGHT, BASE_WIDTH, computeIntegerScale } from './display/integerScale';

const CONTAINER_ID = 'game-container';

/** Integer zoom for the current container size (GDD §10: integer scale only). */
function currentZoom(): number {
  const el = document.getElementById(CONTAINER_ID);
  const w = el?.clientWidth || window.innerWidth;
  const h = el?.clientHeight || window.innerHeight;
  return computeIntegerScale(w, h, window.devicePixelRatio || 1, BASE_WIDTH, BASE_HEIGHT).zoom;
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: CONTAINER_ID,
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  backgroundColor: '#1E1A2B',
  pixelArt: true,
  roundPixels: true,
  scale: {
    // NONE + zoom instead of FIT: FIT scales by fractions and makes pixels uneven.
    // Centering is done by the flex container in style.css.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.NO_CENTER,
    zoom: currentZoom(),
  },
  scene: [BootScene, PreloaderScene, MainMenuScene, GameScene, GameOverScene],
};

const game = new Phaser.Game(config);

function applyIntegerZoom(): void {
  const zoom = currentZoom();
  if (game.scale.zoom !== zoom) game.scale.setZoom(zoom);
}
window.addEventListener('resize', applyIntegerZoom);
window.visualViewport?.addEventListener('resize', applyIntegerZoom);

// Exposes the game to the playtest harness. Present in dev and in playtest builds
// (VITE_PLAYTEST is set only by the harness); absent from the bundle you ship.
if (import.meta.env.DEV || import.meta.env.VITE_PLAYTEST === 'true') {
  (window as unknown as { __PHASER_GAME__: Phaser.Game }).__PHASER_GAME__ = game;
}
