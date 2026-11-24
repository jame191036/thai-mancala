import Phaser from 'phaser';
import { FULL_GAME_ROUND_OPTIONS } from '../logic/rules';
import type { GameMode, Ruleset } from '../logic/types';
import { COLORS, CSS } from '../display/palette';
import { addPixelText, type PixelText, type PixelTextStyle } from '../display/pixelText';
import { onKeyDown } from '../input/keys';
import { onPadAction, type PadAction } from '../input/gamepad';
import { loadSavedGame } from '../save';
import {
  SOW_SPEEDS,
  SOW_SPEED_LABEL,
  loadFullGameRounds,
  loadGameMode,
  loadOpponent,
  loadRuleset,
  loadSowSpeed,
  saveFullGameRounds,
  saveGameMode,
  saveOpponent,
  saveRuleset,
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
import { Dropdown } from '../ui/dropdown';

/** Positions (base px). Playtests click these, so keep them in sync with playtest/*.mjs. */
export const MENU_LAYOUT = {
  titleY: 22,
  opponentY: 56,
  opponentX: [150, 220, 290, 360],
  /** Dropdowns: centre x and width (left edge lines up with the opponent buttons). */
  dropdownX: 218,
  dropdownW: 200,
  rulesetY: 86,
  summaryY: 106,
  lengthY: 128,
  speedY: 158,
  speedX: [148, 202, 256, 310, 364],
  startX: 240,
  startY: 192,
  /** ตั้งค่า / สถิติ / เครดิต (MENU_PAGES) */
  pagesX: [176, 240, 304],
  pagesY: 230,
  hintY: 256,
} as const;

/** Small option buttons (choice rows and the bottom row). */
const CHOICE_STYLE: PixelTextStyle = { size: 12, color: CSS.cream, background: CSS.woodDark, padding: { x: 3, y: 2 } };

type RowId = 'continue' | 'opponent' | 'ruleset' | 'length' | 'speed' | 'start' | 'pages';

/** "ความยาว": a short game, or a full game of 3, 5 or 7 rounds (R16). */
type Length = 'short' | FullGameRounds;
const LENGTHS: readonly Length[] = ['short', ...FULL_GAME_ROUND_OPTIONS];
const lengthLabel = (l: Length): string => (l === 'short' ? 'เกมสั้น · 1 รอบ' : `เกมเต็ม · ${l} รอบ`);

/**
 * One line of the menu for keyboard / gamepad focus.
 * - choice rows (opponent, speed): ← → change the value straight away.
 * - dropdown rows (ruleset, length): ← → change the value, confirm opens the list.
 * - button rows (start, continue, pages): ← → move between buttons, confirm presses one.
 */
interface MenuRow {
  id: RowId;
  items: PixelText[];
  /** choice rows: index of the item holding the current value */
  selected?: () => number;
  step?: (dir: 1 | -1) => void;
  activate?: (col: number) => void;
  dropdown?: Pick<Dropdown<unknown>, 'isOpen' | 'nav' | 'refresh'>;
}

/**
 * Placeholder menu.
 *   "▶ เล่นต่อ"   : only when a game is saved (src/save.ts)
 *   "เล่นกับ"     : 2 คน / AI ง่าย / AI กลาง / AI ยาก
 *   "กติกา"       : dropdown แบบดั้งเดิม (R1–R16) / แบบตามวิดีโอ (R17), its summary below
 *   "ความยาว"     : dropdown เกมสั้น 1 รอบ / เกมเต็ม 3, 5, 7 รอบ (R16)
 *   "ความเร็วหว่าน": ช้ามาก … เร็วมาก
 *   "เริ่มเกม"     : starts the chosen game (focused at first, so Enter / Space / A start)
 *   bottom row    : ตั้งค่า / สถิติ / เครดิต (MENU_PAGES)
 * Every choice is remembered (src/settings.ts). Shortcuts 1–4 still start a game directly.
 */
export class MainMenuScene extends Phaser.Scene {
  /** Choices for the next game (read by playtests). */
  opponent: Opponent = 'human';
  ruleset: Ruleset = 'traditional';
  mode: GameMode = 'short';
  rounds: FullGameRounds = 3;
  speed: SowSpeed = 1;
  /** A game in progress is saved and can be continued. */
  hasSave = false;
  /** Keyboard / gamepad focus. */
  focusRow: RowId = 'start';
  focusCol = 0;

  private rows: MenuRow[] = [];
  private summary!: PixelText;
  private focusFrame!: Phaser.GameObjects.Rectangle;

  constructor() {
    super(SceneKeys.MainMenu);
  }

  /** A dropdown list is open (read by playtests). */
  get dropdownOpen(): boolean {
    return this.rows.some((r) => r.dropdown?.isOpen);
  }

  create(data: MainMenuData = {}): void {
    const reg = this.registry;
    this.opponent = loadOpponent(reg);
    this.ruleset = loadRuleset(reg);
    this.mode = loadGameMode(reg);
    this.rounds = loadFullGameRounds(reg);
    this.speed = loadSowSpeed(reg);
    this.rows = [];
    this.focusRow = 'start';
    this.focusCol = 0;
    const L = MENU_LAYOUT;
    const { width } = this.scale;

    this.text(width / 2, L.titleY, 'หมากขุม', 30, CSS.gold);

    // ── Continue a saved game (only when one exists) ──
    const saved = loadSavedGame();
    this.hasSave = saved !== null;
    const resume = () => {
      if (saved) this.scene.start(SceneKeys.Game, { resume: saved });
    };
    if (saved) {
      const s = saved.state;
      const info = s.mode === 'full' ? `รอบ ${s.round}/${s.maxRounds}` : 'เกมสั้น';
      const b = addPixelText(this, 470, L.titleY, `▶ เล่นต่อ (${info})`, {
        size: 12,
        color: CSS.pitShadow,
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
    this.choiceRow('opponent', 'เล่นกับ:', L.opponentY, L.opponentX, 64, OPPONENTS, (o) => OPPONENT_LABEL[o], () => this.opponent, (o) => {
      this.opponent = o;
      saveOpponent(reg, o);
    });

    // ── Ruleset ──
    this.dropdownRow('ruleset', 'กติกา:', L.rulesetY, ['traditional', 'video'] as Ruleset[], (r) => RULESET_NAME[r], () => this.ruleset, (r) => {
      this.ruleset = r;
      saveRuleset(reg, r);
    });
    this.summary = addPixelText(this, L.dropdownX - L.dropdownW / 2 + 2, L.summaryY, '', { size: 12, color: CSS.gold }).setOrigin(0, 0.5);

    // ── Length ──
    this.dropdownRow('length', 'ความยาว:', L.lengthY, LENGTHS, lengthLabel, () => (this.mode === 'short' ? 'short' : this.rounds), (l) => {
      this.setMode(l === 'short' ? 'short' : 'full');
      if (l !== 'short') this.setRounds(l);
    });

    // ── Speed ──
    this.choiceRow('speed', 'ความเร็วหว่าน:', L.speedY, L.speedX, 50, SOW_SPEEDS, (s) => SOW_SPEED_LABEL[s], () => this.speed, (s) => {
      this.speed = s;
      saveSowSpeed(reg, s);
    });

    // ── Start ──
    const startBtn = addPixelText(this, L.startX, L.startY, 'เริ่มเกม', {
      size: 16,
      color: CSS.pitShadow,
      bold: true,
      background: CSS.gold,
      padding: { x: 8, y: 3 },
      fixedWidth: 160,
    })
      .setInteractive({ useHandCursor: true })
      .once('pointerdown', () => this.startChosen());
    this.rows.push({ id: 'start', items: [startBtn], activate: () => this.startChosen() });

    // ── Other screens ──
    const openPage = (i: number) => this.scene.start(MENU_PAGES[i].key);
    const pageButtons = MENU_PAGES.map((page, i) =>
      addPixelText(this, L.pagesX[i], L.pagesY, page.label, { ...CHOICE_STYLE, fixedWidth: 56 })
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

    this.text(width / 2, L.hintY, `↑ ↓ ← → เลือก · Enter / จอย A ตกลง · ปุ่มลัด 1–4${this.hasSave ? ' · C เล่นต่อ' : ''} · AI เล่นแถวบน`, 12, CSS.dim, false);

    // ── Keyboard & gamepad ──
    onKeyDown(this, 'UP', () => this.nav('up'));
    onKeyDown(this, 'DOWN', () => this.nav('down'));
    onKeyDown(this, 'LEFT', () => this.nav('left'));
    onKeyDown(this, 'RIGHT', () => this.nav('right'));
    onKeyDown(this, 'ENTER', () => this.nav('confirm'));
    onKeyDown(this, 'SPACE', () => this.nav('confirm'));
    onKeyDown(this, 'ESC', () => this.nav('cancel'));
    const kb = this.input.keyboard;
    kb?.once('keydown-ONE', () => this.start('traditional', 'short'));
    kb?.once('keydown-TWO', () => this.start('traditional', 'full'));
    kb?.once('keydown-THREE', () => this.start('video', 'short'));
    kb?.once('keydown-FOUR', () => this.start('video', 'full'));
    onPadAction(this, (action) => this.nav(action));
  }

  /** Start the game chosen on the menu ("เริ่มเกม"). */
  startChosen(): void {
    this.start(this.ruleset, this.mode);
  }

  private start(ruleset: Ruleset, mode: GameMode): void {
    const data: GameSceneData =
      mode === 'short'
        ? { mode: 'short', ruleset, opponent: this.opponent }
        : { mode: 'full', maxRounds: this.rounds, ruleset, opponent: this.opponent };
    this.scene.start(SceneKeys.Game, data);
  }

  /** Keyboard / gamepad navigation. */
  private nav(action: PadAction): void {
    const open = this.rows.find((r) => r.dropdown?.isOpen)?.dropdown;
    if (open) {
      open.nav(action);
      this.refreshAll();
      return;
    }
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
        if (row.step) {
          row.step(dir);
          this.refreshAll();
        } else this.setFocus(row.id, Math.max(0, Math.min(row.items.length - 1, this.focusCol + dir)));
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

  private setMode(mode: GameMode): void {
    this.mode = mode;
    saveGameMode(this.registry, mode);
  }

  private setRounds(rounds: FullGameRounds): void {
    this.rounds = rounds;
    saveFullGameRounds(this.registry, rounds);
  }

  private refreshAll(): void {
    for (const row of this.rows) {
      row.dropdown?.refresh();
      if (!row.selected) continue;
      const sel = row.selected();
      row.items.forEach((b, i) => b.restyle({ color: i === sel ? CSS.pitShadow : CSS.cream, background: i === sel ? CSS.gold : CSS.woodDark }));
    }
    this.summary?.setText(RULESET_SUMMARY[this.ruleset]);

    // Frame the focused item: the chosen value in a choice row, else the focused button.
    const row = this.rows.find((r) => r.id === this.focusRow);
    const item = row ? row.items[row.selected ? row.selected() : this.focusCol] : undefined;
    if (item && this.focusFrame) {
      const b = item.getBounds();
      this.focusFrame.setPosition(b.centerX, b.centerY).setSize(b.width + 4, b.height + 4);
      this.focusFrame.setVisible(true);
    }
  }

  private rowLabel(x: number, y: number, label: string): void {
    this.text(x, y, label, 12, CSS.dim).setOrigin(1, 0.5);
  }

  private dropdownRow<T>(id: RowId, label: string, y: number, values: readonly T[], labelOf: (v: T) => string, get: () => T, set: (v: T) => void): void {
    const L = MENU_LAYOUT;
    this.rowLabel(L.dropdownX - L.dropdownW / 2 - 6, y, label);
    const dd = new Dropdown<T>(this, {
      x: L.dropdownX,
      y,
      width: L.dropdownW,
      values,
      labelOf,
      get,
      // Like the choice rows, a mouse pick leaves the keyboard focus where it was, so
      // Enter / Space still start the game afterwards. While a list is open, nav() sends
      // the keys to it whichever row has the focus.
      set: (v) => {
        set(v);
        this.refreshAll();
      },
    });
    this.rows.push({ id, items: [dd.box], step: (dir) => dd.step(dir), activate: () => dd.open(), dropdown: dd });
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
    this.rowLabel(xs[0] - buttonWidth / 2 - 6, y, label);
    const items = values.map((v, i) => {
      const b = addPixelText(this, xs[i], y, labelOf(v), { ...CHOICE_STYLE, fixedWidth: buttonWidth }).setInteractive({ useHandCursor: true });
      // A mouse pick does not move the keyboard/gamepad focus (Enter still starts the game).
      b.on('pointerdown', () => {
        onPick(v);
        this.refreshAll();
      });
      return b;
    });
    const step = (dir: 1 | -1) => {
      const i = values.indexOf(current());
      onPick(values[Math.max(0, Math.min(values.length - 1, i + dir))]);
    };
    this.rows.push({ id, items, selected: () => values.indexOf(current()), step });
  }

  private text(x: number, y: number, s: string, size: number, color: string, bold = true): PixelText {
    return addPixelText(this, x, y, s, { size, color, bold });
  }
}
