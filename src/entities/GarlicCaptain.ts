import Phaser from 'phaser';
import { BOSS, KNOCKBACK, THROWER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import type { GameEventEmitter } from '../game/events';
import { BossHealthBar } from '../ui/BossHealthBar';
import { BossCharge } from './BossCharge';
import { GarlicThrower } from './GarlicThrower';
import type { HunterStats } from './Hunter';
import {
  CAPTAIN_NAMES,
  CAPTAIN_TINT,
  GARLIC_CHARGE_COLOR,
  captainTookDamage,
  type CaptainTraits,
} from './HunterCaptain';

/** A Captain drawn from the ranged hunter type, armed with one bulb per hand. */
export class GarlicCaptain extends GarlicThrower implements CaptainTraits {
  readonly maxHealth = BOSS.health;
  readonly healthBar: BossHealthBar;
  readonly bossName = CAPTAIN_NAMES.farmer ?? 'Garlic Captain';
  protected override knockbackResistance = KNOCKBACK.bossFactor;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
    /** Overridable so the cold open can march him at the squad's pace instead of his own. */
    stats: HunterStats = BOSS,
    /** False for the cold open's scenery Captains — they are dressing, not a fight the player tracks. */
    showHealthBar: boolean = true,
  ) {
    super(scene, x, y, {
      stats,
      spriteScale: BOSS.spriteScale,
      garlicPerThrow: 2,
      garlicThrowGapMs: BOSS.garlicThrowGapMs,
    });
    this.normalDepth = DEPTHS.boss;
    this.applyBaseTint();
    this.healthBar = new BossHealthBar(scene, this.bossName);
    if (!showHealthBar) this.healthBar.suppress();
  }

  protected override applyBaseTint(): void {
    this.setTint(CAPTAIN_TINT);
  }

  /** The wind-up ring, live from the lock until the bulbs are away. */
  private charge: BossCharge | null = null;

  override pursue(targetX: number, targetY: number): void {
    super.pursue(targetX, targetY);
    this.healthBar.follow(this.x, this.visibleTopY);
    this.charge?.follow(this.x, this.y);
    // The volley is over — either thrown or given up on — so the tell goes.
    if (this.charge && !this.isAiming) {
      this.charge.finish(true);
      this.charge = null;
    }
  }

  /**
   * Once his crosshair locks, the bulbs are coming. Hitting him shoves him but
   * does not knock the throw out of him the way it does an ordinary thrower —
   * the green ring closing on him is the warning that pays for that.
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
      GARLIC_CHARGE_COLOR,
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
