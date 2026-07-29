// Explicit .ts extensions so Node can run this module directly in unit tests.
import { AUDIO_MANIFEST, audioGroupOf } from './audioManifest.ts';

/**
 * The one place volume numbers live. Scene code asks for a track or a cue;
 * AudioDirector applies this balance. Nothing else should carry a literal
 * volume.
 *
 * Effective level:
 *   music = master * music  * assets[key]
 *   sfx   = master * sfx    * assets[key]
 *
 * every factor and the product clamped to 0..1.
 */
export interface AudioBalanceConfig {
  master: number;
  music: number;
  sfx: number;
  /** "Mute all" from the audio balance editor; applied as the global mute. */
  muted: boolean;
  /** Player-facing soundtrack toggle. Kept separate from SFX on purpose. */
  musicMuted: boolean;
  /** Player-facing sound-effects toggle. Kept separate from music on purpose. */
  sfxMuted: boolean;
  /** Per-key level, 0..1, keyed by the Phaser audio key. */
  assets: Record<string, number>;
}

/** Versioned so a future balance shape can be introduced without migrations. */
export const AUDIO_BALANCE_STORAGE_KEY = 'count-dawn-audio-balance-v1';

export const DEFAULT_AUDIO_BALANCE: AudioBalanceConfig = {
  master: 1,
  music: 0.7,
  sfx: 0.8,
  muted: false,
  musicMuted: false,
  sfxMuted: false,
  assets: Object.fromEntries(AUDIO_MANIFEST.map((asset) => [asset.key, asset.defaultVolume])),
};

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Individual level for a key, falling back to its manifest default. */
export function assetVolume(balance: AudioBalanceConfig, key: string): number {
  const stored = balance.assets[key];
  if (typeof stored === 'number') return clamp01(stored);
  return clamp01(DEFAULT_AUDIO_BALANCE.assets[key] ?? 1);
}

export function effectiveMusicVolume(balance: AudioBalanceConfig, key: string): number {
  if (balance.muted || balance.musicMuted) return 0;
  return clamp01(clamp01(balance.master) * clamp01(balance.music) * assetVolume(balance, key));
}

export function effectiveSfxVolume(balance: AudioBalanceConfig, key: string): number {
  if (balance.muted || balance.sfxMuted) return 0;
  return clamp01(clamp01(balance.master) * clamp01(balance.sfx) * assetVolume(balance, key));
}

/** Routes a key through its own group fader, so callers never pick one. */
export function effectiveVolume(balance: AudioBalanceConfig, key: string): number {
  return audioGroupOf(key) === 'music'
    ? effectiveMusicVolume(balance, key)
    : effectiveSfxVolume(balance, key);
}

function readNumber(source: Record<string, unknown>, field: string, fallback: number): number {
  const value = source[field];
  return typeof value === 'number' && Number.isFinite(value) ? clamp01(value) : fallback;
}

/**
 * Turns anything that came out of localStorage into a usable config. Saved
 * data written by an older build, hand-edited, or half-corrupt falls back
 * field by field — a bad `master` never costs you the per-asset levels, and
 * a key the save has never heard of takes its manifest default.
 */
export function normalizeBalance(raw: unknown): AudioBalanceConfig {
  const defaults = DEFAULT_AUDIO_BALANCE;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...defaults, assets: { ...defaults.assets } };
  }

  const source = raw as Record<string, unknown>;
  const savedAssets =
    typeof source.assets === 'object' && source.assets !== null && !Array.isArray(source.assets)
      ? (source.assets as Record<string, unknown>)
      : {};

  const assets: Record<string, number> = { ...defaults.assets };
  for (const key of Object.keys(assets)) {
    const value = savedAssets[key];
    if (typeof value === 'number' && Number.isFinite(value)) assets[key] = clamp01(value);
  }

  return {
    master: readNumber(source, 'master', defaults.master),
    music: readNumber(source, 'music', defaults.music),
    sfx: readNumber(source, 'sfx', defaults.sfx),
    muted: typeof source.muted === 'boolean' ? source.muted : defaults.muted,
    // A save from before the split only has `muted`. Carry that choice into
    // both channels so an existing "mute all" preference stays respected.
    musicMuted:
      typeof source.musicMuted === 'boolean'
        ? source.musicMuted
        : typeof source.muted === 'boolean'
          ? source.muted
          : defaults.musicMuted,
    sfxMuted:
      typeof source.sfxMuted === 'boolean'
        ? source.sfxMuted
        : typeof source.muted === 'boolean'
          ? source.muted
          : defaults.sfxMuted,
    assets,
  };
}
