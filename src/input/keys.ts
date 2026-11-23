import type Phaser from 'phaser';

/**
 * `keyboard.on('keydown-KEY')` that acts on each DOM key event exactly once.
 *
 * Phaser 4.2.1 re-dispatches queued key events when several arrive within one frame:
 * KeyboardManager processes the whole queue on every DOM key event but only clears it on
 * POST_STEP, and its duplicate guard compares against the previous event only. So "→ then
 * Enter" inside one frame fires → twice and Enter twice. `once(...)` listeners are safe;
 * every repeating `on(...)` listener should go through this helper.
 * Regression test: playtest/controls.mjs ("in a single frame").
 */
export function onKeyDown(scene: Phaser.Scene, key: string, action: () => void): void {
  const seen = new WeakSet<KeyboardEvent>();
  scene.input.keyboard?.on(`keydown-${key}`, (event: KeyboardEvent) => {
    if (seen.has(event)) return;
    seen.add(event);
    action();
  });
}
