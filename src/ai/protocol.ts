import type { GameState, PitIndex } from '../logic/types';
import type { AiLevel } from './ai';

/** Main thread → worker. */
export interface AiRequest {
  id: number;
  state: GameState;
  level: AiLevel;
  timeBudgetMs?: number;
}

/** Worker → main thread. `ready` comes once, when the worker's code has loaded. */
export type AiResponse = { ready: true } | { id: number; pit: PitIndex } | { id: number; error: string };
