import Phaser from 'phaser';
import { DEPTHS } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';

/**
 * The tell every boss wears before it commits to an attack.
 *
 * A boss's specials cannot be interrupted by damage (see Hunter.isCommitted),
 * which is only fair if you can see one coming. So every Captain and the Priest
 * charge visibly first: a ring collapses inward onto the boss while motes are
 * drawn in behind it, tightening as the wind-up runs out. The ring closing on
 * him IS the countdown — when it reaches his body, the attack fires.
 *
 * Each boss passes its own colour, so the hall reads at a glance which threat
 * is winding up: gold for the Priest's ward, red for a Captain's heavy swing,
 * green for a garlic volley.
 */
export class BossCharge {
  private ring: Phaser.GameObjects.Arc;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter;
  private tween: Phaser.Tweens.Tween | null = null;
  private done = false;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly color: number,
    /** Radius the ring starts at, before collapsing onto the boss. */
    private readonly startRadius: number,
    durationMs: number,
  ) {
    this.ring = scene.add
      .circle(x, y, startRadius, color, 0)
      .setStrokeStyle(3, color, 0.85)
      .setDepth(DEPTHS.attackFx);

    // Drawn inward rather than thrown outward: the gathering is the point.
    this.motes = scene.add
      .particles(x, y, TEXTURES.particle, {
        speed: { min: -150, max: -60 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 260, max: 460 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0, end: 0.95 },
        tint: [color, 0xffffff],
        frequency: 45,
        quantity: 2,
        radial: true,
      })
      .setDepth(DEPTHS.attackFx);

    this.tween = scene.tweens.addCounter({
      from: 1,
      to: 0.12,
      duration: durationMs,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        this.ring.setRadius(this.startRadius * t);
        // Tightens AND brightens, so the last moments are unmistakable.
        this.ring.setStrokeStyle(3 + (1 - t) * 4, this.color, 0.85 + (1 - t) * 0.15);
      },
    });
  }

  /** Keeps the tell on the boss while he is shoved around mid-charge. */
  follow(x: number, y: number): void {
    if (this.done) return;
    this.ring.setPosition(x, y);
    this.motes.setPosition(x, y);
  }

  /**
   * The wind-up ended. `fired` snaps the ring out in a flash — the attack
   * happening — where a cancel just lets it fade.
   */
  finish(fired: boolean): void {
    if (this.done) return;
    this.done = true;
    this.tween?.stop();
    this.tween = null;
    this.motes.stop();

    const ring = this.ring;
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      duration: fired ? 160 : 220,
      onUpdate: fired
        ? () => ring.setRadius(this.startRadius * 0.12 + (1 - ring.alpha) * this.startRadius * 0.5)
        : undefined,
      onComplete: () => ring.destroy(),
    });
    this.scene.time.delayedCall(700, () => this.motes.destroy());
  }

  /** Torn down with its owner, mid-charge or not. */
  destroy(): void {
    this.done = true;
    this.tween?.stop();
    this.tween = null;
    this.ring.destroy();
    this.motes.destroy();
  }
}
