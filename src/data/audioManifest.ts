// Explicit .ts extensions so Node can run this module directly in unit tests.
import { AUDIO } from '../utils/assetKeys.ts';

export type AudioGroup = 'music' | 'sfx';

/**
 * Per-play randomisation, so a sound fired over and over from one file does
 * not read as a copy-paste. Everything here modifies ONE recording at
 * playback time — no extra assets, and Noam's file itself is never altered.
 */
export interface SfxVariance {
  /** Pitch spread in cents, applied as ±this on every play. 100 = a semitone. */
  detuneCents?: number;
  /** Level spread as a fraction of the balanced volume, applied as ±this. */
  volumeJitter?: number;
  /**
   * Chance, 0..1, that a play uses a reversed copy of the same buffer. The
   * reversal is built once, in memory, the first time it is needed.
   */
  reverseChance?: number;
}

export interface AudioAsset {
  /** The single Phaser key the game plays. Never format-specific. */
  key: string;
  /** Human label, used by the audio balance editor. */
  label: string;
  group: AudioGroup;
  /**
   * Runtime encodings of this ONE sound, best format first. Phaser hands the
   * list to the browser and keeps the first format it can decode — the MP3 is
   * a fallback for the OGG, never a second layer. An empty list means the key
   * is reserved but nothing ships for it yet: playing it is a silent no-op.
   */
  files: readonly string[];
  /** Individual level, 0..1, before the group fader and the master fader. */
  defaultVolume: number;
  /** Optional per-play randomisation; omitted means "play it straight". */
  variance?: SfxVariance;
}

/**
 * Every sound the game knows about, in one place. PreloadScene loads from
 * this list, the default balance is derived from it, and the audio balance
 * editor builds its rows from it — so a new track or effect is one entry
 * here plus (optionally) the call site that plays it.
 */
export const AUDIO_MANIFEST: readonly AudioAsset[] = [
  {
    key: AUDIO.mainTitle,
    label: 'Main Title',
    group: 'music',
    files: ['assets/audio/music/main-title.ogg', 'assets/audio/music/main-title.mp3'],
    defaultVolume: 0.5,
  },
  {
    key: AUDIO.levelMusic,
    label: 'Level Music',
    group: 'music',
    files: ['assets/audio/music/count-dawn-level.ogg', 'assets/audio/music/count-dawn-level.mp3'],
    defaultVolume: 0.5,
  },
  {
    key: AUDIO.playerAttackWhoosh,
    label: 'Player Attack WOOSH',
    group: 'sfx',
    files: [
      'assets/audio/sfx/player-attack-whoosh.ogg',
      'assets/audio/sfx/player-attack-whoosh.mp3',
    ],
    defaultVolume: 0.4,
    // Fired up to three times a second on a held attack, so one unvaried
    // 0.16s file turns into a rattle fast. Roughly ±2 semitones of pitch,
    // a little level movement, and a third of swings played backwards —
    // enough that consecutive hits stop sounding stamped out.
    variance: { detuneCents: 220, volumeJitter: 0.18, reverseChance: 0.33 },
  },
  {
    key: AUDIO.bloodPickup,
    label: 'Blood Pickup SLURP',
    group: 'sfx',
    files: ['assets/audio/sfx/blood-pickup-slurp.ogg', 'assets/audio/sfx/blood-pickup-slurp.mp3'],
    // Carried over from the balancing pass this sound had as an attack layer.
    // It now fires per bloodlet rather than per swing, so it is the first
    // slider to reach for if a five-droplet kill reads as too much.
    defaultVolume: 1,
  },
  {
    key: AUDIO.batSound1,
    label: 'Bat Form Loop',
    group: 'sfx',
    files: ['assets/audio/sfx/bat-sound-1.mp3'],
    defaultVolume: 0.6,
  },
  {
    key: AUDIO.batDashSound,
    label: 'Bat Dash',
    group: 'sfx',
    files: ['assets/audio/sfx/bat-sound-1.mp3'],
    defaultVolume: 0.6,
  },
  {
    key: AUDIO.coffinOpen,
    label: 'Coffin Open',
    group: 'sfx',
    files: ['assets/audio/sfx/coffin-open.mp3'],
    defaultVolume: 0.8,
  },
  {
    key: AUDIO.coffinClose,
    label: 'Coffin Close',
    group: 'sfx',
    files: ['assets/audio/sfx/coffin-close.mp3'],
    // Quieter than the open: the lid shutting is a settle, not an event.
    defaultVolume: 0.6,
  },
  // Reserved keys — the call sites already exist, the sounds do not yet.
  { key: AUDIO.playerHurt, label: 'Player Hurt', group: 'sfx', files: [], defaultVolume: 0.8 },
  { key: AUDIO.hunterDeath, label: 'Hunter Death', group: 'sfx', files: [], defaultVolume: 0.7 },
  { key: AUDIO.bossAppear, label: 'Boss Appearance', group: 'sfx', files: [], defaultVolume: 0.8 },
  { key: AUDIO.finalSeconds, label: 'Final Seconds', group: 'sfx', files: [], defaultVolume: 0.8 },
  { key: AUDIO.dawn, label: 'Dawn', group: 'sfx', files: [], defaultVolume: 0.8 },
  { key: AUDIO.victory, label: 'Victory', group: 'sfx', files: [], defaultVolume: 0.8 },
  { key: AUDIO.defeat, label: 'Defeat', group: 'sfx', files: [], defaultVolume: 0.8 },
];

export const MUSIC_ASSETS: readonly AudioAsset[] = AUDIO_MANIFEST.filter(
  (asset) => asset.group === 'music',
);

export const SFX_ASSETS: readonly AudioAsset[] = AUDIO_MANIFEST.filter(
  (asset) => asset.group === 'sfx',
);

export function audioAsset(key: string): AudioAsset | undefined {
  return AUDIO_MANIFEST.find((asset) => asset.key === key);
}

/** Unknown keys are treated as SFX: the safer of the two group faders. */
export function audioGroupOf(key: string): AudioGroup {
  return audioAsset(key)?.group ?? 'sfx';
}

// ── Variance math ────────────────────────────────────────────────────────
// Pure, and each takes its own roll in [0, 1) rather than calling Math.random
// itself, so the spread is unit-testable at its edges instead of by sampling.

/** Maps a roll onto the symmetric range [-spread, +spread]. */
function spread(roll: number, amount: number): number {
  return (roll * 2 - 1) * amount;
}

export function variedVolume(
  base: number,
  variance: SfxVariance | undefined,
  roll: number,
): number {
  const jitter = variance?.volumeJitter;
  if (!jitter) return base;
  // Clamped, because the top of the jitter must never push a sound past the
  // level the balance editor says is its maximum.
  return Math.min(1, Math.max(0, base * (1 + spread(roll, jitter))));
}

export function variedDetune(variance: SfxVariance | undefined, roll: number): number {
  const cents = variance?.detuneCents;
  if (!cents) return 0;
  return spread(roll, cents);
}

export function shouldReverse(variance: SfxVariance | undefined, roll: number): boolean {
  const chance = variance?.reverseChance;
  if (!chance) return false;
  return roll < chance;
}
