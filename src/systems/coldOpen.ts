// Explicit .ts extensions so Node can run this module directly in unit tests.
import { ARENA, GAME_WIDTH, GAME_HEIGHT } from '../game/constants.ts';
import { BOSS, HUNTER, PRIEST, THROWER } from '../data/balance.ts';

/**
 * The cold open's timeline, in milliseconds from its start, and the clock it
 * shows while it plays.
 *
 * The clock counts down in real lockstep with elapsed time now — `span /
 * coffinShutMs` is exactly 1 displayed second per 1000ms elapsed
 * (`coldOpenTimerSeconds` asserts this) — so the scene has to fit inside
 * `coffinShutMs` for real, not just on the numbers. It used to run faster
 * than real time (about 1.5x), which is why 10 seconds of countdown used to
 * be enough; the surrounding roster and the Ultimate demo both need more
 * room than that to actually play out, hence 15.
 *
 * Pure TypeScript (no Phaser import) so the guarantee stays unit-testable.
 */
export const COLD_OPEN = {
  /** Seconds on the clock when the scene opens. */
  startSeconds: 15,
  /** Seconds on the clock when the lid shuts - and the floor it never goes below. */
  minSeconds: 1,

  /** He swoops in through the middle window. */
  flyInMs: 1400,
  /**
   * The whole roster starts walking in, surrounding him from every side.
   * Early — before he has even landed — because some of them have a long
   * walk in from off-canvas and the demo does not wait for stragglers.
   */
  huntersInMs: 800,
  /** "Need... Blood..." begins typing. */
  lineStartMs: 1800,
  /**
   * The Ultimate demo begins: the summon pose plays alone first (see
   * demoSummonMs), then the flash, then the bats and the kill together —
   * the exact same beats fireUltimate plays for real, just fired here to
   * show the player the move exists before the first night even starts.
   */
  demoMs: 6800,
  /** How long the summon pose holds before the flash/kill lands — matches fireUltimate's own beat. */
  demoSummonMs: 500,
  /** Gap from the flash to the actual kill landing — matches fireUltimate's own beat. */
  demoStrikeMs: 140,
  /** Bloodlets begin their run at the meter. */
  bloodStartMs: 7700,
  /** Stagger between bloodlets, and how long each takes to arrive. */
  bloodletStaggerMs: 45,
  bloodletFlightMs: 380,
  /** He turns bat and starts for the coffin. */
  toCoffinMs: 12750,
  coffinFlightMs: 1250,
  /**
   * The lid shuts. The clock reads exactly `minSeconds` at this instant, which
   * is what "just before the timer runs out" has to mean to be repeatable.
   */
  coffinShutMs: 14000,

  /** The whole roster, one of every kind — see COLD_OPEN_ROSTER. */
  hunterCount: 16,
  /** How far out the ring surrounding him sits. */
  ringRadius: 190,
  /** One per unit of blood he is short - they fill the meter exactly. */
  bloodlets: 20,
} as const;

/**
 * Everything that hunts him, surrounding him in one ring so the cold open
 * shows the whole roster before the first night starts — every ordinary
 * flavour, one of each Captain, and the Priest — rather than a single flank
 * of swordsmen. Which slot gets which is FIXED, never rolled: a cutscene has
 * to play the same way every time.
 */
export type ColdOpenActor =
  | 'priest'
  | 'pilgrim'
  | 'huntress'
  | 'spike'
  | 'pitchfork'
  | 'torch'
  | 'thrower'
  | 'hunterCaptain'
  | 'garlicCaptain'
  | 'crossCaptain';

const COLD_OPEN_ROSTER: ColdOpenActor[] = [
  'priest',
  'hunterCaptain',
  'garlicCaptain',
  'crossCaptain',
  'pilgrim',
  'huntress',
  'spike',
  'pitchfork',
  'torch',
  'thrower',
  'thrower',
  'pilgrim',
  'huntress',
  'spike',
  'torch',
  'thrower',
];

/** Who stands in slot `i` of the ring. */
export function coldOpenSlotActor(i: number): ColdOpenActor {
  return COLD_OPEN_ROSTER[i % COLD_OPEN_ROSTER.length];
}

/** Kept for the tests and for callers that only care about the ranged roles. */
export function coldOpenSlotIsThrower(i: number): boolean {
  return coldOpenSlotActor(i) === 'thrower';
}

/**
 * The whole ring marches at the swordsmen's pace.
 *
 * A thrower's own moveSpeed is ~30% slower, and a Captain's own is slower
 * still, both of which are right for a real night (they hang back or plant
 * their feet, and are meant to be caught) and wrong for this scene: at their
 * own pace they are still crossing the floor when the demo fires, and the
 * demo does not wait. The override is per cutscene actor and touches nothing
 * about how any of them behave in a night. The test asserts this for every
 * flavour, not just the one that used to have the problem.
 */
