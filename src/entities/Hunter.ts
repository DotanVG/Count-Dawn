import Phaser from 'phaser';
import { HUNTER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { TEXTURES, animKey, type Dir4 } from '../utils/assetKeys';
import { angleToDir4 } from '../utils/direction';

export interface HunterStats {
  health: number;
  contactDamage: number;
  moveSpeed: number;
}

/**
 * A regular human hunter: walks straight at the player, damages on contact,
 * dies to melee hits. HunterCaptain extends this with boss stats.
 */
export class Hunter extends Phaser.Physics.Arcade.Sprite {
  health: number;
  readonly contactDamage: number;
  protected readonly moveSpeed: number;
  facing: Dir4 = 'down';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    stats: HunterStats = HUNTER,
  ) {
    super(scene, x, y, TEXTURES.hunterWalk, 0);
    this.health = stats.health;
    this.contactDamage = stats.contactDamage;
    this.moveSpeed = stats.moveSpeed;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(2);
    this.setCircle(10, 22, 28);
    this.setDepth(DEPTHS.hunter);
    this.play(animKey('hunter', 'walk', 'down'));
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  /** Direct pursuit — intentionally no steering or pathfinding. */
  pursue(targetX: number, targetY: number): void {
    if (!this.isAlive) return;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.setVelocity(Math.cos(angle) * this.moveSpeed, Math.sin(angle) * this.moveSpeed);

    const dir = angleToDir4(angle);
    if (dir !== this.facing) {
      this.facing = dir;
      this.play(animKey('hunter', 'walk', dir), true);
    }
  }

  /** Returns true if this hit killed the hunter. Caller handles drops/removal. */
  takeDamage(amount: number): boolean {
    if (!this.isAlive) return false;
    this.health -= amount;

    // White hit flash (Phaser 4 tint API).
    this.setTint(0xffffff);
    this.setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(70, () => {
      if (!this.active) return;
      this.clearTint();
      this.setTintMode(Phaser.TintModes.MULTIPLY);
      this.applyBaseTint();
    });

    return this.health <= 0;
  }

  /** Re-applied after hit flashes; the Captain overrides with his color. */
  protected applyBaseTint(): void {
    this.clearTint();
  }

  /**
   * Spawns a non-colliding corpse playing the death animation, fading out.
   * Called by the scene when this hunter dies, right before removal.
   */
  spawnCorpse(): void {
    const corpse = this.scene.add
      .sprite(this.x, this.y, TEXTURES.hunterDeath, 0)
      .setScale(this.scaleX, this.scaleY)
      .setDepth(DEPTHS.corpse);
    corpse.play(animKey('hunter', 'death', this.facing));
    this.scene.tweens.add({
      targets: corpse,
      alpha: 0,
      delay: 700,
      duration: 900,
      onComplete: () => corpse.destroy(),
    });
  }
}
