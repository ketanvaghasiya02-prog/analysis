/**
 * Persisted application settings (Phase R12).
 *
 * A small, serialisable snapshot of the user-tunable analysis parameters,
 * stored in localStorage so they survive reloads.
 */

import { DEFAULT_BIN_SIZE } from '@/utils/histogram';
import {
  DEFAULT_RECOVERY_SETTINGS,
  type RecoverySettings,
} from '@/utils/recovery';

const STORAGE_KEY = 'mt5gm.settings.v1';

export interface PersistedSettings {
  gapBinSize: number;
  recoverySettings: RecoverySettings;
  slStep: number;
  defaultSessions: string[];
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  gapBinSize: DEFAULT_BIN_SIZE,
  recoverySettings: DEFAULT_RECOVERY_SETTINGS,
  slStep: 0.5,
  defaultSessions: [],
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Loads settings from localStorage, falling back to defaults on any problem. */
export function loadSettings(): PersistedSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    const rec: Partial<RecoverySettings> = parsed.recoverySettings ?? {};
    return {
      gapBinSize: isFiniteNumber(parsed.gapBinSize)
        ? parsed.gapBinSize
        : DEFAULT_SETTINGS.gapBinSize,
      recoverySettings: {
        step: isFiniteNumber(rec.step)
          ? rec.step
          : DEFAULT_RECOVERY_SETTINGS.step,
        minTargetGap: isFiniteNumber(rec.minTargetGap)
          ? rec.minTargetGap
          : DEFAULT_RECOVERY_SETTINGS.minTargetGap,
        minEventsPerZone: isFiniteNumber(rec.minEventsPerZone)
          ? rec.minEventsPerZone
          : DEFAULT_RECOVERY_SETTINGS.minEventsPerZone,
      },
      slStep: isFiniteNumber(parsed.slStep)
        ? parsed.slStep
        : DEFAULT_SETTINGS.slStep,
      defaultSessions: Array.isArray(parsed.defaultSessions)
        ? parsed.defaultSessions.filter((s): s is string => typeof s === 'string')
        : [],
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Persists settings to localStorage (best-effort). */
export function saveSettings(settings: PersistedSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable — ignore */
  }
}
