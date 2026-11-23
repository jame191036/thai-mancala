/**
 * Player settings that persist: kept in the Phaser registry for this session and in
 * localStorage across visits. localStorage can throw (private mode, sandboxed iframes),
 * so every access is guarded and the game falls back to defaults.
 */
import type Phaser from 'phaser';

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

const REGISTRY_KEY = 'sowSpeed';
const STORAGE_KEY = 'thai-mancala:settings';

interface StoredSettings {
  sowSpeed?: unknown;
}

/** Accepts only one of the known speeds; anything else becomes the default. */
export function parseSowSpeed(raw: unknown): SowSpeed {
  return (SOW_SPEEDS as readonly unknown[]).includes(raw) ? (raw as SowSpeed) : DEFAULT_SOW_SPEED;
}

function readStored(): StoredSettings {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? (parsed as StoredSettings) : {};
  } catch {
    return {};
  }
}

export function loadSowSpeed(registry: Phaser.Data.DataManager): SowSpeed {
  const session: unknown = registry.get(REGISTRY_KEY);
  return parseSowSpeed(session ?? readStored().sowSpeed);
}

export function saveSowSpeed(registry: Phaser.Data.DataManager, speed: SowSpeed): void {
  registry.set(REGISTRY_KEY, speed);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ ...readStored(), sowSpeed: speed }));
  } catch {
    /* storage unavailable: the setting still holds for this session */
  }
}

/** The next speed in the cycle (in-game button / F key). */
export function nextSowSpeed(speed: SowSpeed): SowSpeed {
  return SOW_SPEEDS[(SOW_SPEEDS.indexOf(speed) + 1) % SOW_SPEEDS.length];
}
