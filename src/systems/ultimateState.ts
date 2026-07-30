export interface UltimateSnapshot {
  charge: number;
  active: boolean;
}

/**
 * Pure state authority for Wrath activation. Presentation may be interrupted,
 * but a successful activation always consumes exactly one full meter.
 */
export class UltimateState {
  private chargeValue = 0;
  private activeValue = false;

  constructor(private readonly target: number) {
    if (!Number.isFinite(target) || target <= 0) {
      throw new Error('Ultimate target must be a positive finite number.');
    }
  }

  get charge(): number {
    return this.chargeValue;
  }

  get active(): boolean {
    return this.activeValue;
  }

  get full(): boolean {
    return this.chargeValue >= this.target;
  }

  gain(points: number): number {
    if (!Number.isFinite(points) || points <= 0) return this.chargeValue;
    this.chargeValue = Math.min(this.target, this.chargeValue + points);
    return this.chargeValue;
  }

  /**
   * `allowed` is supplied by the scene (playing, unpaused, run still live).
   * Repeated input cannot queue a second activation while the first is active.
   */
  tryActivate(allowed: boolean): boolean {
    if (!allowed || this.activeValue || !this.full) return false;
    this.activeValue = true;
    this.chargeValue = 0;
    return true;
  }

  finish(): void {
    this.activeValue = false;
  }

  /** New-run/restart reset. */
  reset(): void {
    this.chargeValue = 0;
    this.activeValue = false;
  }

  /** Scene shutdown interruption; consumed charge intentionally stays spent. */
  interrupt(): void {
    this.activeValue = false;
  }

  snapshot(): UltimateSnapshot {
    return { charge: this.chargeValue, active: this.activeValue };
  }
}

/**
 * Evenly distributes a kill wave while keeping the zero/one-target cases
 * explicit. The final target lands at `durationMs`, never after it.
 */
export function ultimateWaveDelays(targetCount: number, durationMs: number): number[] {
  const count = Math.max(0, Math.floor(targetCount));
  const duration = Math.max(0, durationMs);
  if (count === 0) return [];
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, index) =>
    Math.round((index / (count - 1)) * duration),
  );
}
