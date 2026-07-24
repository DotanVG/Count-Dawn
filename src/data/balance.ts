/**
 * All prototype balance values live here. Tweak numbers in this file only —
 * gameplay code must not hardcode its own values.
 */

/** Shortens the night and accelerates the boss for quick testing. */
export const FAST_DEV_MODE = false;

export const NIGHT = {
  /** Full night length in seconds (short for fast playtest iterations). */
  durationSeconds: FAST_DEV_MODE ? 25 : 60,
  /** Boss spawns when this many seconds remain. */
  bossSpawnAtRemainingSeconds: FAST_DEV_MODE ? 15 : 25,
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
  /** Bloodlets scattered on death; each is worth BLOOD.dropletValue. */
  bloodDroplets: 5,
  spawnIntervalMs: 1250,
  maxAlive: 18,
  /** Hunters never spawn closer than this to the player. */
  minSpawnDistanceFromPlayer: 220,
  /** Within this range the hunter stops and swings his sword. */
  meleeRange: 72,
  meleeIntervalMs: 900,
} as const;

export const BOSS = {
  health: 350,
  contactDamage: 20,
  moveSpeed: 90,
} as const;

export const BLOOD = {
  target: 50,
  /** Each collected bloodlet is worth this much. */
  dropletValue: 1,
} as const;
