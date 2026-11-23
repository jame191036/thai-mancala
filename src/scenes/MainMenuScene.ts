import Phaser from 'phaser';
import { DEFAULT_FULL_GAME_ROUNDS } from '../logic/rules';
import type { Ruleset } from '../logic/types';
import { CSS, FONT } from '../display/palette';
import { onKeyDown } from '../input/keys';
import { SOW_SPEEDS, SOW_SPEED_LABEL, loadSowSpeed, saveSowSpeed, type SowSpeed } from '../settings';
import {
  OPPONENTS,
  OPPONENT_LABEL,
  RULESET_NAME,
  RULESET_SUMMARY,
  SceneKeys,
  type GameSceneData,
  type Opponent,
} from '../types/scenes';

/** Button centres (base px). Playtests click these, so keep them in sync with playtest/*.mjs. */
export const MENU_LAYOUT = {
  opponentY: 76,
  opponentX: [150, 220, 290, 360],
  shortX: 168,
  fullX: 312,
  rows: { traditional: 136, video: 194 },
  speedY: 222,
  speedX: [148, 202, 256, 310, 364],
} as const;

const OPPONENT_REGISTRY_KEY = 'opponent';

/**
 * Placeholder menu.
 *   "เล่นกับ"            : 2 คน / AI ง่าย / AI กลาง / AI ยาก (all visible, the chosen one gold)
 *   row "แบบดั้งเดิม"   : ruleset 'traditional' (R1–R16) — short / full start buttons
 *   row "แบบตามวิดีโอ" : ruleset 'video' (R17)          — short / full start buttons
 *   "ความเร็วหว่าน"     : ช้ามาก / ช้า / ปกติ / เร็ว / เร็วมาก (saved, see settings.ts)
 */
export class MainMenuScene extends Phaser.Scene {
  /** Who the next game is against (read by playtests). */
  opponent: Opponent = 'human';
  private opponentButtons: Phaser.GameObjects.Text[] = [];
  /** Sowing speed the next game will use (read by playtests). */
  speed: SowSpeed = 1;
  private speedButtons: Phaser.GameObjects.Text[] = [];

  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    this.opponent = (this.registry.get(OPPONENT_REGISTRY_KEY) as Opponent | undefined) ?? 'human';
    const { width } = this.scale;
    const text = (x: number, y: number, s: string, size: number, color: string, bold = true) =>
      this.add
        .text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
        .setOrigin(0.5);

    text(width / 2, 30, 'หมากขุม', 32, CSS.gold);

    // ── Opponent: every choice visible, the selected one highlighted ──
    text(MENU_LAYOUT.opponentX[0] - 58, MENU_LAYOUT.opponentY, 'เล่นกับ:', 11, CSS.dim);
    this.opponentButtons = OPPONENTS.map((opp, i) => {
      const b = this.add
        .text(MENU_LAYOUT.opponentX[i], MENU_LAYOUT.opponentY, OPPONENT_LABEL[opp], {
          fontFamily: FONT,
          fontSize: '11px',
          padding: { x: 4, y: 4 },
          fixedWidth: 64,
          align: 'center',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => this.setOpponent(opp));
      return b;
    });
    this.refreshOpponentButtons();

    // ── Start buttons: one per ruleset × length ──
    const start = (ruleset: Ruleset, length: 'short' | 'full') => {
      const data: GameSceneData =
        length === 'short'
          ? { mode: 'short', ruleset, opponent: this.opponent }
          : { mode: 'full', maxRounds: DEFAULT_FULL_GAME_ROUNDS, ruleset, opponent: this.opponent };
      this.scene.start(SceneKeys.Game, data);
    };

    for (const ruleset of ['traditional', 'video'] as const) {
      const y = MENU_LAYOUT.rows[ruleset];
      text(width / 2, y - 22, `${RULESET_NAME[ruleset]} · ${RULESET_SUMMARY[ruleset]}`, 11, CSS.gold);
      this.startButton(MENU_LAYOUT.shortX, y, 'เกมสั้น · 1 รอบ', () => start(ruleset, 'short'));
      this.startButton(MENU_LAYOUT.fullX, y, `เกมเต็ม · ${DEFAULT_FULL_GAME_ROUNDS} รอบ`, () => start(ruleset, 'full'));
    }

    // ── Sowing speed (also changeable in game: top-right button / F) ──
    this.speed = loadSowSpeed(this.registry);
    text(MENU_LAYOUT.speedX[0] - 64, MENU_LAYOUT.speedY, 'ความเร็วหว่าน:', 11, CSS.dim);
    this.speedButtons = SOW_SPEEDS.map((speed, i) => {
      const b = this.add
        .text(MENU_LAYOUT.speedX[i], MENU_LAYOUT.speedY, SOW_SPEED_LABEL[speed], {
          fontFamily: FONT,
          fontSize: '10px',
          padding: { x: 3, y: 3 },
          fixedWidth: 50,
          align: 'center',
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      b.on('pointerdown', () => this.setSpeed(speed));
      return b;
    });
    this.refreshSpeedButtons();

    text(width / 2, 250, '← → คู่แข่ง  ·  1 / 2 แบบดั้งเดิม  ·  3 / 4 แบบตามวิดีโอ  ·  SPACE เริ่มเกมสั้นแบบดั้งเดิม  ·  AI เล่นแถวบน', 8, CSS.dim, false);

    const kb = this.input.keyboard;
    kb?.once('keydown-SPACE', () => start('traditional', 'short'));
    kb?.once('keydown-ENTER', () => start('traditional', 'short'));
    kb?.once('keydown-ONE', () => start('traditional', 'short'));
    kb?.once('keydown-TWO', () => start('traditional', 'full'));
    kb?.once('keydown-THREE', () => start('video', 'short'));
    kb?.once('keydown-FOUR', () => start('video', 'full'));
    const step = (dir: 1 | -1) => {
      const i = OPPONENTS.indexOf(this.opponent);
      this.setOpponent(OPPONENTS[(i + dir + OPPONENTS.length) % OPPONENTS.length]);
    };
    onKeyDown(this, 'LEFT', () => step(-1));
    onKeyDown(this, 'RIGHT', () => step(1));
  }

  private setOpponent(opponent: Opponent): void {
    this.opponent = opponent;
    this.registry.set(OPPONENT_REGISTRY_KEY, opponent);
    this.refreshOpponentButtons();
  }

  private setSpeed(speed: SowSpeed): void {
    this.speed = speed;
    saveSowSpeed(this.registry, speed);
    this.refreshSpeedButtons();
  }

  private refreshSpeedButtons(): void {
    this.speedButtons.forEach((b, i) => {
      const selected = SOW_SPEEDS[i] === this.speed;
      b.setColor(selected ? CSS.pitShadow : CSS.cream).setBackgroundColor(selected ? CSS.gold : CSS.woodDark);
    });
  }

  private refreshOpponentButtons(): void {
    this.opponentButtons.forEach((b, i) => {
      const selected = OPPONENTS[i] === this.opponent;
      b.setColor(selected ? CSS.pitShadow : CSS.cream).setBackgroundColor(selected ? CSS.gold : CSS.woodDark);
    });
  }

  private startButton(x: number, y: number, label: string, onClick: () => void): void {
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
