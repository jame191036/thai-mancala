import Phaser from 'phaser';
import { FULL_GAME_ROUND_OPTIONS } from '../logic/rules';
import type { Ruleset } from '../logic/types';
import { COLORS, CSS } from '../display/palette';
import { addPixelText, type PixelText, type PixelTextStyle } from '../display/pixelText';
import { onKeyDown } from '../input/keys';
import { onPadAction, type PadAction } from '../input/gamepad';
import { loadSavedGame } from '../save';
import {
  SOW_SPEEDS,
  SOW_SPEED_LABEL,
  loadFullGameRounds,
  loadSowSpeed,
  saveFullGameRounds,
  saveSowSpeed,
  type FullGameRounds,
  type SowSpeed,
} from '../settings';
import {
  MENU_PAGES,
  OPPONENTS,
  OPPONENT_LABEL,
  RULESET_NAME,
  RULESET_SUMMARY,
  SceneKeys,
  type GameSceneData,
  type MainMenuData,
  type Opponent,
} from '../types/scenes';

/** Button centres (base px). Playtests click these, so keep them in sync with playtest/*.mjs. */
export const MENU_LAYOUT = {
  opponentY: 58,
  opponentX: [150, 220, 290, 360],
  shortX: 168,
  fullX: 312,
  rows: { traditional: 104, video: 154 },
  roundsY: 184,
  roundsX: [148, 202, 256],
  speedY: 208,
  speedX: [148, 202, 256, 310, 364],
  /** ตั้งค่า / สถิติ / เครดิต (MENU_PAGES) */
  pagesY: 233,
  pagesX: [176, 240, 304],
} as const;

const OPPONENT_REGISTRY_KEY = 'opponent';

/** Small option buttons (choice rows and the bottom row). */
const CHOICE_STYLE: PixelTextStyle = { size: 12, color: CSS.cream, background: CSS.woodDark, padding: { x: 3, y: 2 } };

type RowId = 'continue' | 'opponent' | 'traditional' | 'video' | 'rounds' | 'speed' | 'pages';

/**
 * One line of the menu for keyboard / gamepad focus.
 * - `choice` rows (opponent, rounds, speed): ← → change the value straight away.
 * - `buttons` rows (start buttons, continue): ← → move between buttons, confirm presses one.
 */
interface MenuRow {
  id: RowId;
  items: PixelText[];
  /** choice rows: index of the item holding the current value */
  selected?: () => number;
  step?: (dir: 1 | -1) => void;
  /** buttons rows */
  activate?: (col: number) => void;
}

/**
 * Placeholder menu.
 *   "▶ เล่นต่อ"          : only when a game is saved (src/save.ts)
 *   "เล่นกับ"            : 2 คน / AI ง่าย / AI กลาง / AI ยาก
 *   row "แบบดั้งเดิม"   : ruleset 'traditional' (R1–R16) — short / full start buttons
 *   row "แบบตามวิดีโอ" : ruleset 'video' (R17)          — short / full start buttons
 *   "เกมเต็มกี่รอบ"     : 3 / 5 / 7 (R16, saved)
 *   "ความเร็วหว่าน"     : ช้ามาก / ช้า / ปกติ / เร็ว / เร็วมาก (saved)
 *   bottom row          : ตั้งค่า / สถิติ / เครดิต (MENU_PAGES)
 * Mouse, keyboard (↑ ↓ ← → Enter, shortcuts 1–4 and C) and gamepad all work.
 */
export class MainMenuScene extends Phaser.Scene {
  /** Choices for the next game (read by playtests). */
  opponent: Opponent = 'human';
  rounds: FullGameRounds = 3;
  speed: SowSpeed = 1;
  /** A game in progress is saved and can be continued. */
  hasSave = false;
  /** Keyboard / gamepad focus. */
  focusRow: RowId = 'traditional';
  focusCol = 0;

