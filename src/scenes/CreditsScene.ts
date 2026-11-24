import Phaser from 'phaser';
import { CSS } from '../display/palette';
import { onKeyDown } from '../input/keys';
import { onPadAction } from '../input/gamepad';
import { SceneKeys, type MainMenuData } from '../types/scenes';
import { addButton, addText, createFocusFrame, frameAround, paintButton } from '../ui/widgets';

/** "กลับ" button centre (base px), for playtests. */
export const CREDITS_LAYOUT = { backY: 214 } as const;

/**
 * Credits (GDD §7): tools and the rule sources of GDD Appendix B. No developer name (owner's
 * choice, 2026-11-24). Art and sound credits are added with the art and audio passes.
 */
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.Credits);
  }

  create(): void {
    const { width } = this.scale;
    const line = (y: number, s: string, size: number, color: string, bold = false) => addText(this, width / 2, y, s, size, color, bold);

    line(22, 'เครดิต', 18, CSS.gold, true);
    line(50, 'หมากขุม: การละเล่นพื้นบ้านไทย', 12, CSS.cream, true);
    line(68, 'สร้างด้วย Phaser 4 · TypeScript · Vite', 10, CSS.cream);

    line(94, 'แหล่งอ้างอิงกติกา', 11, CSS.gold, true);
    line(112, 'บันทึกหมากขุมไทย ค.ศ. 1836 · Ludii Portal (ludii.games)', 9, CSS.cream);
    line(126, 'THAILEX: mahk khum (หมากขุม) · thailex.info', 9, CSS.cream);
    line(140, 'แบบตามวิดีโอ: youtube.com/watch?v=ZwP1hlU_m_c', 9, CSS.cream);

    line(166, 'งานภาพ: กราฟิกชั่วคราว · เสียง: ยังไม่มี', 9, CSS.dim);
    line(180, 'ไม่ได้ลอกลายหรือภาพจากงานที่มีลิขสิทธิ์', 8, CSS.dim);

    const back = addButton(this, width / 2, CREDITS_LAYOUT.backY, 'กลับ', { width: 90, onClick: () => this.leave() });
    paintButton(back, true);
    frameAround(createFocusFrame(this), back);
    line(254, 'Enter / Esc / จอย A หรือ B กลับ', 9, CSS.dim);

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
