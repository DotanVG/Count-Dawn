import Phaser from 'phaser';
import { CROSS } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';

/**
 * A gold cross thrown like a shuriken by the huntress Captain.
 *
 * Deliberately NOT a garlic bulb with a different sprite. A bulb is lobbed at a
 * point the crosshair locked onto and resolves there whether or not it hit
 * anything, which is why it can be walked out of. A cross flies FLAT and FAST
 * along the line it was thrown on, spinning, until it hits the Count or leaves
 * the hall — so the dodge is sideways rather than backwards, and a fan of three
 * covers a wedge that punishes standing still without ever tracking you.
 *
 * It keeps spinning the whole way, which is the tell that it is a thrown blade
 * and not a projectile that will drop.
 */
export class GoldCross extends Phaser.Physics.Arcade.Sprite {
  private spent = false;
  /** Locked at construction; used by launch() once the group add is done. */
  private aimAngle = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, angle: number) {
    super(scene, x, y, TEXTURES.weaponGoldCross);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTHS.attackFx);
    this.setScale(CROSS.scale);
    this.setCircle(CROSS.bodyRadius, 32 - CROSS.bodyRadius, 32 - CROSS.bodyRadius);
    this.aimAngle = angle;
  }

  /**
   * Throw it. Deliberately separate from the constructor, for the same reason
   * Garlic.launch is: adding a body to an arcade Group applies the group's body
   * defaults, which zero out velocity, so a cross launched in its constructor
   * hangs in the huntress's hand until it times out. Call this only after the
   * group add.
   */
  launch(): void {
    this.setVelocity(Math.cos(this.aimAngle) * CROSS.speed, Math.sin(this.aimAngle) * CROSS.speed);

    // The spin is a plain tween on rotation rather than an animation: there is
    // one drawing of the cross, and turning it is the animation.
    this.scene.tweens.add({
      targets: this,
      rotation: Math.PI * 2 * CROSS.spins,
      duration: CROSS.lifetimeMs,
      ease: 'Linear',
    });
    this.scene.time.delayedCall(CROSS.lifetimeMs, () => this.finish());
  }

  /** True once it has hit or expired — guards a double resolve. */
  get isSpent(): boolean {
    return this.spent;
  }

  /** It struck the Count. Bursts on the spot. */
  hitPlayer(): void {
    if (this.spent) return;
    this.burst();
    this.finish();
  }

  /**
   * Called every frame by the scene: a cross that has left the hall is gone,
   * without a burst — it went past him, and that is a clean dodge.
   */
  updateFlight(bounds: Phaser.Geom.Rectangle): void {
    if (this.spent) return;
    if (!bounds.contains(this.x, this.y)) this.finish();
  }

  private burst(): void {
    const sparks = this.scene.add
      .particles(this.x, this.y, TEXTURES.particle, {
        speed: { min: 60, max: 220 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 200, max: 460 },
        scale: { start: 1, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffd76b, 0xfff3c4, 0xffffff],
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx);
    sparks.explode(14);
    this.scene.time.delayedCall(600, () => sparks.destroy());
  }

  private finish(): void {
    if (this.spent || !this.active) return;
    this.spent = true;
    this.destroy();
  }
}
