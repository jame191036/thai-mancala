/**
 * The AI's characters (GDD §6): a name and a few short lines per level. They change nothing
 * about how the AI plays. Pure data: no Phaser, so it is unit-tested.
 */
import type { AiLevel } from './ai/ai';

export type Mood = 'normal' | 'glad' | 'sad';

/** What a character reacts to. `captured`: the player captured. win / lose / draw: its own result. */
export type TalkEvent = 'capture' | 'captured' | 'extraTurn' | 'win' | 'lose' | 'draw';

export interface Character {
  name: string;
  lines: Readonly<Record<TalkEvent, string>>;
}

export const CHARACTERS: Readonly<Record<AiLevel, Character>> = {
  easy: {
    name: 'น้องแก้ว',
    lines: {
      capture: 'ได้เยอะเลย!',
      captured: 'โธ่!',
      extraTurn: 'อีกที ๆ!',
      win: 'ชนะแล้ว เย้!',
      lose: 'เอาใหม่ ๆ!',
      draw: 'เท่ากันเลย!',
    },
  },
  medium: {
    name: 'ลุงเคี่ยม',
    lines: {
      capture: 'ขอหน่อยนะหลาน',
      captured: 'โอ๊ะโอ เก่งนี่',
      extraTurn: 'ยังไม่จบนะ',
      win: 'ชาสักแก้วไหม',
      lose: 'แพ้หลานจนได้',
      draw: 'สูสีดีนะ',
    },
  },
  hard: {
    name: 'ยายขุม',
    lines: {
      capture: 'หึ หึ',
      captured: 'อืม...',
      extraTurn: 'ยังไม่ถึงตาหลาน',
      win: 'ฝึกอีกหน่อยนะ',
      lose: 'เก่งขึ้นแล้วนะ',
      draw: 'ไม่เลว',
    },
  },
};

export const MOOD_OF: Readonly<Record<TalkEvent, Mood>> = {
  capture: 'glad',
  captured: 'sad',
  extraTurn: 'glad',
  win: 'glad',
  lose: 'sad',
  draw: 'normal',
};
