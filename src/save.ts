/**
 * The game in progress, saved to localStorage after every move (GDD §3.5, AC-S1) so a
 * reload or a closed tab can be resumed from the menu ("เล่นต่อ"). Guarded like
 * settings.ts: storage may be unavailable, and a bad save is simply ignored.
 */
import { parseGameState } from './logic/serialize';
import type { GameState } from './logic/types';
import { OPPONENTS, type Opponent } from './types/scenes';

const STORAGE_KEY = 'thai-mancala:save';
const SAVE_VERSION = 1;

export interface SavedGame {
  state: GameState;
  opponent: Opponent;
}

export function saveGame(game: SavedGame): void {
  try {
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state: game.state, opponent: game.opponent }),
    );
  } catch {
    /* storage unavailable: the game just will not survive a reload */
  }
}

/** The saved game, or null if there is none or it is unreadable / from another version. */
export function loadSavedGame(): SavedGame | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parseSavedGame(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function parseSavedGame(raw: unknown): SavedGame | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== SAVE_VERSION) return null;
  if (!(OPPONENTS as readonly unknown[]).includes(r.opponent)) return null;
  const state = parseGameState(r.state);
  return state ? { state, opponent: r.opponent as Opponent } : null;
}

export function clearSavedGame(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}
