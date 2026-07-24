import Phaser from 'phaser';
import { THROWER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';

/** The 192px source art, shrunk to a bulb that reads at hunter scale. */
const GARLIC_SCALE = THROWER.garlicScale;

/**
 * A thrown garlic bulb. It flies to the point the thrower's crosshair locked
 * onto — not to wherever the Count is now — so the throw is dodgeable: keep
 * moving (or dash) after the lock lands and it thumps into empty floor.
 *
 * Resolution happens exactly once, either on a direct overlap with the player
 * (see GameScene) or on arrival at the locked point, whichever comes first.
 */
export class Garlic extends Phaser.Physics.Arcade.Sprite {
  private resolved = false;
  private landTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly targetX: number,
    private readonly targetY: number,
    /** Called once, at the point of impact: `direct` distinguishes a body hit from a landing. */
    private readonly onImpact: (x: number, y: number, direct: boolean) => void,
  ) {
    super(scene, x, y, TEXTURES.garlic);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(GARLIC_SCALE);
    this.setDepth(DEPTHS.attackFx - 1);
    this.setCircle(96, 0, 0); // full-bulb hitbox in the 192x192 source texture
  }

  /**
   * Throw it. Deliberately separate from the constructor: adding a body to an
   * arcade Group applies the group's body defaults, which zero out velocity —
   * launching inside the constructor left every bulb sitting in the thrower's
   * hand. Call this only after the group add.
   */
  launch(): void {
    const distance = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);
    const travelMs = Math.max(80, (distance / THROWER.garlicSpeed) * 1000);
    this.scene.physics.moveTo(this, this.targetX, this.targetY, THROWER.garlicSpeed);

    // Tumbling in flight, plus a scale bump at the midpoint that fakes a lob
    // arc without needing a second axis.
    this.scene.tweens.add({ targets: this, angle: 540, duration: travelMs, ease: 'Linear' });
    this.scene.tweens.add({
      targets: this,
      scale: { from: GARLIC_SCALE, to: GARLIC_SCALE * 1.5 },
      duration: travelMs / 2,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    this.landTimer = this.scene.time.delayedCall(travelMs, () => this.resolve(false));
  }

  /** Called by the scene's overlap check when it actually hits the Count. */
  hitPlayer(): void {
    this.resolve(true);
  }

  private resolve(direct: boolean): void {
    if (this.resolved) return;
    this.resolved = true;
    this.onImpact(this.x, this.y, direct);
    this.destroy();
  }

  override destroy(fromScene?: boolean): void {
    this.landTimer?.remove();
    this.landTimer = null;
    this.scene?.tweens.killTweensOf(this);
    super.destroy(fromScene);
  }
}
