import Phaser from 'phaser';
import { COLORS, CSS } from '../display/palette';
import { TEXT_SIZE, addPixelText, type PixelText } from '../display/pixelText';
import { onKeyDown } from '../input/keys';
import { onPadAction, onPadDisconnected } from '../input/gamepad';
import { SceneKeys, type PauseSceneData } from '../types/scenes';
import type { GameScene } from './GameScene';

export type PauseAction = 'resume' | 'restart' | 'resign' | 'menu';

const OPTIONS: readonly { action: PauseAction; label: string }[] = [
  { action: 'resume', label: 'เล่นต่อ' },
  { action: 'restart', label: 'เริ่มใหม่' },
  { action: 'resign', label: 'ยอมแพ้' },
  { action: 'menu', label: 'กลับเมนู (บันทึกเกมไว้)' },
];

/** Button centres (base px), for playtests. */
export const PAUSE_LAYOUT = { x: 240, firstY: 104, gapY: 30 } as const;

/**
 * Pause overlay launched on top of a paused GameScene (GDD §7: Resume | Restart | Resign |
 * Main Menu). While it is open the game scene is paused, so sowing tweens, timers and the
 * AI's move wait exactly where they were. Mouse, or ↑ ↓ + Enter; Esc / P resumes.
 */
export class PauseScene extends Phaser.Scene {
  /** Highlighted option (read by playtests). */
  focus = 0;
  /** Showing the "gamepad unplugged" notice (read by playtests). */
  padLost = false;
  private buttons: PixelText[] = [];
  private notice!: PixelText;

  constructor() {
    super(SceneKeys.Pause);
  }

  create(data: PauseSceneData = {}): void {
    this.focus = 0;
    const { width, height } = this.scale;
    this.add.rectangle(0, 0, width, height, COLORS.background, 0.75).setOrigin(0).setInteractive();
    this.add
      .rectangle(width / 2, 130, 220, 170, COLORS.woodDark)
      .setStrokeStyle(2, COLORS.gold);
    addPixelText(this, width / 2, 70, 'พักเกม', { size: 18, color: CSS.gold, bold: true });

    this.buttons = OPTIONS.map((opt, i) => {
      const b = addPixelText(this, PAUSE_LAYOUT.x, PAUSE_LAYOUT.firstY + i * PAUSE_LAYOUT.gapY, opt.label, {
        size: TEXT_SIZE,
        color: CSS.cream,
        background: CSS.pitShadow,
        padding: { x: 8, y: 0 },
        fixedWidth: 180,
      }).setInteractive({ useHandCursor: true });
      b.on('pointerover', () => this.setFocus(i));
      b.on('pointerdown', () => this.choose(opt.action));
      return b;
    });
    this.refresh();

    this.notice = addPixelText(this, width / 2, 232, 'จอยหลุด: เชื่อมต่อจอยใหม่ หรือเล่นต่อด้วยเมาส์ / คีย์บอร์ด / การแตะ', {
      size: TEXT_SIZE,
      color: CSS.cream,
      background: CSS.pitShadow,
      padding: { x: 6, y: 3 },
    });
    this.showPadLost(data.padLost === true);
    onPadDisconnected(this, () => this.showPadLost(true));

    onKeyDown(this, 'UP', () => this.setFocus((this.focus + OPTIONS.length - 1) % OPTIONS.length));
    onKeyDown(this, 'DOWN', () => this.setFocus((this.focus + 1) % OPTIONS.length));
    onKeyDown(this, 'ENTER', () => this.choose(OPTIONS[this.focus].action));
    onKeyDown(this, 'SPACE', () => this.choose(OPTIONS[this.focus].action));
    onKeyDown(this, 'ESC', () => this.choose('resume'));
    onKeyDown(this, 'P', () => this.choose('resume'));
    onPadAction(this, (action) => {
      if (action === 'up') this.setFocus((this.focus + OPTIONS.length - 1) % OPTIONS.length);
      else if (action === 'down') this.setFocus((this.focus + 1) % OPTIONS.length);
      else if (action === 'confirm') this.choose(OPTIONS[this.focus].action);
      else if (action === 'cancel' || action === 'pause') this.choose('resume');
    });
  }

  choose(action: PauseAction): void {
    const game = this.scene.get(SceneKeys.Game) as GameScene;
    switch (action) {
      case 'resume':
        game.resumeFromPause();
        break;
      case 'restart':
        game.restartGame();
        break;
      case 'resign':
        game.resign();
        break;
      case 'menu':
        game.quitToMenu();
        break;
    }
  }

  private showPadLost(on: boolean): void {
    this.padLost = on;
    this.notice.setVisible(on);
  }

  private setFocus(i: number): void {
    this.focus = i;
    this.refresh();
  }

  private refresh(): void {
    this.buttons.forEach((b, i) => {
      const on = i === this.focus;
      b.restyle({ color: on ? CSS.pitShadow : CSS.cream, background: on ? CSS.gold : CSS.pitShadow });
    });
  }
}
