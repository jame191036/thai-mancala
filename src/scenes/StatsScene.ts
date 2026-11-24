import Phaser from 'phaser';
import { CSS } from '../display/palette';
import { addPixelText, digits, type PixelText } from '../display/pixelText';
import { onKeyDown } from '../input/keys';
import { onPadAction } from '../input/gamepad';
import type { GameMode } from '../logic/types';
import { GAME_MODES, clearStats, loadStats, totalGames, type PlayerStats, type Tally } from '../stats';
import { OPPONENTS, OPPONENT_LABEL, SceneKeys, type MainMenuData } from '../types/scenes';
import { TEXT_SIZE, addButton, addText, createFocusFrame, frameAround, paintButton } from '../ui/widgets';

export type StatsChoice = 'back' | 'clear';
const CHOICES: readonly StatsChoice[] = ['back', 'clear'];

/** Button centres (base px), for playtests. */
export const STATS_LAYOUT = { y: 232, backX: 190, clearX: 290 } as const;

const MODE_LABEL: Record<GameMode, string> = { short: 'เกมสั้น', full: 'เกมเต็ม' };
/** Centre of each mode's three number columns: P1 wins, P2 wins, draws. */
const MODE_X: Record<GameMode, number> = { short: 222, full: 384 };
const COL_GAP = 50;
const TALLY_KEYS: readonly (keyof Tally)[] = ['p1', 'p2', 'draw'];
const ROW_Y = [70, 87, 104, 121];

/**
 * Statistics (GDD §4 Scoring): results per opponent and game length, and the records set
 * by a person (the AI's moves never count). Clearing asks for a second press.
 */
export class StatsScene extends Phaser.Scene {
  /** What is shown (read by playtests). */
  stats!: PlayerStats;
  focus: StatsChoice = 'back';
  /** "ล้างสถิติ" was pressed once: the next press clears. */
  confirmingClear = false;
  private buttons = new Map<StatsChoice, PixelText>();
  private frame!: Phaser.GameObjects.Rectangle;
  private cells: { text: PixelText; opponent: (typeof OPPONENTS)[number]; mode: GameMode; key: keyof Tally }[] = [];
  private total!: PixelText;
  private records: PixelText[] = [];

  constructor() {
    super(SceneKeys.Stats);
  }

  create(): void {
    this.stats = loadStats();
    this.focus = 'back';
    this.confirmingClear = false;
    this.buttons.clear();
    this.cells = [];
    const { width } = this.scale;

    addText(this, width / 2, 12, 'สถิติ', 18, CSS.gold);
    for (const m of GAME_MODES) {
      addText(this, MODE_X[m], 34, MODE_LABEL[m], TEXT_SIZE, CSS.gold);
      ['P1 ชนะ', 'P2 ชนะ', 'เสมอ'].forEach((h, i) => addText(this, MODE_X[m] + (i - 1) * COL_GAP, 52, h, TEXT_SIZE, CSS.dim, false));
    }
    OPPONENTS.forEach((o, r) => {
      addText(this, 146, ROW_Y[r], o === 'human' ? '2 คน' : `กับ ${OPPONENT_LABEL[o]}`, TEXT_SIZE, CSS.cream).setOrigin(1, 0.5);
      for (const m of GAME_MODES) {
        TALLY_KEYS.forEach((key, i) => {
          this.cells.push({ text: addPixelText(this, MODE_X[m] + (i - 1) * COL_GAP, ROW_Y[r] + 2, '', digits(TEXT_SIZE, CSS.cream)), opponent: o, mode: m, key });
        });
      }
    });

    this.total = addText(this, width / 2, 140, '', TEXT_SIZE, CSS.dim, false);
    const spots = [[128, 164], [352, 164], [width / 2, 187]];
    this.records = spots.map(([x, y]) => addText(this, x, y, '', TEXT_SIZE, CSS.cream, false));
    addText(this, width / 2, 209, 'สถิติพิเศษนับเฉพาะคน ไม่นับ AI · ยอมแพ้นับเป็นแพ้', TEXT_SIZE, CSS.dim, false);
    this.fill();

    this.buttons.set('back', addButton(this, STATS_LAYOUT.backX, STATS_LAYOUT.y, 'กลับ', { width: 70, onClick: () => this.choose('back'), onHover: () => this.setFocus('back') }));
    this.buttons.set('clear', addButton(this, STATS_LAYOUT.clearX, STATS_LAYOUT.y, 'ล้างสถิติ', { width: 110, onClick: () => this.choose('clear'), onHover: () => this.setFocus('clear') }));
    addText(this, width / 2, 258, '← → เลือก · Enter / จอย A ตกลง · Esc / จอย B กลับ', TEXT_SIZE, CSS.dim, false);
    this.frame = createFocusFrame(this);
    this.refresh();

    const move = (dir: -1 | 1) => {
      const i = CHOICES.indexOf(this.focus);
      this.setFocus(CHOICES[Math.max(0, Math.min(CHOICES.length - 1, i + dir))]);
    };
    onKeyDown(this, 'LEFT', () => move(-1));
    onKeyDown(this, 'RIGHT', () => move(1));
    onKeyDown(this, 'ENTER', () => this.choose(this.focus));
    onKeyDown(this, 'SPACE', () => this.choose(this.focus));
    onKeyDown(this, 'ESC', () => this.choose('back'));
    onPadAction(this, (action) => {
      if (action === 'left') move(-1);
      else if (action === 'right') move(1);
      else if (action === 'confirm') this.choose(this.focus);
      else if (action === 'cancel') this.choose('back');
    });
  }

  choose(choice: StatsChoice): void {
    if (choice === 'back') {
      const data: MainMenuData = { fromPage: 1 };
      this.scene.start(SceneKeys.MainMenu, data);
      return;
    }
    if (!this.confirmingClear) {
      this.confirmingClear = true;
      this.refresh();
      return;
    }
    clearStats();
    this.stats = loadStats();
    this.confirmingClear = false;
    this.fill();
    this.refresh();
  }

  private fill(): void {
    const s = this.stats;
    for (const c of this.cells) c.text.setText(s.results[c.opponent][c.mode][c.key]);
    this.total.setText(`เล่นจบไปแล้ว ${totalGames(s)} เกม · เล่นกับ AI: P1 คือคุณ P2 คือ AI`);
    const n = (v: number, unit: string) => (v > 0 ? `${v} ${unit}` : '—');
    this.records[0].setText(`กินได้มากที่สุดในครั้งเดียว: ${n(s.bestCapture, 'เม็ด')}`);
    this.records[1].setText(`หว่านต่อยาวที่สุด: ${n(s.longestRelay, 'ทอด')}`);
    this.records[2].setText(`ชนะห่างมากที่สุด: ${n(s.biggestWin, 'เม็ด')}`);
  }

  private setFocus(choice: StatsChoice): void {
    if (choice !== 'clear') this.confirmingClear = false;
    this.focus = choice;
    this.refresh();
  }

  private refresh(): void {
    this.buttons.get('clear')?.setText(this.confirmingClear ? 'กดอีกครั้งเพื่อล้าง' : 'ล้างสถิติ');
    for (const [choice, b] of this.buttons) paintButton(b, choice === this.focus);
    frameAround(this.frame, this.buttons.get(this.focus));
  }
}
