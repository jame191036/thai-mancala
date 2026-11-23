import Phaser from 'phaser';
import { DEFAULT_FULL_GAME_ROUNDS } from '../logic/rules';
import type { Ruleset } from '../logic/types';
import { CSS, FONT } from '../display/palette';
import { RULESET_NAME, RULESET_SUMMARY, SceneKeys, type GameSceneData } from '../types/scenes';

/** Button centres (base px). Playtests click these, so keep them in sync with playtest/*.mjs. */
export const MENU_LAYOUT = {
  shortX: 168,
  fullX: 312,
  rows: { traditional: 136, video: 194 },
} as const;

/**
 * Placeholder menu: one start button per ruleset × length (local 2 players for now).
 *   row 1 "แบบดั้งเดิม"   (ruleset 'traditional', R1–R16)
 *   row 2 "แบบตามวิดีโอ" (ruleset 'video', R17)
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    const { width } = this.scale;
    const text = (y: number, s: string, size: number, color: string, bold = true) =>
      this.add
        .text(width / 2, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
        .setOrigin(0.5);

    text(36, 'หมากขุม', 36, CSS.gold);
    text(68, '2 คนเล่นเครื่องเดียว', 11, CSS.dim, false);

    const start = (ruleset: Ruleset, length: 'short' | 'full') => {
      const data: GameSceneData =
        length === 'short'
          ? { mode: 'short', ruleset }
          : { mode: 'full', maxRounds: DEFAULT_FULL_GAME_ROUNDS, ruleset };
      this.scene.start(SceneKeys.Game, data);
    };

    for (const ruleset of ['traditional', 'video'] as const) {
      const y = MENU_LAYOUT.rows[ruleset];
      text(y - 22, `${RULESET_NAME[ruleset]} · ${RULESET_SUMMARY[ruleset]}`, 11, CSS.gold);
      this.button(MENU_LAYOUT.shortX, y, 'เกมสั้น · 1 รอบ', () => start(ruleset, 'short'));
      this.button(MENU_LAYOUT.fullX, y, `เกมเต็ม · ${DEFAULT_FULL_GAME_ROUNDS} รอบ`, () => start(ruleset, 'full'));
    }

    text(240, '1 / 2 = แบบดั้งเดิม   ·   3 / 4 = แบบตามวิดีโอ   ·   SPACE = แบบดั้งเดิม เกมสั้น', 9, CSS.dim, false);

    const kb = this.input.keyboard;
    kb?.once('keydown-SPACE', () => start('traditional', 'short'));
    kb?.once('keydown-ENTER', () => start('traditional', 'short'));
    kb?.once('keydown-ONE', () => start('traditional', 'short'));
    kb?.once('keydown-TWO', () => start('traditional', 'full'));
    kb?.once('keydown-THREE', () => start('video', 'short'));
    kb?.once('keydown-FOUR', () => start('video', 'full'));
  }

  private button(x: number, y: number, label: string, onClick: () => void): void {
    this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '13px',
        color: CSS.cream,
        backgroundColor: CSS.woodDark,
        padding: { x: 8, y: 5 },
        fixedWidth: 128,
        align: 'center',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .once('pointerdown', onClick);
  }
}
