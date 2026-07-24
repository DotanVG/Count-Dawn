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
  vampireHurt: 'vampire-hurt',
  vampireDeath: 'vampire-death',
  // Hunter (sword male) sheets — rows: 0=down(front), 1=left, 2=right, 3=up(back)
  hunterIdle: 'hunter-idle',
  hunterWalk: 'hunter-walk',
  hunterRun: 'hunter-run',
  hunterAttack: 'hunter-attack',
  hunterHurt: 'hunter-hurt',
  hunterDeath: 'hunter-death',
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
  /** Future throwable weapon of the stationary hunter type — loaded, unused yet. */
  garlic: 'garlic',
  /**
   * BAT PLACEHOLDER: future bat spritesheet. Will replace the vampire sprite
   * during the coffin fly-in/fly-out (see GameScene.setBatForm) and power the
   * summonable bat minions that draw hunter aggro.
   */
  bat: 'bat',
  // Still runtime-generated placeholders
  blood: 'tex-blood',
  particle: 'tex-particle',
} as const;

export type Dir4 = 'down' | 'up' | 'left' | 'right';

export type VampireAction = 'idle' | 'walk' | 'run' | 'attack' | 'hurt' | 'death';
export type HunterAction = 'idle' | 'walk' | 'run' | 'hurt' | 'death';

/** Directional animation key, e.g. animKey('vampire', 'walk', 'left'). */
export function animKey(character: 'vampire' | 'hunter', action: string, dir: Dir4): string {
  return `${character}-${action}-${dir}`;
}

export const ANIMS = {
  torch: 'torch-flame',
  /** BAT PLACEHOLDER: register from the bat sheet when it lands. */
  batFly: 'bat-fly',
} as const;

/**
 * Audio keys. No audio files ship yet; AudioSystem plays a key only if
 * something was actually loaded under it, so these are safe no-ops.
 */
export const AUDIO = {
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
