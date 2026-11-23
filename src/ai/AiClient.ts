import type { GameState, PitIndex } from '../logic/types';
import { chooseMove, type AiLevel } from './ai';
import type { AiRequest, AiResponse } from './protocol';

/**
 * Asks the AI for a move. Uses a Web Worker when the browser allows it, and falls back to
 * computing on the main thread (same code, just blocking) if the worker cannot start or
 * fails — so the game always gets a move.
 */
export class AiClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, { state: GameState; level: AiLevel; resolve: (pit: PitIndex) => void }>();

  constructor() {
    try {
      this.worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<AiResponse>) => this.onResponse(e.data);
      this.worker.onerror = () => this.failOver();
    } catch {
      this.worker = null;
    }
  }

  /** True when moves are computed off the main thread. */
  get usesWorker(): boolean {
    return this.worker !== null;
  }

  choose(state: GameState, level: AiLevel, timeBudgetMs?: number): Promise<PitIndex> {
    if (!this.worker) return Promise.resolve(chooseMove(state, level, { timeBudgetMs }));
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, { state, level, resolve });
      const request: AiRequest = { id, state, level, timeBudgetMs };
      this.worker?.postMessage(request);
    });
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pending.clear();
  }

  private onResponse(res: AiResponse): void {
    const job = this.pending.get(res.id);
    if (!job) return;
    this.pending.delete(res.id);
    job.resolve('pit' in res ? res.pit : chooseMove(job.state, job.level));
  }

  /** Worker crashed: finish every waiting request on the main thread from now on. */
  private failOver(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const [id, job] of this.pending) {
      this.pending.delete(id);
      job.resolve(chooseMove(job.state, job.level));
    }
  }
}
