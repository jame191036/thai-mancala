import type { GameEndReason, GameMode, Player, Ruleset } from '../logic/types';

/** Scene keys: use these instead of string literals so typos fail to compile. */
export const SceneKeys = {
  Boot: 'BootScene',
  Preloader: 'PreloaderScene',
  MainMenu: 'MainMenuScene',
  Game: 'GameScene',
  GameOver: 'GameOverScene',
} as const;

/** Data for `scene.start(SceneKeys.Game, data)`. All optional: defaults to a short game. */
export interface GameSceneData {
  mode?: GameMode;
  /** Full game only: 3, 5 or 7 (R16). */
  maxRounds?: number;
  /** `traditional` (default) or `video` (R17). */
  ruleset?: Ruleset;
  /** Who moves first; random when omitted (R11). */
  firstPlayer?: Player;
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
  maxRounds: number;
  /** Round in which the game ended. */
  round: number;
  /** `null` = draw. */
  winner: Player | null;
  /** Store totals at the end: [P1, P2]. */
  stores: readonly [number, number];
  reason: GameEndReason;
}
