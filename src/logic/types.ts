/**
 * Types for the หมากขุม rules engine (GDD §3). Pure TypeScript: never import Phaser here.
 */

/** 0 = P1 (bottom row, store on the right), 1 = P2 (top row, store on the left). */
export type Player = 0 | 1;

/** `short` = one round; `full` = many rounds with dead pits (GDD R12). */
export type GameMode = 'short' | 'full';

/**
 * Which rule set is played (GDD §3.1). Sowing direction, stores, capture and the extra turn
 * are the same in both; they differ in two places:
 *
 * | | `traditional` (R1–R16, default) | `video` (R17, the owner's reference video) |
 * |---|---|---|
 * | last seed in a pit that has seeds | relay: pick them all up, keep sowing (R5) | the turn ends — the ONLY way to keep going is the extra turn from landing in your own store |
 * | end of a round | a player with no seeds passes; ends when every seed is in a store (R9/R10) | as soon as either side is empty; leftovers go to that side's owner |
 */
export type Ruleset = 'traditional' | 'video';

/**
 * - `playing`   : waiting for `current` to choose a pit.
 * - `roundOver` : full game only, between rounds. Call `startNextRound()`.
 * - `gameOver`  : finished. See `winner`.
 */
export type Phase = 'playing' | 'roundOver' | 'gameOver';

/** Index into `GameState.pits` (0–15). See board.ts for the layout. */
export type PitIndex = number;

/** Why the game ended. */
export type GameEndReason =
  /** Short game: its single round is over. */
  | 'singleRound'
  /** Full game: a player could not fill even one pit (R15). */
  | 'cannotFill'
  /** Full game: the last allowed round is over; more seeds in the store wins (R16). */
  | 'roundLimit';

export interface RoundResult {
  readonly round: number;
  /** Seeds in each store when the round ended: [P1, P2]. */
  readonly stores: readonly [number, number];
  /** Player with more seeds, or `null` for a tie. */
  readonly winner: Player | null;
}

export interface GameState {
  readonly mode: GameMode;
  readonly ruleset: Ruleset;
  /** 16 slots: P1 pits 0–6, P1 store 7, P2 pits 8–14, P2 store 15. */
  readonly pits: readonly number[];
  /** 16 flags; only small pits can be dead (full game, GDD R13). Dead pits are always empty. */
  readonly dead: readonly boolean[];
  /** Whose turn it is (meaningful while `phase === 'playing'`). */
  readonly current: Player;
  readonly phase: Phase;
  /** 1-based round number. */
  readonly round: number;
  /** Rounds allowed in this game: 1 for a short game; 3, 5 or 7 for a full game (R16). */
  readonly maxRounds: number;
  /** Who made the first move of the current round (needed for the tie rule, A5). */
  readonly roundStarter: Player;
  /** Result of the most recent finished round, if any. */
  readonly lastRound: RoundResult | null;
  /** Game winner once `phase === 'gameOver'`; `null` means a draw. */
  readonly winner: Player | null;
  /** Why the game ended, once `phase === 'gameOver'`. */
  readonly endReason: GameEndReason | null;
}

/** Why a turn ended without an extra turn. */
export type TurnEndReason =
  /** Last seed landed in an own empty pit and captured the opposite pit (R6). */
  | 'captured'
  /** Last seed landed in an own empty pit, but the opposite pit was empty or dead (R6). */
  | 'ownEmptyPit'
  /** Last seed landed in an empty pit on the opponent's side (R7). */
  | 'opponentEmptyPit'
  /** `video` ruleset: last seed landed in a pit that already had seeds — no relay (R17). */
  | 'occupiedPit';

/**
 * One step of a move, in order. Replaying the steps on the previous `pits` reproduces the
 * new `pits` exactly, so the UI can animate the sowing seed by seed.
 */
export type Step =
  /** Took every seed out of the chosen pit to start the turn. */
  | { readonly kind: 'pickup'; readonly player: Player; readonly pit: PitIndex; readonly seeds: number }
  /** Placed ONE seed. `pitSeeds` = seeds in that pit afterwards, `handSeeds` = seeds still in hand. */
  | {
      readonly kind: 'drop';
      readonly player: Player;
      readonly pit: PitIndex;
      readonly pitSeeds: number;
      readonly handSeeds: number;
    }
  /** `traditional`: last seed landed in a non-empty pit, so all its seeds are picked up to keep sowing (R5). */
  | { readonly kind: 'relay'; readonly player: Player; readonly pit: PitIndex; readonly seeds: number }
  /**
   * Captured the `opposite` pit (R6): `captured` seeds from there plus the last seed from `pit`
   * all go into the player's store (`toStore = captured + 1`).
   */
  | {
      readonly kind: 'capture';
      readonly player: Player;
      readonly pit: PitIndex;
      readonly opposite: PitIndex;
      readonly captured: number;
      readonly toStore: number;
    }
  /** Last seed landed in the player's own store: they move again (R8). */
  | { readonly kind: 'extraTurn'; readonly player: Player }
  /** The sowing ended and the turn is over. */
  | { readonly kind: 'turnEnd'; readonly player: Player; readonly pit: PitIndex; readonly reason: TurnEndReason }
  /** `traditional`: `player` had no seeds when their turn came, so the other player moves (R9). */
  | { readonly kind: 'pass'; readonly player: Player }
  /** `video`: after a move `player`'s small pits are all empty, so the round ends (R17). */
  | { readonly kind: 'sideEmpty'; readonly player: Player }
  /** `video`, round end: `seeds` left in `player`'s `pit` go into `player`'s store (R17). */
  | { readonly kind: 'sweep'; readonly player: Player; readonly pit: PitIndex; readonly seeds: number }
  /** The round is over; every seed is in a store (R10 / R17). */
  | {
      readonly kind: 'roundEnd';
      readonly round: number;
      readonly stores: readonly [number, number];
      readonly winner: Player | null;
    }
  /** The game is over. `winner === null` is a draw (49:49 in the deciding round). */
  | { readonly kind: 'gameOver'; readonly winner: Player | null; readonly reason: GameEndReason }
  /** Full game, between rounds: moved `seeds` from the player's store into `pit` (R13). */
  | { readonly kind: 'refill'; readonly player: Player; readonly pit: PitIndex; readonly seeds: number }
  /** Full game, between rounds: `pit` could not be filled and is dead this round (R13). */
  | { readonly kind: 'deadPit'; readonly player: Player; readonly pit: PitIndex }
  /** Full game: a new round begins and `starter` moves first (R14, A5). */
  | { readonly kind: 'roundStart'; readonly round: number; readonly starter: Player };

export interface MoveResult {
  readonly state: GameState;
  readonly steps: readonly Step[];
}
