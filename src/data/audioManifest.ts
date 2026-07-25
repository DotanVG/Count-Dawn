// Explicit .ts extensions so Node can run this module directly in unit tests.
import { AUDIO } from '../utils/assetKeys.ts';

export type AudioGroup = 'music' | 'sfx';

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
    defaultVolume: 0.7,
  },
  {
    key: AUDIO.playerAttackSlurp,
    label: 'Player Attack SLURP',
    group: 'sfx',
    files: [
      'assets/audio/sfx/player-attack-slurp.ogg',
      'assets/audio/sfx/player-attack-slurp.mp3',
    ],
    defaultVolume: 0.6,
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
    defaultVolume: 0.8,
  },
  // Reserved keys — the call sites already exist, the sounds do not yet.
  { key: AUDIO.playerHurt, label: 'Player Hurt', group: 'sfx', files: [], defaultVolume: 0.8 },
  { key: AUDIO.hunterDeath, label: 'Hunter Death', group: 'sfx', files: [], defaultVolume: 0.7 },
  { key: AUDIO.bloodPickup, label: 'Blood Pickup', group: 'sfx', files: [], defaultVolume: 0.6 },
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
