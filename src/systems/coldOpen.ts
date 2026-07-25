// Explicit .ts extension so Node can run this module directly in unit tests.

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
  flyInMs: 1300,
  /** "Need... Blood..." begins typing. */
  lineStartMs: 1500,
  /** Hunters start walking in from every edge. */
  huntersInMs: 1600,
  /** One strike takes the whole circle of them. */
  strikeMs: 4600,
  /** Bloodlets begin their run at the meter. */
  bloodStartMs: 4900,
  /** Stagger between bloodlets, and how long each takes to arrive. */
  bloodletStaggerMs: 55,
  bloodletFlightMs: 430,
  /** He turns bat and starts for the coffin. */
  toCoffinMs: 6400,
  coffinFlightMs: 1250,
  /**
   * The lid shuts. The clock reads exactly `minSeconds` at this instant, which
   * is what "just before the timer runs out" has to mean to be repeatable.
   */
  coffinShutMs: 7650,

  hunterCount: 10,
  /** One per unit of blood he is short - they fill the meter exactly. */
  bloodlets: 20,
} as const;

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
