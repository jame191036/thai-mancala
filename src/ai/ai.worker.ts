/**
 * Web Worker: runs the AI search off the main thread so the game never stutters while
 * the AI thinks (GDD §6/§10). Messages are plain data; see AiClient for the other side.
 */
import { chooseMove } from './ai';
import type { AiRequest, AiResponse } from './protocol';

// The worker global, typed without pulling the whole WebWorker lib into the DOM build.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<AiRequest>) => void) | null;
  postMessage(message: AiResponse): void;
};

ctx.onmessage = (e) => {
  const { id, state, level, timeBudgetMs } = e.data;
  try {
    ctx.postMessage({ id, pit: chooseMove(state, level, { timeBudgetMs }) });
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
