/**
 * Player settings that persist: kept in the Phaser registry for this session and in
 * localStorage across visits. localStorage can throw (private mode, sandboxed iframes),
 * so every access is guarded and the game falls back to defaults.
 */
import type Phaser from 'phaser';
import { DEFAULT_FULL_GAME_ROUNDS, FULL_GAME_ROUND_OPTIONS } from './logic/rules';

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
