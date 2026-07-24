/**
 * Every texture / animation / audio key used by the game, in one place.
 *
 * The current textures are generated at runtime (see placeholderTextures.ts).
 * When real assets arrive, load them in PreloadScene under these same keys and
 * nothing else has to change. See docs/ASSET_INTEGRATION.md.
 */
export const TEXTURES = {
  vampire: 'tex-vampire',
  hunter: 'tex-hunter',
  boss: 'tex-boss',
  blood: 'tex-blood',
  coffin: 'tex-coffin',
} as const;

/** Animation keys, reserved for future spritesheets. Not used by placeholders. */
export const ANIMS = {
  vampireIdle: 'anim-vampire-idle',
  vampireWalk: 'anim-vampire-walk',
  vampireAttack: 'anim-vampire-attack',
  hunterWalk: 'anim-hunter-walk',
  bossWalk: 'anim-boss-walk',
} as const;

/**
 * Audio keys. No audio files ship with the prototype; AudioSystem plays a key
 * only if something was actually loaded under it, so these are safe no-ops.
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
