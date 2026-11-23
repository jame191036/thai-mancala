import type { GameState, PitIndex } from '../logic/types';
import type { AiLevel } from './ai';

/** Main thread → worker. */
export interface AiRequest {
  id: number;
  state: GameState;
  level: AiLevel;
  timeBudgetMs?: number;
}

/** Worker → main thread. */
export type AiResponse = { id: number; pit: PitIndex } | { id: number; error: string };
