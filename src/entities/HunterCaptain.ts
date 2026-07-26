import Phaser from 'phaser';
import { BOSS, HUNTER, KNOCKBACK } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { EVENTS, type GameEventEmitter } from '../game/events';
import { BossHealthBar } from '../ui/BossHealthBar';
import { BossCharge } from './BossCharge';
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

/**
 * Colours for the wind-up ring each Captain flavour wears (see BossCharge).
 * A melee Captain charges red, a garlic Captain green — the same cue as the
 * Priest's gold, so the hall reads at a glance which threat is about to land.
 */
export const CAPTAIN_CHARGE_COLOR = 0xff5a4a;
export const GARLIC_CHARGE_COLOR = 0x7dff9b;

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

  /** The wind-up ring, live only between a swing starting and landing. */
  private charge: BossCharge | null = null;

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
    this.on(Phaser.Animations.Events.ANIMATION_START, (anim: Phaser.Animations.Animation) => {
      if (anim.key.startsWith('hunter-attack')) this.beginChargeTell();
    });
  }

  protected override applyBaseTint(): void {
    this.setTint(CAPTAIN_TINT);
  }

  override pursue(targetX: number, targetY: number): void {
    super.pursue(targetX, targetY);
    this.healthBar.follow(this.x, this.visibleTopY);
    this.charge?.follow(this.x, this.y);
  }

  /**
   * His swing is a boss swing: once it starts it lands, shove or no shove. The
   * ring closing on him is the warning that buys — the answer to a Captain
   * winding up is to not be there, not to out-damage him.
   */
  protected override get isCommitted(): boolean {
    return this.charge !== null;
  }

  /**
   * The wind-up ring, hung off the attack animation actually starting rather
   * than off a hook in the base class — the swing is played from inside
   * Hunter.pursue, and this is the seam that needs nothing added there.
   */
  private beginChargeTell(): void {
    this.charge?.destroy();
    this.charge = new BossCharge(
      this.scene,
      this.x,
      this.y,
      CAPTAIN_CHARGE_COLOR,
      this.displayHeight * 0.6,
      HUNTER.meleeHitDelayMs,
    );
    // The tell ends exactly when the blade lands, so watching the ring close is
    // watching the hit arrive.
    this.scene.time.delayedCall(HUNTER.meleeHitDelayMs, () => {
      this.charge?.finish(true);
      this.charge = null;
    });
  }

  override takeDamage(amount: number): boolean {
    const killed = super.takeDamage(amount);
    captainTookDamage(this, this.emitter);
    return killed;
  }

  override destroy(fromScene?: boolean): void {
    this.charge?.destroy();
    this.charge = null;
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
