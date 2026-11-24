import Phaser from 'phaser';
import { CSS } from '../display/palette';
import { onKeyDown } from '../input/keys';
import { onPadAction } from '../input/gamepad';
import type { GameMode } from '../logic/types';
import { GAME_MODES, clearStats, loadStats, totalGames, type PlayerStats, type Tally } from '../stats';
import { OPPONENTS, OPPONENT_LABEL, SceneKeys, type MainMenuData, type Opponent } from '../types/scenes';
import { addButton, addText, createFocusFrame, frameAround, paintButton } from '../ui/widgets';

export type StatsChoice = 'back' | 'clear';
const CHOICES: readonly StatsChoice[] = ['back', 'clear'];

/** Button centres (base px), for playtests. */
export const STATS_LAYOUT = { y: 220, backX: 200, clearX: 290 } as const;

const MODE_LABEL: Record<GameMode, string> = { short: 'เกมสั้น', full: 'เกมเต็ม' };
const COL_X: Record<GameMode, number> = { short: 236, full: 380 };

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
  private buttons = new Map<StatsChoice, Phaser.GameObjects.Text>();
  private frame!: Phaser.GameObjects.Rectangle;
  private cells: Phaser.GameObjects.Text[] = [];
  private total!: Phaser.GameObjects.Text;
  private records: Phaser.GameObjects.Text[] = [];

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

    addText(this, width / 2, 22, 'สถิติ', 18, CSS.gold);
    for (const m of GAME_MODES) addText(this, COL_X[m], 46, MODE_LABEL[m], 11, CSS.gold);
    OPPONENTS.forEach((o, i) => {
      const y = 64 + i * 18;
      addText(this, 150, y, o === 'human' ? '2 คน' : `กับ ${OPPONENT_LABEL[o]}`, 10, CSS.cream).setOrigin(1, 0.5);
      for (const m of GAME_MODES) this.cells.push(addText(this, COL_X[m], y, '', 9, CSS.cream, false).setData('cell', [o, m]));
    });

    this.total = addText(this, width / 2, 134, '', 9, CSS.dim, false);
    this.records = [146, 162, 178].map((y) => addText(this, width / 2, y, '', 10, CSS.cream, false));
    addText(this, width / 2, 196, 'สถิติเก็บในเครื่องนี้ · นับเฉพาะคน ไม่นับ AI · ยอมแพ้นับเป็นแพ้', 8, CSS.dim, false);
    this.fill();

    this.buttons.set('back', addButton(this, STATS_LAYOUT.backX, STATS_LAYOUT.y, 'กลับ', { width: 70, onClick: () => this.choose('back'), onHover: () => this.setFocus('back') }));
    this.buttons.set('clear', addButton(this, STATS_LAYOUT.clearX, STATS_LAYOUT.y, 'ล้างสถิติ', { width: 100, onClick: () => this.choose('clear'), onHover: () => this.setFocus('clear') }));
    addText(this, width / 2, 254, '← → เลือก · Enter / จอย A ตกลง · Esc / จอย B กลับ', 9, CSS.dim, false);
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

  private fill(): void {
    const s = this.stats;
    for (const cell of this.cells) {
      const [o, m] = cell.getData('cell') as [Opponent, GameMode];
      cell.setText(tallyText(o, s.results[o][m]));
    }
    this.total.setText(`เล่นจบไปแล้ว ${totalGames(s)} เกม`);
    const n = (v: number, unit: string) => (v > 0 ? `${v} ${unit}` : '—');
    this.records[0].setText(`กินได้มากที่สุดในครั้งเดียว: ${n(s.bestCapture, 'เม็ด')}`);
    this.records[1].setText(`หว่านต่อยาวที่สุด: ${n(s.longestRelay, 'ทอด')}`);
    this.records[2].setText(`ชนะห่างมากที่สุด: ${n(s.biggestWin, 'เม็ด')}`);
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

  private setFocus(choice: StatsChoice): void {
    if (choice !== 'clear') this.confirmingClear = false;
    this.focus = choice;
    this.refresh();
  }

  private refresh(): void {
    const clear = this.buttons.get('clear');
    clear?.setText(this.confirmingClear ? 'กดอีกครั้งเพื่อล้าง' : 'ล้างสถิติ');
    for (const [choice, b] of this.buttons) paintButton(b, choice === this.focus);
    frameAround(this.frame, this.buttons.get(this.focus));
  }
}

function tallyText(opponent: Opponent, t: Tally): string {
  return opponent === 'human'
    ? `P1 ชนะ ${t.p1} · P2 ชนะ ${t.p2} · เสมอ ${t.draw}`
    : `ชนะ ${t.p1} · แพ้ ${t.p2} · เสมอ ${t.draw}`;
}
