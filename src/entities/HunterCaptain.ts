import Phaser from 'phaser';
import { BOSS, HUNTER, KNOCKBACK, type WeaponKind } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { EVENTS, type GameEventEmitter } from '../game/events';
import type { CharacterKey, Dir4 } from '../utils/assetKeys';
import { BossHealthBar } from '../ui/BossHealthBar';
import { ArmedHunter } from './ArmedHunter';
import { BossCharge } from './BossCharge';
import { Hunter, PILGRIM_LOOK, type HunterLook } from './Hunter';

/** Tint that separates the Captain from his men (dark blood-red armor look). */
export const CAPTAIN_TINT = 0xff9a7a;

/** What a Captain is called, by which of Romi's hunters he was grown from. */
export const CAPTAIN_NAMES: Partial<Record<CharacterKey, string>> = {
  pilgrim: 'Pilgrim Captain',
  huntress: 'Huntress Captain',
  farmer: 'Garlic Captain',
};

/** English plural for a boss name, for the banner's "Defeat the 2 …" case. */
export function pluralBossName(name: string): string {
  return `${name}s`;
}

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
  /**
   * What this boss is called, as a bare noun ("Priest", "Garlic Captain"). ONE
   * name per boss, used both over its head and in the HUD's objective banner —
   * the banner used to guess from the night number alone, which meant it said
   * "Hunter Captain" on a night the huntress turned up.
   */
  readonly bossName: string;
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
 * The melee boss: one of Romi's basic hunters — a pilgrim or a huntress —
 * scaled up, tinted, and much tougher, carrying the same weapon his men carry
 * and swinging it the same way. He extends ArmedHunter rather than Hunter
 * because there is no unarmed hunter left to be: every one of them arrives with
 * a spike, a fork or a torch, and a Captain who turned up empty-handed would be
 * the only human in the hall without one.
 */
export class HunterCaptain extends ArmedHunter implements CaptainTraits {
  readonly maxHealth = BOSS.health;
  readonly healthBar: BossHealthBar;
  readonly bossName: string;
  /** He rocks back a little, but the Count can't shove him around the hall. */
  protected override knockbackResistance = KNOCKBACK.bossFactor;

  /** The wind-up ring, live only between a swing starting and landing. */
  private charge: BossCharge | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
    look: HunterLook = PILGRIM_LOOK,
    weapon: WeaponKind = 'pitchfork',
  ) {
    super(scene, x, y, weapon, look, BOSS, BOSS.spriteScale);
    this.normalDepth = DEPTHS.boss;
    this.applyBaseTint();
    this.bossName = CAPTAIN_NAMES[look.charKey] ?? 'Hunter Captain';
    this.healthBar = new BossHealthBar(scene, this.bossName);
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
   * The tell rides the swing itself. It used to hang off ANIMATION_START, which
   * worked while a Captain's attack was a body animation; an ArmedHunter never
   * plays one — the strike lives on the prop — so there is no animation to
   * listen for and this is the seam instead.
   */
  protected override playSwing(dir: Dir4, aimAngle: number): void {
    this.beginChargeTell();
    super.playSwing(dir, aimAngle);
  }

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
    if (!this.scene) return; // already destroyed; see the note in Priest.destroy
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
