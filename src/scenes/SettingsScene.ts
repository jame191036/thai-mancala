import Phaser from 'phaser';
import { CSS } from '../display/palette';
import { onKeyDown } from '../input/keys';
import { onPadAction, type PadAction } from '../input/gamepad';
import {
  BOARD_STYLES,
  BOARD_STYLE_LABEL,
  FACING,
  REDUCED_MOTION,
  VIBRATION,
  loadBoardStyle,
  loadFlag,
  loadTouchConfirm,
  saveBoardStyle,
  saveFlag,
  saveTouchConfirm,
  type Flag,
} from '../settings';
import { SceneKeys, type MainMenuData } from '../types/scenes';
import type { PixelText } from '../display/pixelText';
import { addButton, addText, createFocusFrame, frameAround, paintButton } from '../ui/widgets';

export type SettingId = 'touch' | 'motion' | 'vibration' | 'facing' | 'style';

interface SettingRow {
  id: SettingId;
  label: string;
  /** Shown at the bottom while the row has focus. */
  help: string;
  options: readonly string[];
  /** Which option holds now. */
  get: () => number;
  set: (option: number) => void;
  items: PixelText[];
}

/** Positions (base px), for playtests. Row i is at y = firstY + i * gapY; "กลับ" last. */
export const SETTINGS_LAYOUT = {
  /** Button centres and width for a row of two options, and of three. */
  optionX: { 2: [282, 384], 3: [265, 333, 401] },
  optionW: { 2: 96, 3: 62 },
  labelX: 226,
  firstY: 46,
  gapY: 26,
  backY: 186,
} as const;

/**
 * Settings (GDD §7) that exist so far. Sowing speed and round count stay on the main menu
 * where they were; sound arrives with the audio pass.
 * Every change is saved at once (src/settings.ts) and read by the next game.
 * Mouse, or ↑ ↓ + ← → / Enter; Esc / gamepad B goes back.
 */
export class SettingsScene extends Phaser.Scene {
  /** Focused row; rows.length = the "กลับ" button (read by playtests). */
  focus = 0;
  private rows: SettingRow[] = [];
  private back!: PixelText;
  private frame!: Phaser.GameObjects.Rectangle;
  private help!: PixelText;

  constructor() {
    super(SceneKeys.Settings);
  }

  /** Current values (read by playtests). */
  values(): Record<SettingId, string> {
    const out = {} as Record<SettingId, string>;
    for (const r of this.rows) out[r.id] = r.options[r.get()];
    return out;
  }

