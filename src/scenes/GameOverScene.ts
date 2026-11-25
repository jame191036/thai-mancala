import Phaser from 'phaser';
import { CSS, PLAYER_CSS } from '../display/palette';
import { TEXT_SIZE, addPixelText, type PixelText } from '../display/pixelText';
import { Portrait } from '../display/portrait';
import { addBackground } from '../ui/widgets';
import { onKeyDown } from '../input/keys';
import { onPadAction } from '../input/gamepad';
import { REDUCED_MOTION, loadFlag } from '../settings';
import {
  AI_PLAYER,
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
export const GAME_OVER_LAYOUT = { y: 214, rematchX: 170, menuX: 310 } as const;

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
  /** The AI's face and last words (none between two people; read by playtests). */
  portrait: Portrait | null = null;
  private buttons = new Map<GameOverChoice, PixelText>();
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
      addPixelText(this, width / 2, y, s, { size, color, bold });

    addBackground(this, 'bg-night');
    const title = data.winner === null ? 'เสมอ!' : `${names[data.winner]} ชนะ!`;
    text(32, title, 32, data.winner === null ? CSS.gold : PLAYER_CSS[data.winner]);
    text(80, `${names[0]}  ${data.stores[0]} : ${data.stores[1]}  ${names[1]}`, 16, CSS.cream);
    text(110, reasonText(data, names), TEXT_SIZE, CSS.dim, false);
    text(135, `${RULESET_NAME[data.ruleset]}: ${RULESET_SUMMARY[data.ruleset]}`, TEXT_SIZE, CSS.dim, false);

    this.portrait = null;
    if (data.opponent !== 'human') {
      this.portrait = new Portrait(this, data.opponent, { x: 16, y: 10, bubble: { x: 18, y: 58 }, still: loadFlag(this.registry, REDUCED_MOTION) });
      this.portrait.say(data.winner === null ? 'draw' : data.winner === AI_PLAYER ? 'win' : 'lose');
    }

    // This game's records (GDD §7 Result). The video rules have no relays (R17).
    const r = data.records;
    text(160, `กินมากสุดในครั้งเดียว   ${names[0]}: ${r.maxCapture[0]} เม็ด  ·  ${names[1]}: ${r.maxCapture[1]} เม็ด`, TEXT_SIZE, CSS.cream, false);
    if (data.ruleset === 'traditional') {
      text(183, `หว่านต่อยาวสุด   ${names[0]}: ${r.maxRelay[0]} ทอด  ·  ${names[1]}: ${r.maxRelay[1]} ทอด`, TEXT_SIZE, CSS.cream, false);
    }

    this.button('rematch', GAME_OVER_LAYOUT.rematchX, 'เล่นอีกครั้ง');
    this.button('menu', GAME_OVER_LAYOUT.menuX, 'เมนู');
    this.refresh();
    text(250, '← → เลือก  ·  Enter / จอย A ตกลง  ·  Esc / จอย B = เมนู', TEXT_SIZE, CSS.dim, false);

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
    const b = addPixelText(this, x, GAME_OVER_LAYOUT.y, label, {
      size: 14,
      color: CSS.cream,
      bold: true,
      background: CSS.woodDark,
      padding: { x: 12, y: 1 },
    }).setInteractive({ useHandCursor: true });
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
      b.restyle({ color: on ? CSS.pitShadow : CSS.cream, background: on ? CSS.gold : CSS.woodDark });
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
