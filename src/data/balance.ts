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
  /**
   * Display scale — deliberately larger than the Captain: the Count IS the
   * boss. A lower number than the pack he replaced used, for a Count who
   * renders BIGGER: Romi drew him filling far more of the 64px frame.
   * Nudged down slightly (and every human nudged up to match) to close the
   * gap between him and the crowd a touch.
   */
  spriteScale: 2.3,
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
const BAT_SCALE_FACTOR = 0.3;

export const BAT = {
  /** Multiplier on the Count's display scale while he is a bat. */
  scaleFactor: BAT_SCALE_FACTOR,
  /** Exact rendered scale of the Count's bat during a normal gameplay dash. */
  dashRenderScale: PLAYER.spriteScale * BAT_SCALE_FACTOR,
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
  /** Nudged up slightly to close the gap with the Count (see PLAYER.spriteScale). */
  spriteScale: 1.6,
  /** Fraction of regular spawns replaced by a thrower, while under the cap. */
  spawnChance: 0.35,
  /**
   * Throwers only start showing up from this night on. Night one is every
   * MELEE flavour at once — sword, spike, pitchfork, torch — and no ranged
   * pressure at all, so the first night teaches the crowd before it teaches
   * the crosshair.
   */
  firstNight: 2,
  /** Night 2 allows one, night 3 two — always one fewer than the night. */
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

/**
 * The gold crosses the huntress Captain throws like shuriken. Unlike a garlic
 * bulb, which is lobbed at the point the crosshair locked and splashes there, a
 * cross keeps going along the line it was thrown on — so it is dodged sideways
 * rather than backwards, and the fan is what stops standing still from working.
 *
 * Damage stays on the flat economy at 5. What a cross buys over a bulb is that
 * three of them arrive at once across a wedge.
 */
export const CROSS = {
  damage: 5,
  speed: 520,
  /** Crosses per volley, thrown in a fan. */
  perVolley: 3,
  /** Beat between them; short enough that the fan reads as one attack. */
  volleyGapMs: 110,
  /** Half-angle of the fan, in radians, around the locked line. */
  spread: 0.22,
  /** Display scale of the 64px prop. */
  scale: 0.5,
  /** Body radius in unscaled texture pixels — the arms are not the hitbox. */
  bodyRadius: 11,
  /** Whole turns it makes over its life. */
  spins: 3,
  /** How long it flies before giving up, if it never leaves the hall. */
  lifetimeMs: 2200,
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
  /**
   * Romi's hunters stand ~31 of the 64px frame tall where the bought pack filled
   * ~21, so this comes DOWN and they still render BIGGER: about 48px against the
   * old 44. Every one of her humans shares this geometry, so the Captains'
   * scale below is the same number times a boss multiplier.
   * Nudged up slightly to close the gap with the Count (see PLAYER.spriteScale).
   */
  spriteScale: 1.6,
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
  /** Nudged up slightly to close the gap with the Count (see PLAYER.spriteScale). */
  spriteScale: 1.6,
  /** Fraction of the melee spawns that arrive carrying a weapon. */
  spawnChance: 0.45,
} as const;

/**
 * Per-weapon feel. `reach` multiplies the hunter's melee range — the pitchfork
 * genuinely outranges an arm, which is the whole point of carrying one. All
 * three are on the table from night one; the garlic thrower is the only
 * flavour held back (see THROWER.firstNight).
 *
 * `scale` is the prop's display scale relative to the hunter's own. Romi drew
 * all three nearly frame-filling and at roughly the same length, but they are
 * not the same object: a hand-whittled stake is a forearm, a pitchfork is a
 * two-handed farm tool taller than the man holding it.
 *
 * `gripY` is where along the prop his fist closes, as a fraction of the source
 * frame. A stake and a torch are held at the very bottom; a pitchfork is held
 * partway UP the shaft, which is what leaves its butt end sticking out behind
 * him and makes it read as carried rather than balanced on a palm.
 *
 * `motion` is the real difference in how they read. A `thrust` keeps the point
 * on the target for the whole strike and drives it in — a stab. A `chop`
 * sweeps the head through an arc and carries past. Only the torch chops;
 * swinging a stake like a club is exactly what it should not look like.
 */
export const WEAPONS = {
  spike: {
    firstNight: 1,
    scale: 0.34,
    gripY: 0.92,
    reach: 0.95,
    intervalMs: 720,
    hitDelayMs: 240,
    swingMs: 180,
    motion: 'thrust',
  },
  pitchfork: {
    firstNight: 1,
    scale: 0.63,
    gripY: 0.72,
    reach: 1.45,
    intervalMs: 1050,
    hitDelayMs: 380,
    swingMs: 280,
    motion: 'thrust',
  },
  torch: {
    firstNight: 1,
    scale: 0.4,
    gripY: 0.92,
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
  /**
   * Bigger than his men, smaller than the Count and than the Priest.
   * Nudged up slightly to close the gap with the Count (see PLAYER.spriteScale).
   */
  spriteScale: 2.25,
  /** One extra Captain joins the squad every five nights. */
  nightsPerExtraCaptain: 5,
  /** Each Captain independently has this chance to be a garlic thrower. */
  garlicCaptainChance: 0.5,
  /** Delay between a garlic Captain's two throws; the target keeps tracking. */
  garlicThrowGapMs: 180,
  /**
   * A mini-boss kill floods the floor with blood — five times a regular
   * hunter's HUNTER.bloodDroplets. A Captain only ever dies after the meter is
   * already full (bosses do not spawn until it is), so every one of these is
   * guaranteed overflow: it either tops off the Count's health or, once that
   * is full too, fills the Wrath meter (see WRATH).
   */
  bloodDroplets: 25,
} as const;

/**
 * The Priest (Romi's art): the boss the fifth night sends instead of the
 * Captains. He is slower and shorter-reaching than a Captain but tougher, and
 * he does not only swing his stake — every few seconds he plants his feet,
 * raises the cross and drives out an expanding ring of holy light. The ring is
 * telegraphed on the floor for most of a second before it goes off, so it is
 * beaten by walking out of it or, once it is already coming, by dashing
 * through it in bat form.
 */
export const PRIEST = {
  health: 420,
  /** Same heavy hit as a Captain — the ward is what makes him different. */
  contactDamage: 10,
  moveSpeed: 76,
  /**
   * Romi drew him nearly frame-filling where the CraftPix men sit small inside
   * theirs, so this is a much lower number than BOSS.spriteScale for a sprite
   * that renders BIGGER: about 77px tall against a Captain's 62.
   * Nudged up slightly to close the gap with the Count (see PLAYER.spriteScale).
   */
  spriteScale: 2.05,
  /** Priests turn up on this night and every multiple of it. */
  everyNights: 5,
  /** Beat between wards, measured from the end of the last one. */
  wardIntervalMs: 5400,
  /** He will not start a ward unless the Count is at least this close. */
  wardRange: 470,
  /** Telegraph: the full circle is painted on the floor for this long first. */
  wardWindupMs: 700,
  /** How long the light takes to sweep out to its full radius. */
  wardExpandMs: 620,
  wardRadius: 250,
  wardDamage: 10,
  /**
   * Rings in the sweep. Only the FIRST one is the attack — it carries the
   * damage edge; the rest are staggered behind it in paler golds so the ward
   * lands like ripples on water rather than as one flat hoop.
   */
  wardRipples: 3,
  wardRippleDelayMs: 120,
  /**
   * The cross that rises out of the circle with the light: it grows past the
   * ward's own radius by this factor and lingers this much longer than the
   * rings, so the last thing left on screen is the shape of the thing that
   * just burned him.
   */
  crossOvershoot: 1.35,
  crossLingerMs: 420,
  /**
   * How long after the light starts sweeping the cross begins to rise. Small,
   * but it is the difference between the ring and the cross opening out as one
   * shape and the cross coming up THROUGH the ring.
   */
  crossRiseDelayMs: 150,
  /**
   * Heavier than a Captain's flood, since a Priest night only ever sends one
   * (or one plus a smaller Captain escort) — see bossLineupForNight.
   */
  bloodDroplets: 30,
} as const;

/**
 * The Wrath meter: a third bar, between the health and blood bars, that fills
 * from blood the Count has no use for — overflow that arrives while HP is
 * ALREADY full (see GameScene.hopBloodToHealth) plus whatever is left over
 * from the overnight top-off (see GameScene.playVictoryOutro). A full meter
 * spends itself on one Ultimate: a bolt of lightning that kills everything
 * still standing in the hall, a swarm of bats, and a screen-wide accompanying
 * darkening — Player.playSpecialAttackAnim carries the pose.
 *
 * `target` is a first estimate, not a measured one: a Captain only ever dies
 * once the blood meter is already full (bosses do not spawn before then), so
 * BOSS.bloodDroplets/PRIEST.bloodDroplets landing as overflow is the main way
 * this fills. At 25-30 blood per mini-boss against a target of 60, roughly
 * two Captain kills (or one Priest night) earns a charge — tune this once
 * real run totals are in.
 */
export const WRATH = {
  /** Raised from 60 and slowed down (see bloodPerPoint) — the first pass filled too easily. */
  target: 100,
  /**
   * Blood spent per point of Wrath gained. 2, matching the round's own
   * overflow-to-HP rate (BLOOD.overflowHealPerBlood) rather than a straight
   * 1-for-1 — Wrath is meant to feel earned across several mini-boss kills,
   * not handed over by the first one.
   */
  bloodPerPoint: 2,
  /** Bats spawned for the Ultimate's swarm. */
  batCount: 30,
  /** How long the lightning + bat swarm hold the screen. */
  durationMs: 2600,
  /** Screen darkens by this much for the duration — noticeably dimmer, nowhere near the pause menu's black. */
  screenDarkenAlpha: 0.18,
} as const;

/**
 * The main menu's title gag: the cover rests on COUNT DAWN, lightning cuts it
 * to COUNT DOWN — the jam theme — for a much shorter beat, and another strike
 * puts it back. Both windows are ranges rather than fixed numbers so the menu
 * never settles into a metronome. See ui/MenuLightning.ts.
 */
export const MENU_LIGHTNING = {
  /** The real title holds this long (ms, randomised) between strikes. */
  restMs: [3000, 5000],
  /** The punchline holds a fraction of that — it is a flash of a joke. */
  punchlineMs: [500, 2000],
  /** Gap between the hard frames inside one strike. */
  beatMs: 55,
  /** Peak whiteout over the whole menu on the strike's first frame. */
  flashAlpha: 0.55,
  flashFadeMs: 180,
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
  /**
   * The overnight coffin transfer's rate — a real 1-for-1 spend against the
   * night's whole blood pool (bloodTargetForNight), unlike the flat
   * overflowHealPerBlood rate mid-round. This is a genuine cost: if the pool
   * is smaller than the HP actually missing, the Count wakes up still hurt
   * rather than always topping off to full (see GameScene.computeOvernightTransfer).
   */
  overnightHealPerBlood: 1,
  /**
   * Display scale for Romi's droplet. Her drawing is 45px of paint in a 64px
   * frame where the placeholder it replaced was a generated 16px square, so
   * every place that draws a bloodlet multiplies its old scale by this and comes
   * out the size it always was.
   */
  dropletScale: 0.36,
  /** How long a corpse's floor stain sits at full strength before it fades. */
  decalLingerMs: 4200,
  decalFadeMs: 2600,
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

/**
 * Who actually walks in when the blood meter fills. Every fifth night the
 * Priest takes the step up the night was going to make AND the slot it would
 * have added, so night 5 is him alone in place of two Captains, night 10 is
 * him plus one Captain, night 15 him plus two — a new boss each time without
 * the count running away from the player.
 */
export function bossLineupForNight(night: number): { priests: number; captains: number } {
  const total = captainCountForNight(night);
  const isPriestNight = night >= PRIEST.everyNights && night % PRIEST.everyNights === 0;
  if (!isPriestNight) return { priests: 0, captains: total };
  return { priests: 1, captains: Math.max(0, total - 2) };
}

/**
 * Ranged pressure grows by night, but all thrower flavours share a hard cap —
 * and night one has none at all. One fewer than the night number: night 2 gets
 * a single thrower, night 3 two, and so on.
 */
export function throwerCapForNight(night: number): number {
  return Math.min(
    THROWER.maxAlive,
    Math.max(0, night - THROWER.firstNight + 1) * THROWER.maxAlivePerNight,
  );
}
