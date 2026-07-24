import Phaser from 'phaser';
import { BOSS } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { EVENTS, type GameEventEmitter } from '../game/events';
import { Hunter } from './Hunter';

/** Tint that separates the Captain from his men (dark blood-red armor look). */
const CAPTAIN_TINT = 0xff9a7a;

/**
 * The boss. Same sheet as a hunter but much larger, tinted, tougher;
 * broadcasts its health so the HUD boss bar can follow.
 */
export class HunterCaptain extends Hunter {
  readonly maxHealth = BOSS.health;

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
  }

  protected override applyBaseTint(): void {
    this.setTint(CAPTAIN_TINT);
  }

  override takeDamage(amount: number): boolean {
    const killed = super.takeDamage(amount);
    this.emitter.emit(EVENTS.BOSS_HEALTH_CHANGED, Math.max(0, this.health), this.maxHealth);

    // Stronger hit feedback than a regular hunter.
    this.scene.cameras.main.shake(80, 0.004);

    return killed;
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
