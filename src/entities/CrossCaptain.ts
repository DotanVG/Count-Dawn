import Phaser from 'phaser';
import { BOSS, CROSS, KNOCKBACK, THROWER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import type { GameEventEmitter } from '../game/events';
import { BossHealthBar } from '../ui/BossHealthBar';
import { BossCharge } from './BossCharge';
import { GarlicThrower } from './GarlicThrower';
import { HUNTRESS_LOOK, type HunterStats } from './Hunter';
import {
  CAPTAIN_NAMES,
  CAPTAIN_TINT,
  captainTookDamage,
  type CaptainTraits,
} from './HunterCaptain';

/** Gold, matching the crosses she throws and the Priest's light. */
export const CROSS_CHARGE_COLOR = 0xffd76b;

/**
 * The huntress Captain. Her men carry a spike, a fork or a torch like everyone
 * else's; she is the only one in the hall with the gold crosses, and she throws
 * them like shuriken.
 *
 * She reuses the garlic thrower's whole state machine — hold a standoff, paint a
 * crosshair, lock, volley — because the shape of the threat is the same shape:
 * keep away, aim, commit. What changes is the projectile. A bulb is lobbed at
 * the locked POINT and splashes there; her crosses are thrown along the line the
 * lock gave her and keep going (see GoldCross), so the answer is to step
 * sideways rather than to back off, and a fan of three punishes standing still.
 */
export class CrossCaptain extends GarlicThrower implements CaptainTraits {
  readonly maxHealth = BOSS.health;
  readonly healthBar: BossHealthBar;
  readonly bossName = CAPTAIN_NAMES.huntress ?? 'Huntress Captain';
  protected override knockbackResistance = KNOCKBACK.bossFactor;

  /** The wind-up ring, live from the lock until the last cross is away. */
  private charge: BossCharge | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
    /** Overridable so the cold open can march her at the squad's pace instead of her own. */
    stats: HunterStats = BOSS,
    /** False for the cold open's scenery Captains — they are dressing, not a fight the player tracks. */
    showHealthBar: boolean = true,
  ) {
    super(scene, x, y, {
      stats,
      look: HUNTRESS_LOOK,
      spriteScale: BOSS.spriteScale,
      garlicPerThrow: CROSS.perVolley,
      garlicThrowGapMs: CROSS.volleyGapMs,
      // She never holds a bulb — her crosses only exist once thrown.
      hideHeldProp: true,
    });
    this.normalDepth = DEPTHS.boss;
    this.applyBaseTint();
    this.healthBar = new BossHealthBar(scene, this.bossName);
    if (!showHealthBar) this.healthBar.suppress();
  }

  protected override applyBaseTint(): void {
    this.setTint(CAPTAIN_TINT);
  }

  override pursue(targetX: number, targetY: number): void {
    super.pursue(targetX, targetY);
    this.healthBar.follow(this.x, this.visibleTopY);
    this.charge?.follow(this.x, this.y);
    if (this.charge && !this.isAiming) {
      this.charge.finish(true);
      this.charge = null;
    }
  }

  /**
   * Once her crosshair locks the crosses are coming. Hitting her shoves her but
   * does not knock the throw out of her — the gold ring closing on her is the
   * warning that pays for that.
   */
  protected override get isCommitted(): boolean {
    return this.isAiming;
  }

  protected override get keepsAimUnderFire(): boolean {
    return true;
  }

  protected override onLocked(): void {
    this.charge?.destroy();
    this.charge = new BossCharge(
      this.scene,
      this.x,
      this.y,
      CROSS_CHARGE_COLOR,
      this.displayHeight * 0.6,
      THROWER.throwWindupMs,
    );
  }

  override takeDamage(amount: number): boolean {
    const killed = super.takeDamage(amount);
    captainTookDamage(this, this.emitter);
    return killed;
  }

  override destroy(fromScene?: boolean): void {
    if (!this.scene) return; // already destroyed; see the note in Priest.destroy
    this.charge?.destroy();
    this.charge = null;
    this.healthBar.destroy();
    super.destroy(fromScene);
  }

  playEntrance(): void {
    const targetScale = this.scaleX;
    this.scene.tweens.add({
      targets: this,
      scale: { from: targetScale * 1.18, to: targetScale },
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.scene.cameras.main.shake(250, 0.006);
  }
}