export const COLD_OPEN_MARCH_SPEED = HUNTER.moveSpeed;

/** A cold-open thrower: his own stats, at the ring's marching pace. */
export const COLD_OPEN_THROWER_STATS = {
  ...THROWER,
  moveSpeed: COLD_OPEN_MARCH_SPEED,
} as const;

/** A cold-open Priest: his own stats, at the ring's marching pace rather than his usual slow 76. */
export const COLD_OPEN_PRIEST_STATS = {
  ...PRIEST,
  moveSpeed: COLD_OPEN_MARCH_SPEED,
} as const;

/** A cold-open melee Captain: his own stats, at the ring's marching pace rather than his usual 90. */
export const COLD_OPEN_CAPTAIN_STATS = {
  ...BOSS,
  moveSpeed: COLD_OPEN_MARCH_SPEED,
} as const;

/** Where the ring is centred — the same spot the Count lands on. */
export const COLD_OPEN_CENTER = {
  x: (ARENA.left + ARENA.right) / 2,
  y: (ARENA.top + ARENA.bottom) / 2,
} as const;

/**
 * The exit point of a ray from `origin` in direction `d`, clamped to whichever
 * of `min`/`max` it actually travels toward — `Infinity` if it never leaves
 * that axis's bounds at all (a purely perpendicular ray).
 */
function rayExitDistance(origin: number, d: number, min: number, max: number): number {
  if (d > 1e-6) return (max - origin) / d;
  if (d < -1e-6) return (min - origin) / d;
  return Infinity;
}

/**
 * An off-canvas point along the exact ray from COLD_OPEN_CENTER through
 * `angle`, just past wherever that ray actually leaves the canvas —
 * whichever of the horizontal or vertical bounds it hits first — plus a
 * small margin. This is what lets the ring surround him from every
 * direction: unlike the regular game's offCanvasSpawnPoint (which expects an
 * arrival point already near one specific edge), a ring tight around the
 * hall centre is not near any edge, so entrants are placed by DIRECTION
 * instead, each walking straight in along the same compass line its ring
 * slot sits on.
 */
function offCanvasAlongAngle(angle: number): { x: number; y: number } {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const margin = 60;
  const t =
    Math.min(
      rayExitDistance(COLD_OPEN_CENTER.x, dx, 0, GAME_WIDTH),
      rayExitDistance(COLD_OPEN_CENTER.y, dy, 0, GAME_HEIGHT),
    ) + margin;
  return { x: COLD_OPEN_CENTER.x + dx * t, y: COLD_OPEN_CENTER.y + dy * t };
}

/**
 * Where actor `i` of `total` walks in from and where it stands: evenly
 * spaced around COLD_OPEN_RING_RADIUS at COLD_OPEN_CENTER, entered from
 * off-canvas along that same angle so the ring closes in from every side at
 * once rather than from one flank.
 *
 * Out here in the pure module because the walk has to FIT - every slot
 * covers its own ground at the ring's marching pace, and the demo will not
 * wait for stragglers. The test asserts it.
 */
export function coldOpenRingSlot(
  i: number,
  total: number,
): { spawn: { x: number; y: number }; arrival: { x: number; y: number } } {
  const angle = (i / total) * Math.PI * 2;
  const arrival = {
    x: COLD_OPEN_CENTER.x + Math.cos(angle) * COLD_OPEN.ringRadius,
    y: COLD_OPEN_CENTER.y + Math.sin(angle) * COLD_OPEN.ringRadius,
  };
  return { spawn: offCanvasAlongAngle(angle), arrival };
}

/**
 * Seconds to show on the clock `elapsedMs` into the cold open.
 *
 * Counts down from `startSeconds` at open to `minSeconds` at `coffinShutMs`,
 * then holds — in real lockstep with elapsed time (span / coffinShutMs is
 * exactly one displayed second per 1000ms), so the clock never reads faster
 * than the scene is actually playing.
 */
export function coldOpenTimerSeconds(elapsedMs: number): number {
  const span = COLD_OPEN.startSeconds - COLD_OPEN.minSeconds;
  const raw = COLD_OPEN.startSeconds - (span * elapsedMs) / COLD_OPEN.coffinShutMs;
  return Math.max(COLD_OPEN.minSeconds, Math.ceil(raw));
}

/**
 * How far through the night the sky should be at `elapsedMs`. Runs from deep
 * in the small hours to the edge of sunrise - never all the way to 1, which is
 * dawn, which is the thing he is outrunning.
 */
export function coldOpenSkyProgress(elapsedMs: number): number {
  const t = Math.max(0, Math.min(1, elapsedMs / COLD_OPEN.coffinShutMs));
  return 0.62 + t * 0.35;
}
