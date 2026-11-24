/**
 * Gamepad → game actions (GDD §3.8.1). Phaser's gamepad plugin polls
 * navigator.getGamepads() every frame; this turns its button and stick changes into a few
 * semantic actions every scene understands.
 *
 * Buttons are named by POSITION (standard mapping), not by letter, because Nintendo pads
 * swap A and B compared with Xbox ones: bottom = confirm, right = cancel, top = speed.
 */
import type Phaser from 'phaser';

export type PadAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'speed' | 'pause';

/** W3C "standard" gamepad mapping: button index → action. */
const BUTTON_ACTION: Readonly<Record<number, PadAction>> = {
  0: 'confirm', // bottom face button (Xbox A, PlayStation ✕)
  1: 'cancel', // right face button (Xbox B, PlayStation ○)
  3: 'speed', // top face button (Xbox Y, PlayStation △)
  9: 'pause', // Start / Menu / Options
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

/** A button already down when the scene starts was pressed for the previous scene. */
const IGNORE_AFTER_START_MS = 250;
/** Left stick: how far it must tilt, and the hold-to-repeat timing. */
const STICK_DEADZONE = 0.5;
const STICK_FIRST_REPEAT_MS = 350;
const STICK_REPEAT_MS = 150;

type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Call `handler(action, padSlot)` for every gamepad action in `scene`. `padSlot` is the
 * pad's position among connected pads (0 = first pad, 1 = second), which is how local
 * two-player games assign pads to players.
 */
export function onPadAction(scene: Phaser.Scene, handler: (action: PadAction, padSlot: number) => void): void {
  const plugin = scene.input.gamepad;
  if (!plugin) return;

  // Each scene tracks button states on its own, and a paused scene stops tracking. So
  // when a scene starts OR resumes, a button still held from the scene before it (Start
  // that closed the pause menu, A that picked "เล่นต่อ") looks like a fresh press. Ignore
  // presses for a moment after either. performance.now(): the scene clock stops while paused.
  let readyAt = performance.now() + IGNORE_AFTER_START_MS;
  const settle = () => {
    readyAt = performance.now() + IGNORE_AFTER_START_MS;
  };
  scene.events.on('resume', settle);
  scene.events.on('wake', settle);
  const ready = () => performance.now() >= readyAt;

  plugin.on('down', (pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (!ready()) return;
    const action = BUTTON_ACTION[button.index];
    if (action) handler(action, padSlot(pad.index));
  });

  // The left stick behaves like the D-pad: one step on tilt, then repeats while held.
  const held = new Map<number, { dir: Direction; next: number }>();
  const onUpdate = () => {
    const now = performance.now();
    for (const pad of plugin.gamepads) {
      if (!pad) continue;
      const dir = stickDirection(pad.leftStick.x, pad.leftStick.y);
      const state = held.get(pad.index);
      if (!dir) {
        held.delete(pad.index);
      } else if (!state || state.dir !== dir) {
        held.set(pad.index, { dir, next: now + STICK_FIRST_REPEAT_MS });
        if (ready()) handler(dir, padSlot(pad.index));
      } else if (now >= state.next) {
        state.next = now + STICK_REPEAT_MS;
        if (ready()) handler(dir, padSlot(pad.index));
      }
    }
  };
  scene.events.on('update', onUpdate);
  scene.events.once('shutdown', () => {
    scene.events.off('update', onUpdate);
    scene.events.off('resume', settle);
    scene.events.off('wake', settle);
  });
}

/** `handler()` when a gamepad is unplugged while `scene` is running. */
export function onPadDisconnected(scene: Phaser.Scene, handler: () => void): void {
  scene.input.gamepad?.on('disconnected', handler);
}

/**
 * Indices of the pads the browser reports as connected right now. Read from the browser,
 * not from Phaser: a Phaser Gamepad keeps the snapshot it was created from, and in Chrome
 * that snapshot still says `connected: true` after the pad is unplugged.
 */
function connectedPadIndices(): number[] {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const out: number[] = [];
  for (const p of pads ?? []) if (p && p.connected !== false) out.push(p.index);
  return out.sort((a, b) => a - b);
}

/** Number of gamepads connected right now. */
export function connectedPadCount(): number {
  return connectedPadIndices().length;
}

/** Position of pad `index` among the connected pads: 0 = first pad, 1 = second, … */
function padSlot(index: number): number {
  const slot = connectedPadIndices().indexOf(index);
  return slot === -1 ? 0 : slot;
}

function stickDirection(x: number, y: number): Direction | null {
  if (Math.max(Math.abs(x), Math.abs(y)) < STICK_DEADZONE) return null;
  if (Math.abs(x) >= Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}
