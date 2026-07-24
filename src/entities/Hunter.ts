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
  /** Set by GameScene: called when a sword swing actually connects. */
  onStrikeHit: (() => void) | null = null;
  /** Set by GameScene for the boss: called once the walk-in entrance finishes. */
  onEntranceArrived: (() => void) | null = null;
  /** Depth once the entrance finishes (below the wall band while entering). */
  protected normalDepth: number = DEPTHS.hunter;
  private nextSwingAt = 0;
  private lastTargetDist = Infinity;
  private entering = false;
  private arrivalPoint: { x: number; y: number } | null = null;

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
    this.setScale(HUNTER.spriteScale);
    this.setCircle(10, 22, 28);
    this.setDepth(DEPTHS.hunter);
    this.play(animKey('hunter', 'walk', 'down'));
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  /** True while walking in from off-screen — used to skip the coffin collider until arrival. */
  get isEntering(): boolean {
    return this.entering;
  }

  /**
   * Start a walk-in entrance: this hunter is expected to already be
   * positioned off-screen (see entrance.ts's offCanvasSpawnPoint). Until it
   * reaches `(arrivalX, arrivalY)`, pursue() ignores the player and beelines
   * there instead, hidden behind the wall layer the whole way in.
   */
  beginEntrance(arrivalX: number, arrivalY: number): void {
    this.arrivalPoint = { x: arrivalX, y: arrivalY };
    this.entering = true;
    this.setDepth(DEPTHS.enteringHunter);
  }

  /** Direct pursuit — intentionally no steering or pathfinding. */
  pursue(targetX: number, targetY: number): void {
    if (!this.isAlive) return;

    if (this.entering && this.arrivalPoint) {
      this.walkToward(this.arrivalPoint.x, this.arrivalPoint.y);
      if (Phaser.Math.Distance.Between(this.x, this.y, this.arrivalPoint.x, this.arrivalPoint.y) < 10) {
        this.entering = false;
        this.arrivalPoint = null;
        this.setDepth(this.normalDepth);
        this.onEntranceArrived?.();
      }
      return;
    }

    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    const dir = angleToDir4(angle);
    this.facing = dir;

    // Range check against sprite scale so the bigger Captain swings sooner.
    const dist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
    this.lastTargetDist = dist;
    const inMeleeRange = dist <= HUNTER.meleeRange * (this.scaleX / 2);

    // Let a started swing play out before movement anims take over again.
    const swinging =
      this.anims.currentAnim?.key.startsWith('hunter-attack') === true && this.anims.isPlaying;

    if (inMeleeRange) {
      this.setVelocity(0, 0);
      const now = this.scene.time.now;
      if (!swinging && now >= this.nextSwingAt) {
        this.nextSwingAt = now + HUNTER.meleeIntervalMs;
        this.play(animKey('hunter', 'attack', dir), true);
        // The blade connects mid-animation — if the target is still in reach.
        this.scene.time.delayedCall(HUNTER.meleeHitDelayMs, () => {
          if (!this.active || !this.isAlive) return;
          const reach = HUNTER.meleeRange * (this.scaleX / 2) * HUNTER.meleeHitReachFactor;
          if (this.lastTargetDist <= reach) this.onStrikeHit?.();
        });
      } else if (!swinging) {
        this.play(animKey('hunter', 'idle', dir), true);
      }
      return;
    }

    this.setVelocity(Math.cos(angle) * this.moveSpeed, Math.sin(angle) * this.moveSpeed);
    if (!swinging) {
      this.play(animKey('hunter', 'walk', dir), true);
    }
  }

  private walkToward(targetX: number, targetY: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    const dir = angleToDir4(angle);
    this.facing = dir;
    this.setVelocity(Math.cos(angle) * this.moveSpeed, Math.sin(angle) * this.moveSpeed);
    const key = animKey('hunter', 'walk', dir);
    if (this.anims.currentAnim?.key !== key) this.play(key, true);
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
