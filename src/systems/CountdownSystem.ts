// Explicit .ts extension so Node can run this module directly in unit tests.
import { EVENTS, type GameEventEmitter } from '../game/events.ts';

/**
 * Sunrise countdown driven by elapsed game time (delta ms), not frames.
 * Pause works for free: when the scene is paused, update() is not called.
 *
 * Pure TypeScript (no Phaser import) so game rules stay unit-testable.
 */
export class CountdownSystem {
  private readonly durationMs: number;
  private readonly finalWarningMs: number;

  private elapsedMs = 0;
  private finalWarningFired = false;
  private dawnFired = false;
  private lastWholeSecond = -1;

  constructor(
    private readonly emitter: GameEventEmitter,
    durationSeconds: number,
    finalWarningSeconds: number,
  ) {
    this.durationMs = durationSeconds * 1000;
    this.finalWarningMs = finalWarningSeconds * 1000;
  }

  get remainingMs(): number {
    return Math.max(0, this.durationMs - this.elapsedMs);
  }

  get remainingSeconds(): number {
    return Math.ceil(this.remainingMs / 1000);
  }

  get elapsedSeconds(): number {
    return Math.min(this.durationMs, this.elapsedMs) / 1000;
  }

  /** 0 at night start, 1 at dawn — used for the sky/dawn transition. */
  get progress(): number {
    return Math.min(1, this.elapsedMs / this.durationMs);
  }

  get hasDawnFired(): boolean {
    return this.dawnFired;
  }

  update(deltaMs: number): void {
    if (this.dawnFired) return;

    this.elapsedMs += deltaMs;
    const remaining = this.remainingMs;

    const wholeSecond = Math.ceil(remaining / 1000);
    if (wholeSecond !== this.lastWholeSecond) {
      this.lastWholeSecond = wholeSecond;
      this.emitter.emit(EVENTS.COUNTDOWN_TICK, wholeSecond);
    }

    if (!this.finalWarningFired && remaining <= this.finalWarningMs) {
      this.finalWarningFired = true;
      this.emitter.emit(EVENTS.FINAL_TEN_SECONDS);
    }

    if (remaining <= 0) {
      this.dawnFired = true;
      this.emitter.emit(EVENTS.DAWN_REACHED);
    }
  }
}