  create(): void {
    this.focus = 0;
    const { width } = this.scale;
    const reg = this.registry;
    const flagRow = (id: SettingId, label: string, help: string, flag: Flag, onFirst: boolean): Omit<SettingRow, 'items'> => ({
      id,
      label,
      help,
      // `onFirst`: the first option means "on".
      options: onFirst ? ['เปิด', 'ปิด'] : ['ปิด', 'เปิด'],
      get: () => (loadFlag(reg, flag) === onFirst ? 0 : 1),
      set: (o) => saveFlag(reg, flag, (o === 0) === onFirst),
    });

    const defs: Omit<SettingRow, 'items'>[] = [
      {
        id: 'touch',
        label: 'แตะบนจอสัมผัส',
        help: 'แตะ 2 ครั้ง: แตะแรกเลือกหลุม แตะซ้ำเพื่อหว่าน กันแตะพลาด',
        options: ['แตะ 2 ครั้ง', 'แตะครั้งเดียว'],
        get: () => (loadTouchConfirm(reg) === 'single' ? 1 : 0),
        set: (o) => saveTouchConfirm(reg, o === 1 ? 'single' : 'double'),
      },
      flagRow('motion', 'ลดการเคลื่อนไหว', 'หว่านเสร็จทันที ไม่มีภาพเคลื่อนไหวหรือสั่น', REDUCED_MOTION, false),
      flagRow('vibration', 'สั่นตอนกิน', 'จอยสั่น (และมือถือ Android สั่น) เมื่อมีการกินเม็ด', VIBRATION, true),
      flagRow('facing', 'หันหน้าเข้าหากัน', 'โหมด 2 คน: ชื่อและตัวเลขฝั่งผู้เล่น 2 กลับหัว สำหรับวางเครื่องบนโต๊ะ', FACING, false),
      {
        id: 'style',
        label: 'แบบการเล่น',
        help: 'เม็ด: ลูกแก้ว · มือ: ลูกแก้วและรูปมือหว่าน · ตัวเลข: เลขในหลุม',
        options: BOARD_STYLES.map((s) => BOARD_STYLE_LABEL[s]),
        get: () => BOARD_STYLES.indexOf(loadBoardStyle(reg)),
        set: (o) => saveBoardStyle(reg, BOARD_STYLES[o]),
      },
    ];

    addText(this, width / 2, 20, 'ตั้งค่า', 18, CSS.gold);
    this.rows = defs.map((def, r) => {
      const y = SETTINGS_LAYOUT.firstY + r * SETTINGS_LAYOUT.gapY;
      const count = def.options.length === 3 ? 3 : 2;
      addText(this, SETTINGS_LAYOUT.labelX, y, def.label, 12, CSS.cream).setOrigin(1, 0.5);
      const row: SettingRow = { ...def, items: [] };
      row.items = def.options.map((label, i) =>
        addButton(this, SETTINGS_LAYOUT.optionX[count][i], y, label, {
          width: SETTINGS_LAYOUT.optionW[count],
          onClick: () => {
            this.focus = r;
            this.pick(row, i);
          },
        }),
      );
      return row;
    });
    this.back = addButton(this, width / 2, SETTINGS_LAYOUT.backY, 'กลับ', {
      width: 90,
      onClick: () => this.leave(),
      onHover: () => this.setFocus(this.rows.length),
    });

    addText(this, width / 2, 212, 'ความเร็วหว่านและจำนวนรอบอยู่ที่เมนูหลัก · ตั้งค่าเสียงมาพร้อมงานเสียง', 12, CSS.dim, false);
    this.help = addText(this, width / 2, 232, '', 12, CSS.cream, false);
    addText(this, width / 2, 256, '↑ ↓ เลือก · ← → / Enter เปลี่ยน · Esc / จอย B กลับ', 12, CSS.dim, false);
    this.frame = createFocusFrame(this);
    this.refresh();

    onKeyDown(this, 'UP', () => this.nav('up'));
    onKeyDown(this, 'DOWN', () => this.nav('down'));
    onKeyDown(this, 'LEFT', () => this.nav('left'));
    onKeyDown(this, 'RIGHT', () => this.nav('right'));
    onKeyDown(this, 'ENTER', () => this.nav('confirm'));
    onKeyDown(this, 'SPACE', () => this.nav('confirm'));
    onKeyDown(this, 'ESC', () => this.leave());
    onPadAction(this, (action) => this.nav(action));
  }

  private nav(action: PadAction): void {
    const row = this.rows[this.focus] as SettingRow | undefined;
    switch (action) {
      case 'up':
        this.setFocus(Math.max(0, this.focus - 1));
        break;
      case 'down':
        this.setFocus(Math.min(this.rows.length, this.focus + 1));
        break;
      case 'left':
        if (row) this.pick(row, Math.max(0, row.get() - 1));
        break;
      case 'right':
        if (row) this.pick(row, Math.min(row.options.length - 1, row.get() + 1));
        break;
      case 'confirm':
        if (row) this.pick(row, (row.get() + 1) % row.options.length);
        else this.leave();
        break;
      case 'cancel':
        this.leave();
        break;
      default:
        break;
    }
  }

  private pick(row: SettingRow, option: number): void {
    row.set(option);
    this.refresh();
  }

  private setFocus(i: number): void {
    this.focus = i;
    this.refresh();
  }

  private refresh(): void {
    for (const row of this.rows) row.items.forEach((b, i) => paintButton(b, i === row.get()));
    paintButton(this.back, false);
    const row = this.rows[this.focus] as SettingRow | undefined;
    frameAround(this.frame, row ? row.items[row.get()] : this.back);
    this.help.setText(row ? row.help : 'กลับไปเมนูหลัก');
  }

  private leave(): void {
    const data: MainMenuData = { fromPage: 0 };
    this.scene.start(SceneKeys.MainMenu, data);
  }
}
