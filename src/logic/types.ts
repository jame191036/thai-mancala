/**
 * Types for the หมากขุม rules engine (GDD §3). Pure TypeScript: never import Phaser here.
 */

/** 0 = P1 (bottom row, store on the right), 1 = P2 (top row, store on the left). */
export type Player = 0 | 1;

/** `short` = one round; `full` = many rounds with dead pits (GDD R12). */
export type GameMode = 'short' | 'full';

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
  | 'opponentEmptyPit';

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
  /** Last seed landed in a non-empty pit: picked up all its seeds to keep sowing (R5). */
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
  /** `player` had no seeds when their turn came, so the other player moves (R9). */
  | { readonly kind: 'pass'; readonly player: Player }
  /** Every small pit is empty: the round is over (R10). */
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
