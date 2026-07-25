// Explicit .ts extensions so Node can run this module directly in unit tests.
import { ARENA } from '../game/constants.ts';

/**
 * The cold open's timeline, in milliseconds from its start, and the clock it
 * shows while it plays.
 *
 * The whole sequence is staged against a sunrise that is already ten seconds
 * away: the Count comes home starving with no night left, takes what he needs,
 * and makes the coffin with a single second to spare. That last second is the
 * point of the scene, so it is a hard guarantee rather than an accident of
 * frame timing - `coldOpenTimerSeconds` is floored at `minSeconds` and can
 * never return zero, no matter how slow (or paused, or backgrounded) the
 * machine running it gets.
 *
 * Pure TypeScript (no Phaser import) so the guarantee stays unit-testable.
 */
export const COLD_OPEN = {
  /** Seconds on the clock when the scene opens. */
  startSeconds: 10,
  /** Seconds on the clock when the lid shuts - and the floor it never goes below. */
  minSeconds: 1,

  /** He swoops in through the middle window. */
  flyInMs: 1100,
  /**
   * Hunters start walking in, massing on the right side of the hall. Early -
   * before he has even landed - because they have the longest journey in the
   * scene and walk at a hunter's ordinary pace; starting them any later and
   * the strike lands while half of them are still crossing the floor.
   */
  huntersInMs: 400,
  /** "Need... Blood..." begins typing. */
  lineStartMs: 1200,
  /** He turns bat again and crosses to the group. */
  toGroupMs: 2300,
  groupFlightMs: 700,
  /** One strike takes the whole group of them. */
  strikeMs: 3200,
  /** Bloodlets begin their run at the meter. */
  bloodStartMs: 3400,
  /** Stagger between bloodlets, and how long each takes to arrive. */
  bloodletStaggerMs: 45,
  bloodletFlightMs: 380,
  /** He turns bat and starts for the coffin. */
  toCoffinMs: 4800,
  coffinFlightMs: 1250,
  /**
   * The lid shuts. The clock reads exactly `minSeconds` at this instant, which
   * is what "just before the timer runs out" has to mean to be repeatable.
   */
  coffinShutMs: 6050,

  hunterCount: 10,
  /** One per unit of blood he is short - they fill the meter exactly. */
  bloodlets: 20,
} as const;

/** Where the cold open's hunters mass, over on the right of the hall. */
export const COLD_OPEN_GROUP = {
  x: ARENA.right - 230,
  y: (ARENA.top + ARENA.bottom) / 2,
} as const;

/** Where the Count lands to face them - just off the group's left flank. */
export const COLD_OPEN_STRIKE_SPOT = {
  x: COLD_OPEN_GROUP.x - 165,
  y: COLD_OPEN_GROUP.y,
} as const;

/**
 * Where hunter `i` walks in from and where it stands: a 3-wide block just
 * inside the right wall, entered from behind the right wall so they emerge
 * rather than appear.
 *
 * Out here in the pure module because the walk has to FIT - they cover this
 * ground at an ordinary hunter's pace, and the strike will not wait for
 * stragglers. The test asserts it.
 */
export function coldOpenHunterSlot(i: number): {
  spawn: { x: number; y: number };
  arrival: { x: number; y: number };
} {
  const column = i % 3;
  const row = Math.floor(i / 3);
  const y = COLD_OPEN_GROUP.y + (row - 1.5) * 54;
  return {
    spawn: { x: ARENA.right + 60 + column * 40, y },
    arrival: { x: COLD_OPEN_GROUP.x + column * 46, y },
  };
}

/**
 * Seconds to show on the clock `elapsedMs` into the cold open.
 *
 * Counts down from `startSeconds` at open to `minSeconds` at `coffinShutMs`,
 * then holds. Slightly faster than real time, so the arithmetic lands on the
 * beat instead of relying on the animation and a wall clock agreeing.
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
