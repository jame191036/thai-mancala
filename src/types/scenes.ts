import type { GameEndReason, GameMode, Player, Ruleset } from '../logic/types';
import type { AiLevel } from '../ai/ai';
import { PLAYER_NAME } from '../display/palette';
import type { SavedGame } from '../save';

/** Who plays P2 (top row): another person on the same device, or the AI. P1 is always a person. */
export type Opponent = 'human' | AiLevel;
export const OPPONENTS: readonly Opponent[] = ['human', 'easy', 'medium', 'hard'];
/** The AI always plays P2. */
export const AI_PLAYER: Player = 1;

export const OPPONENT_LABEL: Record<Opponent, string> = {
  human: '2 คน',
  easy: 'AI ง่าย',
  medium: 'AI กลาง',
  hard: 'AI ยาก',
};

/** Names shown for [P1, P2]. */
export function playerNames(opponent: Opponent): readonly [string, string] {
  return opponent === 'human' ? PLAYER_NAME : ['คุณ', OPPONENT_LABEL[opponent]];
}

/** Scene keys: use these instead of string literals so typos fail to compile. */
export const SceneKeys = {
  Boot: 'BootScene',
  Preloader: 'PreloaderScene',
  MainMenu: 'MainMenuScene',
  Game: 'GameScene',
  GameOver: 'GameOverScene',
  Pause: 'PauseScene',
} as const;

/** Data for `scene.start(SceneKeys.Game, data)`. All optional: defaults to a short game. */
export interface GameSceneData {
  mode?: GameMode;
  /** Full game only: 3, 5 or 7 (R16). */
  maxRounds?: number;
  /** `traditional` (default) or `video` (R17). */
  ruleset?: Ruleset;
  /** P2 is a second person (default) or the AI at some level. */
  opponent?: Opponent;
  /** Who moves first; random when omitted (R11). */
  firstPlayer?: Player;
  /** Continue a saved game instead of starting a new one (the other fields are ignored). */
  resume?: SavedGame;
}

/** Data for `scene.launch(SceneKeys.Pause, data)`. */
export interface PauseSceneData {
  /** Opened because a gamepad was unplugged: say so (GDD §3.8.1). */
  padLost?: boolean;
}

/** Name of each ruleset as shown on the menu and the in-game HUD. */
export const RULESET_NAME: Record<Ruleset, string> = {
  traditional: 'แบบดั้งเดิม',
  video: 'แบบตามวิดีโอ',
};

/** One-line summary of how each ruleset differs (menu row heading, result screen). */
export const RULESET_SUMMARY: Record<Ruleset, string> = {
  traditional: 'หว่านต่อได้ · ข้ามตาจนเม็ดหมดกระดาน',
  video: 'เดินต่อเฉพาะลงหัวเมือง · ฝั่งใดหมดจบทันที',
};

/** Data for `scene.start(SceneKeys.GameOver, data)`. */
export interface GameOverData {
  mode: GameMode;
  ruleset: Ruleset;
  opponent: Opponent;
  maxRounds: number;
  /** Round in which the game ended. */
  round: number;
  /** `null` = draw. */
  winner: Player | null;
  /** Store totals at the end: [P1, P2]. */
  stores: readonly [number, number];
  /** Why the game ended; 'resigned' = the loser gave up from the pause menu. */
  reason: GameEndReason | 'resigned';
}
