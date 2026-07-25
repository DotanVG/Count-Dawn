import Phaser from 'phaser';
import { BOSS, KNOCKBACK } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { EVENTS, type GameEventEmitter } from '../game/events';
import { BossHealthBar } from '../ui/BossHealthBar';
import { Hunter } from './Hunter';

/** Tint that separates the Captain from his men (dark blood-red armor look). */
export const CAPTAIN_TINT = 0xff9a7a;

/**
 * Everything that makes a hunter a Captain, worn identically by both flavours:
 * the melee HunterCaptain below and the garlic-throwing GarlicCaptain, which
 * has to extend GarlicThrower and so cannot inherit from this one.
 *
 * A Captain is a hunter that is bigger, tougher, shrugs off knockback, and
 * carries his own health bar over his head.
 */
export interface CaptainTraits {
  readonly maxHealth: number;
  readonly healthBar: BossHealthBar;
}

/** Damage bookkeeping shared by both Captain flavours. */
export function captainTookDamage(
  captain: Hunter & CaptainTraits,
  emitter: GameEventEmitter,
): void {
  captain.healthBar.setRatio(Math.max(0, captain.health) / captain.maxHealth);
  emitter.emit(EVENTS.BOSS_HEALTH_CHANGED, Math.max(0, captain.health), captain.maxHealth);
  captain.scene.cameras.main.shake(80, 0.004);
}

/**
 * The boss. Same sheet as a hunter but much larger, tinted, tougher; carries
 * his own health bar above his head.
 */
export class HunterCaptain extends Hunter implements CaptainTraits {
  readonly maxHealth = BOSS.health;
  readonly healthBar: BossHealthBar;
  /** He rocks back a little, but the Count can't shove him around the hall. */
  protected override knockbackResistance = KNOCKBACK.bossFactor;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
  ) {
    super(scene, x, y, BOSS);
    this.setScale(BOSS.spriteScale);
    this.normalDepth = DEPTHS.boss;
    this.applyBaseTint();
    this.healthBar = new BossHealthBar(scene, 'Hunter Captain');
  }

  protected override applyBaseTint(): void {
    this.setTint(CAPTAIN_TINT);
  }

  override pursue(targetX: number, targetY: number): void {
    super.pursue(targetX, targetY);
    this.healthBar.follow(this.x, this.visibleTopY);
  }

  override takeDamage(amount: number): boolean {
    const killed = super.takeDamage(amount);
    captainTookDamage(this, this.emitter);
    return killed;
  }

  override destroy(fromScene?: boolean): void {
    this.healthBar.destroy();
    super.destroy(fromScene);
  }

  /**
   * Arrival flourish once he's walked in from off-screen and reached his
   * spot (called via Hunter.onEntranceArrived): a stomping scale-bounce and
   * a bigger camera shake than a regular hunter's entrance gets.
   */
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
