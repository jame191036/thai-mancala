import Phaser from 'phaser';
import { CSS, FONT, PLAYER_CSS } from '../display/palette';
import { onKeyDown } from '../input/keys';
import { onPadAction } from '../input/gamepad';
import {
  RULESET_NAME,
  RULESET_SUMMARY,
  SceneKeys,
  playerNames,
  type GameOverData,
  type GameSceneData,
} from '../types/scenes';

export type GameOverChoice = 'rematch' | 'menu';
const CHOICES: readonly GameOverChoice[] = ['rematch', 'menu'];

/** Button centres (base px), for playtests. */
export const GAME_OVER_LAYOUT = { y: 208, rematchX: 170, menuX: 310 } as const;

/**
 * Result screen: who won, the store totals, and why the game ended.
 * Mouse, or ← → + Enter / Space (focus starts on "play again"); Esc = menu.
 * Gamepad: d-pad / stick left-right, A = choose, B = menu.
 */
export class GameOverScene extends Phaser.Scene {
  /** What was shown (read by playtests). */
  result!: GameOverData;
  /** Focused button (read by playtests). */
  focus: GameOverChoice = 'rematch';
  private buttons = new Map<GameOverChoice, Phaser.GameObjects.Text>();
  private leaving = false;

  constructor() {
    super(SceneKeys.GameOver);
  }

  create(data: GameOverData): void {
    this.result = data;
    this.focus = 'rematch';
    this.leaving = false;
    this.buttons.clear();

    const names = playerNames(data.opponent);
    const { width } = this.scale;
    const text = (y: number, s: string, size: number, color: string, bold = true) =>
      this.add
        .text(width / 2, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
        .setOrigin(0.5);

    const title = data.winner === null ? 'เสมอ!' : `${names[data.winner]} ชนะ!`;
    text(60, title, 32, data.winner === null ? CSS.gold : PLAYER_CSS[data.winner]);
    text(104, `${names[0]}  ${data.stores[0]} : ${data.stores[1]}  ${names[1]}`, 16, CSS.cream);
    text(130, reasonText(data, names), 11, CSS.dim, false);
    text(146, `${RULESET_NAME[data.ruleset]}: ${RULESET_SUMMARY[data.ruleset]}`, 10, CSS.dim, false);

    // This game's records (GDD §7 Result). The video rules have no relays (R17).
    const r = data.records;
    text(166, `กินมากสุดในครั้งเดียว   ${names[0]}: ${r.maxCapture[0]} เม็ด  ·  ${names[1]}: ${r.maxCapture[1]} เม็ด`, 10, CSS.cream, false);
    if (data.ruleset === 'traditional') {
      text(180, `หว่านต่อยาวสุด   ${names[0]}: ${r.maxRelay[0]} ทอด  ·  ${names[1]}: ${r.maxRelay[1]} ทอด`, 10, CSS.cream, false);
    }

    this.button('rematch', GAME_OVER_LAYOUT.rematchX, 'เล่นอีกครั้ง');
    this.button('menu', GAME_OVER_LAYOUT.menuX, 'เมนู');
    this.refresh();
    text(244, '← → เลือก  ·  ENTER / จอย A ตกลง  ·  ESC / จอย B = เมนู', 10, CSS.dim, false);

    const move = (dir: -1 | 1) => {
      const i = CHOICES.indexOf(this.focus);
      this.setFocus(CHOICES[Math.max(0, Math.min(CHOICES.length - 1, i + dir))]);
    };
    onKeyDown(this, 'LEFT', () => move(-1));
    onKeyDown(this, 'RIGHT', () => move(1));
    onKeyDown(this, 'ENTER', () => this.choose(this.focus));
    onKeyDown(this, 'SPACE', () => this.choose(this.focus));
    onKeyDown(this, 'ESC', () => this.choose('menu'));
    onPadAction(this, (action) => {
      if (action === 'left') move(-1);
      else if (action === 'right') move(1);
      else if (action === 'confirm') this.choose(this.focus);
      else if (action === 'cancel') this.choose('menu');
    });
  }

  choose(choice: GameOverChoice): void {
    if (this.leaving) return;
    this.leaving = true;
    const data = this.result;
    if (choice === 'rematch') {
      const again: GameSceneData = {
        mode: data.mode,
        maxRounds: data.maxRounds,
        ruleset: data.ruleset,
        opponent: data.opponent,
      };
      this.scene.start(SceneKeys.Game, again);
    } else {
      this.scene.start(SceneKeys.MainMenu);
    }
  }

  private button(choice: GameOverChoice, x: number, label: string): void {
    const b = this.add
      .text(x, GAME_OVER_LAYOUT.y, label, {
        fontFamily: FONT,
        fontSize: '14px',
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    b.on('pointerover', () => this.setFocus(choice));
    b.on('pointerdown', () => this.choose(choice));
    this.buttons.set(choice, b);
  }

  private setFocus(choice: GameOverChoice): void {
    this.focus = choice;
    this.refresh();
  }

  private refresh(): void {
    for (const [choice, b] of this.buttons) {
      const on = choice === this.focus;
      b.setColor(on ? CSS.pitShadow : CSS.cream).setBackgroundColor(on ? CSS.gold : CSS.woodDark);
    }
  }
}

function reasonText(d: GameOverData, names: readonly [string, string]): string {
  switch (d.reason) {
    case 'resigned': {
      const loser = d.winner === 0 ? 1 : 0;
      return `${names[loser]} ยอมแพ้`;
    }
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
