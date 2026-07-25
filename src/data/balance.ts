/**
 * All prototype balance values live here. Tweak numbers in this file only —
 * gameplay code must not hardcode its own values.
 */

/** Shortens the night for quick testing. */
export const FAST_DEV_MODE = false;

export const NIGHT = {
  /** Full night length in seconds (short for fast playtest iterations). */
  durationSeconds: FAST_DEV_MODE ? 25 : 60,
  /** Timer turns urgent when this many seconds remain. */
  finalWarningSeconds: 10,
} as const;

export const PLAYER = {
  maxHealth: 100,
  /** World units per second. */
  moveSpeed: 300,
  attackDamage: 25,
  attackCooldownMs: 350,
  attackRange: 115,
  /** Half-angle of the melee arc, in degrees, around the aim direction. */
  attackArcHalfAngleDeg: 55,
  invulnerabilityMs: 600,
  /** Display scale — deliberately larger than the Captain: the Count IS the boss. */
  spriteScale: 3.4,
} as const;

/**
 * Bat dash: a short burst of speed used to break out of a crowd or dodge a
 * locked-on garlic throw. Invulnerable for slightly longer than the burst
 * itself so the escape reads as clean rather than "dodged and still got hit".
 */
export const DASH = {
  speed: 980,
  durationMs: 175,
  /** Invulnerability window, measured from the start of the dash. */
  invulnerabilityMs: 280,
  cooldownMs: 1100,
  /** Fading after-images left behind, spaced over the dash duration. */
  afterimages: 5,
} as const;

/**
 * Bat form — the shape the Count wears for the dash and the coffin flights,
 * and (later) for the summonable minions. Romi's frames are drawn nearly
 * frame-filling, so the sprite renders at a fraction of whatever scale the
 * Count is currently at rather than at his full size; see Player.setBaseScale.
 */
export const BAT = {
  /** Multiplier on the Count's display scale while he is a bat. */
  scaleFactor: 0.3,
  flapFrames: 2,
  flapFrameRate: 12,
  /** Smoke motes in the *poof* burst on each transformation. */
  puffParticles: 18,
} as const;

/**
 * Knockback applied to whatever the Count hits, so a landed strike visibly
 * shoves the target instead of only flashing it white.
 */
export const KNOCKBACK = {
  /** Initial shove speed; decays linearly to 0 over durationMs. */
  speed: 520,
  durationMs: 200,
  /** Multiplier on the shove for heavier enemies (see Hunter.knockbackResistance). */
  bossFactor: 0.35,
} as const;

/**
 * The garlic thrower: an unarmed hunter that keeps his distance, paints a
 * glowing target that crawls from his feet onto the Count, and once it holds
 * a lock, lobs garlic at where the lock landed.
 */
export const THROWER = {
  health: 35,
  contactDamage: 5,
  moveSpeed: 78,
  bloodDroplets: 4,
  spriteScale: 2,
  /** Fraction of regular spawns replaced by a thrower, while under the cap. */
  spawnChance: 0.35,
  /** Throwers only start showing up from this night on. */
  firstNight: 1,
  /** Night 1 allows one, night 2 two, and so on until the global cap. */
  maxAlivePerNight: 1,
  /** Includes garlic-throwing Captains as well as ordinary throwers. */
  maxAlive: 5,
  /** Preferred standoff band: he closes in past the far edge, backs off inside the near edge. */
  minStandoff: 240,
  maxStandoff: 420,
  /** Pause between finishing one throw (or giving up) and painting a new target. */
  aimCooldownMs: 2200,
  /** How fast the painted target crawls toward the player, world units/sec. */
  targetSpeed: 300,
  /** The target counts as "on" the player within this radius. */
  lockRadius: 34,
  /**
   * Shrinks the drawn crosshair without touching lockRadius, so the target
   * reads as less of a blot on screen while the throw stays exactly as hard
   * to dodge as it was.
   */
  targetDrawScale: 0.8,
  /** Uninterrupted time the target must stay on the player to lock. */
  lockHoldMs: 500,
  /** Give up and reset if no lock happens within this long. */
  maxTrackMs: 4500,
  /** Wind-up between the lock completing and the garlic leaving his hand. */
  throwWindupMs: 260,
  garlicDamage: 5,
  garlicSpeed: 460,
  /** Radius of the splash when the garlic lands on its target point. */
  garlicSplashRadius: 46,
  /** Display scale of the thrown bulb (192px source art). */
  garlicScale: 0.2,
  /** The bulb carried in his hand — smaller still, it has to fit a fist. */
  garlicHeldScale: 0.12,
} as const;

export const HUNTER = {
  health: 50,
  /** Every regular hit — sword or garlic — costs the same 5 HP. */
  contactDamage: 5,
  moveSpeed: 110,
  /** Bloodlets scattered on death; each is worth BLOOD.dropletValue. */
  bloodDroplets: 5,
  spawnIntervalMs: 1250,
  maxAlive: 18,
  /** Hunters never spawn closer than this to the player. */
  minSpawnDistanceFromPlayer: 220,
  /** Within this range the hunter stops and swings his sword. */
  meleeRange: 85,
  meleeIntervalMs: 900,
  /** Delay from swing start to the damage moment (mid-animation). */
  meleeHitDelayMs: 340,
  /** The swing lands if the target is still within meleeRange * this factor. */
  meleeHitReachFactor: 1.35,
  spriteScale: 2,
  /** Each new night adds this many simultaneous hunters. */
  maxAlivePerNight: 2,
  /** Each new night shortens the spawn delay by this many milliseconds. */
  spawnIntervalDecreasePerNightMs: 75,
  /** Prevents later nights from turning the spawner into a solid stream. */
  minimumSpawnIntervalMs: 650,
} as const;

