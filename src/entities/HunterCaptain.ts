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
    this.setScale(3.4);
    this.setDepth(DEPTHS.boss);
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

  /** Entrance flourish: bursts up from the floor with a camera shake. */
  playEntrance(): void {
    const targetScale = this.scaleX;
    this.setScale(0.5);
    this.scene.tweens.add({
      targets: this,
      scale: targetScale,
      duration: 450,
      ease: 'Back.easeOut',
    });
    this.scene.cameras.main.shake(250, 0.006);
  }
}
