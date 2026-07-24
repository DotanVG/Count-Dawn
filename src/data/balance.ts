/**
 * All prototype balance values live here. Tweak numbers in this file only —
 * gameplay code must not hardcode its own values.
 */

/** Shortens the night and accelerates the boss for quick testing. */
export const FAST_DEV_MODE = false;

export const NIGHT = {
  /** Full night length in seconds. */
  durationSeconds: FAST_DEV_MODE ? 30 : 120,
  /** Boss spawns when this many seconds remain. */
  bossSpawnAtRemainingSeconds: FAST_DEV_MODE ? 20 : 30,
  /** Timer turns urgent when this many seconds remain. */
  finalWarningSeconds: 10,
} as const;

export const PLAYER = {
  maxHealth: 100,
  /** World units per second. */
  moveSpeed: 300,
  attackDamage: 25,
  attackCooldownMs: 350,
  attackRange: 90,
  /** Half-angle of the melee arc, in degrees, around the aim direction. */
  attackArcHalfAngleDeg: 55,
  invulnerabilityMs: 600,
} as const;

export const HUNTER = {
  health: 50,
  contactDamage: 10,
  moveSpeed: 110,
  bloodDrop: 10,
  spawnIntervalMs: 1250,
  maxAlive: 18,
  /** Hunters never spawn closer than this to the player. */
  minSpawnDistanceFromPlayer: 220,
} as const;

export const BOSS = {
  health: 350,
  contactDamage: 20,
  moveSpeed: 90,
} as const;

export const BLOOD = {
  target: 100,
} as const;
