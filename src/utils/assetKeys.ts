/**
 * Every texture / animation / audio key used by the game, in one place.
 * Character art: CraftPix free packs (see README credits). Frames are 64x64.
 */
export const TEXTURES = {
  // Vampire (player) sheets — rows: 0=down(front), 1=up(back), 2=left, 3=right
  vampireIdle: 'vampire-idle',
  vampireWalk: 'vampire-walk',
  vampireRun: 'vampire-run',
  vampireAttack: 'vampire-attack',
  /** Magic-burst overlay layer from the same attack sheet — used as a standalone hit-impact effect on the target, not on the player. */
  vampireAttackMagic: 'vampire-attack-magic',
  vampireHurt: 'vampire-hurt',
  vampireDeath: 'vampire-death',
  /**
   * The Priest (Romi's art) — one 2x4 sheet instead of a sheet per action:
   * two frames per direction is everything he has, so every animation he owns
   * is built from the same pair at a different rate (see animations.ts).
   */
  priest: 'priest',
  // Hunter (sword male) sheets — rows: 0=down(front), 1=left, 2=right, 3=up(back)
  hunterIdle: 'hunter-idle',
  hunterWalk: 'hunter-walk',
  hunterRun: 'hunter-run',
  hunterAttack: 'hunter-attack',
  hunterHurt: 'hunter-hurt',
  hunterDeath: 'hunter-death',
  // Garlic thrower (unarmed male) sheets — same pack/rows as the hunter, no attack sheet exists.
  throwerIdle: 'thrower-idle',
  throwerWalk: 'thrower-walk',
  throwerRun: 'thrower-run',
  throwerHurt: 'thrower-hurt',
  throwerDeath: 'thrower-death',
  /**
   * Romi's hunter weapons — held props, not spritesheets: one drawing each for
   * the spike and the pitchfork, two for the torch so its flame can flicker.
   * ArmedHunter parents them to a hunter's hand and swings them in code,
   * because the unarmed pack they are carried by has no attack sheet.
   */
  weaponSpike: 'weapon-spike',
  weaponPitchfork: 'weapon-pitchfork',
  weaponTorch1: 'weapon-torch-1',
  weaponTorch2: 'weapon-torch-2',
  // Environment
  tiles: 'castle-tiles',
  fire: 'fire-animation',
  objects: 'castle-objects',
  // UI
  cover: 'count-dawn-cover',
  // Props (Romi's art)
  coffinClosed: 'coffin-closed',
  coffinHalf: 'coffin-half',
  coffinOpen: 'coffin-open',
  /** Thrown by the garlic thrower once his target locks onto the Count. */
  garlic: 'garlic',
  /**
   * Bat form (Romi's art) — a 2-frame 64x64 flap. Replaces the vampire sprite
   * for the dash and the coffin fly-in/fly-out (see Player.setBatForm), and is
   * the sheet the future summonable bat minions will use too.
   *
   * Drawn facing RIGHT with no directional rows: mirror with flipX for left,
   * which is why there is no animKey('bat', ...) family — one animation,
   * ANIMS.batFly, covers every direction.
   */
  bat: 'bat',
  // Still runtime-generated placeholders
  blood: 'tex-blood',
  particle: 'tex-particle',
} as const;

export type Dir4 = 'down' | 'up' | 'left' | 'right';

/** Every character that has a set of directional animations registered. */
export type CharacterKey = 'vampire' | 'hunter' | 'thrower' | 'priest';

export type VampireAction = 'idle' | 'walk' | 'run' | 'attack' | 'hurt' | 'death';
export type HunterAction = 'idle' | 'walk' | 'run' | 'hurt' | 'death';

/** Directional animation key, e.g. animKey('vampire', 'walk', 'left'). */
export function animKey(character: CharacterKey, action: string, dir: Dir4): string {
  return `${character}-${action}-${dir}`;
}

export const ANIMS = {
  torch: 'torch-flame',
  /** One-shot magic burst spawned at a hunter's position when a strike lands. */
  hitMagic: 'hit-magic-burst',
  /**
   * The bat's wing flap. Used by Player.setBatForm for BOTH the coffin
   * fly-in/out and the dash — and by the bat minions when they land.
   */
  batFly: 'bat-fly',
} as const;

/**
 * Audio keys. One key per logical sound: the OGG and MP3 that ship for a key
 * are fallback encodings of the same track, not two sounds (see
 * data/audioManifest.ts, which owns the files, and docs/AUDIO.md). Keys with
 * no asset yet are safe no-ops — AudioDirector only plays what was loaded.
 */
export const AUDIO = {
  /** Noam's Main Title. Menu, cold open and every game-over screen. */
  mainTitle: 'music-main-title',
  /** Noam's Level Music. Starts the instant the first night hands over control. */
  levelMusic: 'music-level',
  /** Bat-form chirping loop, active only while the Count is transformed. */
  batSound1: 'sfx-bat-loop',
  /** Independent key for the 0.5s–1.5s dash excerpt of the bat loop. */
  batDashSound: 'sfx-bat-dash',
  coffinOpen: 'sfx-coffin-open',
  coffinClose: 'sfx-coffin-close',
  /** Noam's swing through the air. The whole sound of an attack. */
  playerAttackWhoosh: 'sfx-player-attack-whoosh',
  playerHurt: 'sfx-player-hurt',
  hunterDeath: 'sfx-hunter-death',
  /**
   * Noam's slurp — the Count drinking. Fires when a bloodlet lands on the
   * blood meter and counts, NOT when he swings: the swing is the whoosh, the
   * drink is the blood arriving.
   */
  bloodPickup: 'sfx-blood-pickup',
  bossAppear: 'sfx-boss-appear',
  finalSeconds: 'sfx-final-seconds',
  dawn: 'sfx-dawn',
  victory: 'sfx-victory',
  defeat: 'sfx-defeat',
} as const;
