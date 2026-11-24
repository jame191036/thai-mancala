/**
 * Player settings that persist: kept in the Phaser registry for this session and in
 * localStorage across visits. localStorage can throw (private mode, sandboxed iframes),
 * so every access is guarded and the game falls back to defaults.
 */
import type Phaser from 'phaser';
import { DEFAULT_FULL_GAME_ROUNDS, FULL_GAME_ROUND_OPTIONS } from './logic/rules';
import type { GameMode, Ruleset } from './logic/types';

const STORAGE_KEY = 'thai-mancala:settings';

type StoredSettings = Record<string, unknown>;

function readStored(): StoredSettings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? (parsed as StoredSettings) : {};
  } catch {
    return {};
  }
}

function writeStored(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), [key]: value }));
  } catch {
    /* storage unavailable: the setting still holds for this session */
  }
}

/** Session value first, then the saved one; anything invalid becomes the default. */
function load<T>(registry: Phaser.Data.DataManager, key: string, parse: (raw: unknown) => T): T {
  const session: unknown = registry.get(key);
  return parse(session ?? readStored()[key]);
}

function save(registry: Phaser.Data.DataManager, key: string, value: unknown): void {
  registry.set(key, value);
  writeStored(key, value);
}

// ── Sowing speed ─────────────────────────────────────────────────────────────

/** Sowing speed: multiplier on the ×1 drop time of 120 ms per seed (GDD §3.7). */
export const SOW_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export type SowSpeed = (typeof SOW_SPEEDS)[number];
export const DEFAULT_SOW_SPEED: SowSpeed = 1;

export const SOW_SPEED_LABEL: Record<SowSpeed, string> = {
  0.25: 'ช้ามาก',
  0.5: 'ช้า',
  1: 'ปกติ',
  2: 'เร็ว',
  4: 'เร็วมาก',
};

/** Accepts only one of the known speeds; anything else becomes the default. */
export function parseSowSpeed(raw: unknown): SowSpeed {
  return (SOW_SPEEDS as readonly unknown[]).includes(raw) ? (raw as SowSpeed) : DEFAULT_SOW_SPEED;
}

export function loadSowSpeed(registry: Phaser.Data.DataManager): SowSpeed {
  return load(registry, 'sowSpeed', parseSowSpeed);
}

export function saveSowSpeed(registry: Phaser.Data.DataManager, speed: SowSpeed): void {
  save(registry, 'sowSpeed', speed);
}

/** The next speed in the cycle (in-game button / F key). */
export function nextSowSpeed(speed: SowSpeed): SowSpeed {
  return SOW_SPEEDS[(SOW_SPEEDS.indexOf(speed) + 1) % SOW_SPEEDS.length];
}

// ── Full game length (R16) ───────────────────────────────────────────────────

export type FullGameRounds = (typeof FULL_GAME_ROUND_OPTIONS)[number];

export function parseFullGameRounds(raw: unknown): FullGameRounds {
  return (FULL_GAME_ROUND_OPTIONS as readonly unknown[]).includes(raw)
    ? (raw as FullGameRounds)
    : (DEFAULT_FULL_GAME_ROUNDS as FullGameRounds);
}

export function loadFullGameRounds(registry: Phaser.Data.DataManager): FullGameRounds {
  return load(registry, 'fullGameRounds', parseFullGameRounds);
}

export function saveFullGameRounds(registry: Phaser.Data.DataManager, rounds: FullGameRounds): void {
  save(registry, 'fullGameRounds', rounds);
}

// ── Last game chosen on the menu (ruleset and length) ───────────────────────

export function parseRuleset(raw: unknown): Ruleset {
  return raw === 'video' ? 'video' : 'traditional';
}

export function loadRuleset(registry: Phaser.Data.DataManager): Ruleset {
  return load(registry, 'ruleset', parseRuleset);
}

export function saveRuleset(registry: Phaser.Data.DataManager, ruleset: Ruleset): void {
  save(registry, 'ruleset', ruleset);
}

export function parseGameMode(raw: unknown): GameMode {
  return raw === 'full' ? 'full' : 'short';
}

export function loadGameMode(registry: Phaser.Data.DataManager): GameMode {
  return load(registry, 'gameMode', parseGameMode);
}

export function saveGameMode(registry: Phaser.Data.DataManager, mode: GameMode): void {
  save(registry, 'gameMode', mode);
}

// ── Settings screen (GDD §7): comfort and accessibility ─────────────────────

/** Touch screens: tap a pit twice to sow (default, GDD §3.8) or once. */
export type TouchConfirm = 'double' | 'single';

export function parseTouchConfirm(raw: unknown): TouchConfirm {
  return raw === 'single' ? 'single' : 'double';
}

export function loadTouchConfirm(registry: Phaser.Data.DataManager): TouchConfirm {
  return load(registry, 'touchConfirm', parseTouchConfirm);
}

export function saveTouchConfirm(registry: Phaser.Data.DataManager, value: TouchConfirm): void {
  save(registry, 'touchConfirm', value);
}

/** On/off settings. `fallback` is used when nothing valid is stored. */
export interface Flag {
  key: string;
  fallback: () => boolean;
}

/** Finish every animation at once, no shaking. Defaults to the system "reduce motion". */
export const REDUCED_MOTION: Flag = { key: 'reducedMotion', fallback: prefersReducedMotion };
/** Rumble the gamepad (and buzz an Android phone) on a capture (GDD §3.8.1, §7). */
export const VIBRATION: Flag = { key: 'vibration', fallback: () => true };
/** Two people facing each other across the device: P2's names and numbers upside down. */
export const FACING: Flag = { key: 'facing', fallback: () => false };

export function parseFlag(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback;
}

export function loadFlag(registry: Phaser.Data.DataManager, flag: Flag): boolean {
  return load(registry, flag.key, (raw) => parseFlag(raw, flag.fallback()));
}

export function saveFlag(registry: Phaser.Data.DataManager, flag: Flag, value: boolean): void {
  save(registry, flag.key, value);
}

function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}
