/**
 * Pure HUD rules kept outside Phaser so the countdown and Wrath thresholds can
 * be regression-tested without constructing a scene.
 */

export interface CountdownUrgencyCue {
  /** A strong red screen pulse begins on this whole-second tick. */
  screenFlash: boolean;
  /** The last two complete seconds get a second pulse halfway through. */
  followUpFlashDelayMs: number | null;
  /** Scale the clock briefly reaches before returning to its resting size. */
  timerPopScale: number;
}

const SCREEN_FLASH_SECONDS = new Set([10, 5, 3, 2, 1, 0]);

export function countdownUrgencyCue(secondsRemaining: number): CountdownUrgencyCue {
  const seconds = Math.max(0, Math.ceil(secondsRemaining));
  return {
    screenFlash: SCREEN_FLASH_SECONDS.has(seconds),
    followUpFlashDelayMs: seconds === 2 || seconds === 1 ? 500 : null,
    timerPopScale: seconds <= 5 ? 2 : seconds <= 10 ? 1.3 : 1.08,
  };
}

/**
 * One orbiting mote is earned at each complete 10% step. Full charge deliberately
 * jumps from nine to twenty so "Ultimate ready" cannot be mistaken for 90%.
 */
export function wrathOrbitParticleCount(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped >= 1) return 20;
  return Math.floor(clamped * 10 + 1e-6);
}