/**
 * Hunters carrying one of Romi's three weapons. They are drawn from the same
 * unarmed pool as the garlic throwers — the base pack has no attack sheet for
 * it — so the swing is animated on the PROP rather than on the body (see
 * ArmedHunter). Every one of them still hits for the flat 5: what a weapon
 * changes is reach, cadence and how far you have to stay back, never damage.
 */
export const ARMED = {
  health: 45,
  contactDamage: 5,
  moveSpeed: 105,
  bloodDroplets: 5,
  spriteScale: 2,
  /** Fraction of the melee spawns that arrive carrying a weapon. */
  spawnChance: 0.45,
  /**
   * Display scale of the 64px prop, relative to the hunter's own scale. Romi
   * drew the weapons nearly frame-filling and the hunters are a small 64px
   * character inside a mostly empty frame, so a prop at his scale towers over
   * him — this is what puts a spike back in a man's hand rather than a totem
   * pole beside him.
   */
  propScale: 0.38,
} as const;

/**
 * Per-weapon feel. `reach` multiplies the hunter's melee range — the pitchfork
 * genuinely outranges an arm, which is the whole point of carrying one — and
 * `firstNight` staggers the three so the hall gains one new silhouette at a
 * time instead of all three on night one.
 */
export const WEAPONS = {
  spike: {
    firstNight: 1,
    reach: 0.95,
    intervalMs: 720,
    hitDelayMs: 240,
    swingMs: 180,
    motion: 'thrust',
  },
  pitchfork: {
    firstNight: 2,
    reach: 1.45,
    intervalMs: 1050,
    hitDelayMs: 380,
    swingMs: 280,
    motion: 'thrust',
  },
  torch: {
    firstNight: 3,
    reach: 1.15,
    intervalMs: 900,
    hitDelayMs: 320,
    swingMs: 240,
    motion: 'chop',
  },
} as const;

export type WeaponKind = keyof typeof WEAPONS;

/** Which of Romi's weapons have shown up by a given night. */
export function weaponsForNight(night: number): WeaponKind[] {
  return (Object.keys(WEAPONS) as WeaponKind[]).filter(
    (kind) => night >= WEAPONS[kind].firstNight,
  );
}

export const BOSS = {
  health: 350,
  /** Double a regular hunter's hit — the mini-boss is the one that really hurts. */
  contactDamage: 10,
  moveSpeed: 90,
  /** Bigger than his men, smaller than the Count. */
  spriteScale: 2.8,
  /** One extra Captain joins the squad every five nights. */
  nightsPerExtraCaptain: 5,
  /** Each Captain independently has this chance to be a garlic thrower. */
  garlicCaptainChance: 0.5,
  /** Delay between a garlic Captain's two throws; the target keeps tracking. */
  garlicThrowGapMs: 180,
} as const;

export const BLOOD = {
  target: 50,
  /** Additional blood required for every night after the first. */
  targetIncreasePerNight: 15,
  /** Each collected bloodlet is worth this much. */
  dropletValue: 1,
  /**
   * Bloodlets within this distance of the Count are drawn in, without needing
   * a physics overlap. Belt and braces for droplets that end up somewhere the
   * Count's body cannot reach - tight against a wall, or outside the hall
   * entirely - so blood he earned is never stranded.
   */
  magnetRadius: 74,
  /**
   * HP restored per unit of blood collected after the meter is already full.
   * Drinking past the quota tops the Count up instead of being thrown away -
   * deliberately less than a point each, so topping off a health bar takes a
   * real pile of corpses rather than one unlucky hunter.
   */
  overflowHealPerBlood: 0.5,
} as const;

export function bloodTargetForNight(night: number): number {
  return BLOOD.target + Math.max(0, night - 1) * BLOOD.targetIncreasePerNight;
}

export function hunterPressureForNight(night: number): { spawnIntervalMs: number; maxAlive: number } {
  const increases = Math.max(0, night - 1);
  return {
    spawnIntervalMs: Math.max(
      HUNTER.minimumSpawnIntervalMs,
      HUNTER.spawnIntervalMs - increases * HUNTER.spawnIntervalDecreasePerNightMs,
    ),
    maxAlive: HUNTER.maxAlive + increases * HUNTER.maxAlivePerNight,
  };
}

/** Night 1-4: one Captain; 5-9: two; 10-14: three; and so on. */
export function captainCountForNight(night: number): number {
  return 1 + Math.floor(Math.max(0, night) / BOSS.nightsPerExtraCaptain);
}

/** Ranged pressure grows by night, but all thrower flavours share a hard cap. */
export function throwerCapForNight(night: number): number {
  return Math.min(
    THROWER.maxAlive,
    Math.max(0, night) * THROWER.maxAlivePerNight,
  );
}
