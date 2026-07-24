import Phaser from 'phaser';
import { HUNTER } from '../data/balance';
import { TEXTURES } from '../utils/assetKeys';

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

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string = TEXTURES.hunter,
    stats: HunterStats = HUNTER,
  ) {
    super(scene, x, y, texture);
    this.health = stats.health;
    this.contactDamage = stats.contactDamage;
    this.moveSpeed = stats.moveSpeed;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(5);
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  /** Direct pursuit — intentionally no steering or pathfinding. */
  pursue(targetX: number, targetY: number): void {
    if (!this.isAlive) return;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.setVelocity(Math.cos(angle) * this.moveSpeed, Math.sin(angle) * this.moveSpeed);
    this.setFlipX(Math.cos(angle) < 0);
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
    });

    return this.health <= 0;
  }
}
