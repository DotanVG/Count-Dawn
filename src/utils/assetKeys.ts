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
export type CharacterKey = 'vampire' | 'hunter' | 'thrower';

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
 * Audio keys. No audio files ship yet; AudioSystem plays a key only if
 * something was actually loaded under it, so these are safe no-ops.
 */
export const AUDIO = {
  /** Menu-only theme (Noam) — played while on the main menu, stopped once the night starts. */
  menuTheme: 'menu-theme',
  /** Bat-form chirping loop, active only while the Count is transformed. */
  batSound1: 'bat_sound_1',
  playerAttack: 'sfx-player-attack',
  playerHurt: 'sfx-player-hurt',
  hunterDeath: 'sfx-hunter-death',
  bloodPickup: 'sfx-blood-pickup',
  bossAppear: 'sfx-boss-appear',
  finalSeconds: 'sfx-final-seconds',
  dawn: 'sfx-dawn',
  victory: 'sfx-victory',
  defeat: 'sfx-defeat',
} as const;
