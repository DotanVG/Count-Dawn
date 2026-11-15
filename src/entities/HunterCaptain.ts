import Phaser from 'phaser';
import { BOSS, HUNTER, KNOCKBACK, type WeaponKind } from '../data/balance';
import { DEPTHS } from '../game/constants';
import type { GameEventEmitter } from '../game/events';
import { CAPTAIN_CHARGE_COLOR, CAPTAIN_NAMES, CAPTAIN_TINT } from '../data/bossPresentation';
import type { Dir4 } from '../utils/assetKeys';
import { BossHealthBar } from '../ui/BossHealthBar';
import { ArmedHunter } from './ArmedHunter';
import { BossCharge } from './BossCharge';
import { bossTookDamage, playBossEntrance, type BossTraits } from './bossSupport';
import { PILGRIM_LOOK, type HunterLook, type HunterStats } from './Hunter';

/**
 * The melee boss: one of Romi's basic hunters — a pilgrim or a huntress —
 * scaled up, tinted, and much tougher, carrying the same weapon his men carry
 * and swinging it the same way. He extends ArmedHunter rather than Hunter
 * because there is no unarmed hunter left to be: every one of them arrives with
 * a spike, a fork or a torch, and a Captain who turned up empty-handed would be
 * the only human in the hall without one.
 */
export class HunterCaptain extends ArmedHunter implements BossTraits {
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
    /** Overridable so the cold open can march him at the squad's pace instead of his own. */
    stats: HunterStats = BOSS,
    /** False for the cold open's scenery Captains — they are dressing, not a fight the player tracks. */
    showHealthBar: boolean = true,
  ) {
    super(scene, x, y, weapon, look, stats, BOSS.spriteScale);
    this.normalDepth = DEPTHS.boss;
    this.applyBaseTint();
    this.bossName = CAPTAIN_NAMES[look.charKey] ?? 'Hunter Captain';
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
    bossTookDamage(this, this.emitter);
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
    playBossEntrance(this);
  }
}
