import Phaser from 'phaser';
import { THROWER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { PresentationSystem } from '../systems/PresentationSystem';

/** Sickly garlic-green — the thrower's targeting light. */
const GREEN = 0x7dff9b;
const LOCK_WHITE = 0xffffff;
/** Blinks per second once the lock takes hold. */
const LOCK_BLINK_HZ = 9;

/**
 * The crosshair a garlic thrower paints on the floor: it starts at his feet,
 * crawls toward the Count and follows him around, and — once it has held him
 * for THROWER.lockHoldMs — freezes where it caught him and strobes white/green
 * while the throw winds up. Purely cosmetic; the thrower owns the state
 * machine and reads `isOnTarget` from here.
 */
export class GarlicTarget {
  x: number;
  y: number;
  private readonly graphics: Phaser.GameObjects.Graphics;
  private locked = false;
  private spin = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.x = x;
    this.y = y;
    this.graphics = scene.add.graphics().setDepth(DEPTHS.groundFx);
    this.graphics.setBlendMode(Phaser.BlendModes.ADD); // makes the green glow
  }

  /** Freeze the crosshair where it is and switch to the fast lock strobe. */
  lock(): void {
    this.locked = true;
    PresentationSystem.forScene(this.scene)?.cameraShake(90, 0.002);
  }

  /** Resume following between shots of a garlic Captain's two-bulb volley. */
  unlock(): void {
    this.locked = false;
  }

  /**
   * Crawl toward `(px, py)` at a capped speed — fast enough to be a threat,
   * slow enough that running (and certainly dashing) shakes it off.
   */
  moveToward(px: number, py: number, deltaMs: number): void {
    if (this.locked) return;
    const step = (THROWER.targetSpeed * deltaMs) / 1000;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, px, py);
    if (dist <= step) {
      this.x = px;
      this.y = py;
      return;
    }
    const angle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    this.x += Math.cos(angle) * step;
    this.y += Math.sin(angle) * step;
  }

  /** True while the crosshair is sitting on the given point. */
  isOnTarget(px: number, py: number): boolean {
    return Phaser.Math.Distance.Between(this.x, this.y, px, py) <= THROWER.lockRadius;
  }

  draw(time: number): void {
    const g = this.graphics;
    g.clear();
    g.setPosition(this.x, this.y);

    const blinkOn = Math.floor((time / 1000) * LOCK_BLINK_HZ) % 2 === 0;
    const color = this.locked && blinkOn ? LOCK_WHITE : GREEN;
    const strength = this.locked ? (blinkOn ? 1 : 0.55) : 0.75;
    const drawn = THROWER.lockRadius * THROWER.targetDrawScale;
    const radius = this.locked ? drawn * 0.62 : drawn * 0.8;

    // Soft glow pool underneath, breathing while it hunts.
    const pulse = 1 + Math.sin(time / 140) * 0.06;
    g.fillStyle(GREEN, 0.1 * strength);
    g.fillCircle(0, 0, radius * 1.5 * pulse);

    // Ring + inner ring.
    g.lineStyle(3, color, 0.9 * strength);
    g.strokeCircle(0, 0, radius * pulse);
    g.lineStyle(1, color, 0.5 * strength);
    g.strokeCircle(0, 0, radius * 0.55 * pulse);

    // Four crosshair ticks, spinning slowly while tracking, still once locked.
    if (!this.locked) this.spin += 0.012;
    for (let i = 0; i < 4; i++) {
      const angle = this.spin + (Math.PI / 2) * i;
      const inner = radius * 0.72;
      const outer = radius * 1.45;
      g.lineStyle(3, color, 0.95 * strength);
      g.beginPath();
      g.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      g.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      g.strokePath();
    }

    // Center pip.
    g.fillStyle(color, strength);
    g.fillCircle(0, 0, this.locked ? 4 : 2.5);
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
