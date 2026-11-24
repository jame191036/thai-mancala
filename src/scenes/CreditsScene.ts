import Phaser from 'phaser';
import { CSS } from '../display/palette';
import { onKeyDown } from '../input/keys';
import { onPadAction } from '../input/gamepad';
import { SceneKeys, type MainMenuData } from '../types/scenes';
import { TEXT_SIZE, addButton, addText, createFocusFrame, frameAround, paintButton } from '../ui/widgets';

/** "กลับ" button centre (base px), for playtests. */
export const CREDITS_LAYOUT = { backY: 232 } as const;

/**
 * Credits (GDD §7): tools, the font (its OFL licence asks for it) and the rule sources of
 * GDD Appendix B. No developer name (owner's choice, 2026-11-24). Art and sound credits are
 * added with the art and audio passes.
 */
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Credits);
  }

  create(): void {
    const { width } = this.scale;
    const line = (y: number, s: string, color: string = CSS.cream, size = TEXT_SIZE, bold = false) => addText(this, width / 2, y, s, size, color, bold);

    line(16, 'เครดิต', CSS.gold, 18, true);
    line(42, 'หมากขุม: การละเล่นพื้นบ้านไทย', CSS.cream, 14, true);
    line(65, 'สร้างด้วย Phaser 4 · TypeScript · Vite');
    line(83, 'ฟอนต์ Mali (Cadson Demak) · SIL Open Font License 1.1');

    line(106, 'แหล่งอ้างอิงกติกา', CSS.gold, TEXT_SIZE, true);
    line(123, 'บันทึกหมากขุมไทย ค.ศ. 1836 · Ludii Portal (ludii.games)');
    line(141, 'THAILEX: mahk khum (หมากขุม) · thailex.info');
    line(160, 'แบบตามวิดีโอ: youtube.com/watch?v=ZwP1hlU_m_c');

    line(184, 'งานภาพ: กระดานและลูกแก้ววาดขึ้นใหม่สำหรับเกมนี้ · เสียง: ยังไม่มี', CSS.dim);
    line(208, 'ไม่ได้ลอกลายหรือภาพจากงานที่มีลิขสิทธิ์', CSS.dim);

    const back = addButton(this, width / 2, CREDITS_LAYOUT.backY, 'กลับ', { width: 90, onClick: () => this.leave() });
    paintButton(back, true);
    frameAround(createFocusFrame(this), back);
    line(256, 'Enter / Esc / จอย A หรือ B กลับ', CSS.dim);

    onKeyDown(this, 'ENTER', () => this.leave());
    onKeyDown(this, 'SPACE', () => this.leave());
    onKeyDown(this, 'ESC', () => this.leave());
    onPadAction(this, (action) => {
      if (action === 'confirm' || action === 'cancel') this.leave();
    });
  }

  private leave(): void {
    const data: MainMenuData = { fromPage: 2 };
    this.scene.start(SceneKeys.MainMenu, data);
  }
}