  private rows: MenuRow[] = [];
  private fullButtons: PixelText[] = [];
  private focusFrame!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(data: MainMenuData = {}): void {
    this.opponent = (this.registry.get(OPPONENT_REGISTRY_KEY) as Opponent | undefined) ?? 'human';
    this.rounds = loadFullGameRounds(this.registry);
    this.speed = loadSowSpeed(this.registry);
    this.rows = [];
    this.fullButtons = [];
    this.focusRow = 'traditional';
    this.focusCol = 0;
    const { width } = this.scale;

    this.text(width / 2, 22, 'หมากขุม', 30, CSS.gold);

    // ── Continue a saved game (only when one exists) ──
    const saved = loadSavedGame();
    this.hasSave = saved !== null;
    const resume = () => {
      if (saved) this.scene.start(SceneKeys.Game, { resume: saved });
    };
    if (saved) {
      const s = saved.state;
      const info = s.mode === 'full' ? `รอบ ${s.round}/${s.maxRounds}` : 'เกมสั้น';
      const b = addPixelText(this, 470, 22, `▶ เล่นต่อ (${info})`, {
        size: 12,
        color: CSS.pitShadow,
        bold: true,
        background: CSS.gold,
        padding: { x: 6, y: 3 },
      })
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true })
        .once('pointerdown', resume);
      this.rows.push({ id: 'continue', items: [b], activate: resume });
      this.input.keyboard?.once('keydown-C', resume);
    }

    // ── Opponent ──
    this.choiceRow('opponent', 'เล่นกับ:', MENU_LAYOUT.opponentY, MENU_LAYOUT.opponentX, 64, OPPONENTS, (o) => OPPONENT_LABEL[o], () => this.opponent, (o) => this.setOpponent(o));

    // ── Start buttons: one per ruleset × length ──
    const start = (ruleset: Ruleset, length: 'short' | 'full') => {
      const data: GameSceneData =
        length === 'short'
          ? { mode: 'short', ruleset, opponent: this.opponent }
          : { mode: 'full', maxRounds: this.rounds, ruleset, opponent: this.opponent };
      this.scene.start(SceneKeys.Game, data);
    };
    for (const ruleset of ['traditional', 'video'] as const) {
      const y = MENU_LAYOUT.rows[ruleset];
      this.text(width / 2, y - 25, `${RULESET_NAME[ruleset]} · ${RULESET_SUMMARY[ruleset]}`, 12, CSS.gold);
      const shortBtn = this.startButton(MENU_LAYOUT.shortX, y, 'เกมสั้น · 1 รอบ', () => start(ruleset, 'short'));
      const fullBtn = this.startButton(MENU_LAYOUT.fullX, y, '', () => start(ruleset, 'full'));
      this.fullButtons.push(fullBtn);
      this.rows.push({ id: ruleset, items: [shortBtn, fullBtn], activate: (col) => start(ruleset, col === 0 ? 'short' : 'full') });
    }

    // ── Settings rows ──
    this.choiceRow('rounds', 'เกมเต็มกี่รอบ:', MENU_LAYOUT.roundsY, MENU_LAYOUT.roundsX, 50, FULL_GAME_ROUND_OPTIONS, (n) => `${n} รอบ`, () => this.rounds, (n) => this.setRounds(n));
    this.choiceRow('speed', 'ความเร็วหว่าน:', MENU_LAYOUT.speedY, MENU_LAYOUT.speedX, 50, SOW_SPEEDS, (s) => SOW_SPEED_LABEL[s], () => this.speed, (s) => this.setSpeed(s));

    // ── Other screens ──
    const openPage = (i: number) => this.scene.start(MENU_PAGES[i].key);
    const pageButtons = MENU_PAGES.map((page, i) =>
      addPixelText(this, MENU_LAYOUT.pagesX[i], MENU_LAYOUT.pagesY, page.label, { ...CHOICE_STYLE, fixedWidth: 56 })
        .setInteractive({ useHandCursor: true })
        .once('pointerdown', () => openPage(i)),
    );
    this.rows.push({ id: 'pages', items: pageButtons, activate: openPage });
    if (data.fromPage !== undefined) {
      this.focusRow = 'pages';
      this.focusCol = Math.max(0, Math.min(MENU_PAGES.length - 1, data.fromPage));
    }

    this.focusFrame = this.add.rectangle(0, 0, 10, 10).setStrokeStyle(2, COLORS.cream).setDepth(5);
    this.refreshAll();

    this.text(width / 2, 258, `↑ ↓ ← → เลือก · Enter / จอย A เริ่ม · ปุ่มลัด 1–4${this.hasSave ? ' · C เล่นต่อ' : ''} · AI เล่นแถวบน`, 12, CSS.dim, false);

    // ── Keyboard & gamepad ──
    onKeyDown(this, 'UP', () => this.nav('up'));
    onKeyDown(this, 'DOWN', () => this.nav('down'));
    onKeyDown(this, 'LEFT', () => this.nav('left'));
    onKeyDown(this, 'RIGHT', () => this.nav('right'));
    onKeyDown(this, 'ENTER', () => this.nav('confirm'));
    onKeyDown(this, 'SPACE', () => this.nav('confirm'));
    const kb = this.input.keyboard;
    kb?.once('keydown-ONE', () => start('traditional', 'short'));
    kb?.once('keydown-TWO', () => start('traditional', 'full'));
    kb?.once('keydown-THREE', () => start('video', 'short'));
    kb?.once('keydown-FOUR', () => start('video', 'full'));
    onPadAction(this, (action) => this.nav(action));
  }

  /** Keyboard / gamepad navigation. */
  private nav(action: PadAction): void {
    const r = this.rows.findIndex((row) => row.id === this.focusRow);
    const row = this.rows[r];
    switch (action) {
      case 'up':
      case 'down': {
        const next = this.rows[Math.max(0, Math.min(this.rows.length - 1, r + (action === 'up' ? -1 : 1)))];
        this.setFocus(next.id, next.id === row.id ? this.focusCol : 0);
        break;
      }
      case 'left':
      case 'right': {
        const dir = action === 'left' ? -1 : 1;
        if (row.step) row.step(dir);
        else this.setFocus(row.id, Math.max(0, Math.min(row.items.length - 1, this.focusCol + dir)));
        break;
      }
      case 'confirm':
        row.activate?.(this.focusCol);
        break;
      default:
        break;
    }
  }

  private setFocus(row: RowId, col: number): void {
    this.focusRow = row;
    this.focusCol = col;
    this.refreshAll();
  }

  private setOpponent(opponent: Opponent): void {
    this.opponent = opponent;
    this.registry.set(OPPONENT_REGISTRY_KEY, opponent);
    this.refreshAll();
  }

  private setRounds(rounds: FullGameRounds): void {
    this.rounds = rounds;
    saveFullGameRounds(this.registry, rounds);
    this.refreshAll();
  }

  private setSpeed(speed: SowSpeed): void {
    this.speed = speed;
    saveSowSpeed(this.registry, speed);
    this.refreshAll();
  }

  private refreshAll(): void {
    for (const row of this.rows) {
      if (!row.selected) continue;
      const sel = row.selected();
      row.items.forEach((b, i) => b.restyle({ color: i === sel ? CSS.pitShadow : CSS.cream, background: i === sel ? CSS.gold : CSS.woodDark }));
    }
    for (const b of this.fullButtons) b.setText(`เกมเต็ม · ${this.rounds} รอบ`);

    // Frame the focused item: the chosen value in a choice row, else the focused button.
    const row = this.rows.find((r) => r.id === this.focusRow);
    const item = row ? row.items[row.selected ? row.selected() : this.focusCol] : undefined;
    if (item && this.focusFrame) {
      const b = item.getBounds();
      this.focusFrame.setPosition(b.centerX, b.centerY).setSize(b.width + 4, b.height + 4);
      this.focusFrame.setVisible(true);
    }
  }

  private choiceRow<T>(
    id: RowId,
    label: string,
    y: number,
    xs: readonly number[],
    buttonWidth: number,
    values: readonly T[],
    labelOf: (v: T) => string,
    current: () => T,
    onPick: (v: T) => void,
  ): void {
    // Right-aligned just left of the first button, so long labels never overlap it.
    this.text(xs[0] - buttonWidth / 2 - 6, y, label, 12, CSS.dim).setOrigin(1, 0.5);
    const items = values.map((v, i) => {
      const b = addPixelText(this, xs[i], y, labelOf(v), { ...CHOICE_STYLE, fixedWidth: buttonWidth }).setInteractive({ useHandCursor: true });
      // A mouse pick does not move the keyboard/gamepad focus (Space still starts the
      // focused game afterwards).
      b.on('pointerdown', () => onPick(v));
      return b;
    });
    const step = (dir: 1 | -1) => {
      const i = values.indexOf(current());
      onPick(values[Math.max(0, Math.min(values.length - 1, i + dir))]);
    };
    this.rows.push({ id, items, selected: () => values.indexOf(current()), step });
  }

  private startButton(x: number, y: number, label: string, onClick: () => void): PixelText {
    return addPixelText(this, x, y, label, {
      size: 13,
      color: CSS.cream,
      bold: true,
      background: CSS.woodDark,
      padding: { x: 8, y: 4 },
      fixedWidth: 128,
    })
      .setInteractive({ useHandCursor: true })
      .once('pointerdown', onClick);
  }

  private text(x: number, y: number, s: string, size: number, color: string, bold = true): PixelText {
    return addPixelText(this, x, y, s, { size, color, bold });
  }
}
