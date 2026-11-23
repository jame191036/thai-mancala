import Phaser from 'phaser';
import { CSS, FONT, PLAYER_CSS } from '../display/palette';
import {
  RULESET_NAME,
  RULESET_SUMMARY,
  SceneKeys,
  playerNames,
  type GameOverData,
  type GameSceneData,
} from '../types/scenes';

/** Result screen: who won, the store totals, and why the game ended. */
export class GameOverScene extends Phaser.Scene {
  /** What was shown (read by playtests). */
  result!: GameOverData;

  constructor() {
    super(SceneKeys.GameOver);
  }

  create(data: GameOverData): void {
    this.result = data;
    const names = playerNames(data.opponent);
    const { width } = this.scale;
    const text = (y: number, s: string, size: number, color: string, bold = true) =>
      this.add
        .text(width / 2, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
        .setOrigin(0.5);

    const title = data.winner === null ? 'เสมอ!' : `${names[data.winner]} ชนะ!`;
    text(60, title, 32, data.winner === null ? CSS.gold : PLAYER_CSS[data.winner]);
    text(104, `${names[0]}  ${data.stores[0]} : ${data.stores[1]}  ${names[1]}`, 16, CSS.cream);
    text(132, reasonText(data, names), 11, CSS.dim, false);
    text(150, `${RULESET_NAME[data.ruleset]}: ${RULESET_SUMMARY[data.ruleset]}`, 10, CSS.dim, false);

    const rematch = () => {
      const again: GameSceneData = {
        mode: data.mode,
        maxRounds: data.maxRounds,
        ruleset: data.ruleset,
        opponent: data.opponent,
      };
      this.scene.start(SceneKeys.Game, again);
    };
    const toMenu = () => this.scene.start(SceneKeys.MainMenu);

    this.button(width / 2 - 70, 184, 'เล่นอีกครั้ง', rematch);
    this.button(width / 2 + 70, 184, 'เมนู', toMenu);
    text(232, 'SPACE = เล่นอีกครั้ง   ·   ESC = เมนู', 10, CSS.dim, false);

    const kb = this.input.keyboard;
    kb?.once('keydown-SPACE', rematch);
    kb?.once('keydown-ENTER', rematch);
    kb?.once('keydown-ESC', toMenu);
  }

  private button(x: number, y: number, label: string, onClick: () => void): void {
    this.add
      .text(x, y, label, {
        fontFamily: FONT,
        fontSize: '14px',
        color: CSS.cream,
        backgroundColor: CSS.woodDark,
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .once('pointerdown', onClick);
  }
}

function reasonText(d: GameOverData, names: readonly [string, string]): string {
  switch (d.reason) {
    case 'singleRound':
      return 'เกมสั้น 1 รอบ: นับเม็ดในเรือน';
    case 'roundLimit':
      return `เกมเต็ม ครบ ${d.maxRounds} รอบ: นับเม็ดในเรือน`;
    case 'cannotFill': {
      const loser = d.winner === null ? null : d.winner === 0 ? 1 : 0;
      return loser === null
        ? `จบรอบที่ ${d.round}: เหลือเม็ดไม่พอเติมหลุม`
        : `${names[loser]} เหลือเม็ดไม่พอเติมหลุม (จบรอบที่ ${d.round})`;
    }
  }
}
