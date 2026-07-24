import Phaser from 'phaser';
import { BOSS } from '../data/balance';
import { EVENTS, type GameEventEmitter } from '../game/events';
import { TEXTURES } from '../utils/assetKeys';
import { Hunter } from './Hunter';

/**
 * The boss. One phase, bigger, tougher, hits harder; broadcasts its health so
 * the HUD boss bar can follow without a direct reference.
 */
export class HunterCaptain extends Hunter {
  readonly maxHealth = BOSS.health;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
  ) {
    super(scene, x, y, TEXTURES.boss, BOSS);
    this.setDepth(6);
  }

  override takeDamage(amount: number): boolean {
    const killed = super.takeDamage(amount);
    this.emitter.emit(EVENTS.BOSS_HEALTH_CHANGED, Math.max(0, this.health), this.maxHealth);

    // Stronger hit feedback than a regular hunter.
    this.scene.cameras.main.shake(80, 0.004);

    return killed;
  }

  /** Entrance flourish so the spawn reads clearly even with placeholder art. */
  playEntrance(): void {
    this.setScale(0.2);
    this.scene.tweens.add({
      targets: this,
      scale: 1,
      duration: 450,
      ease: 'Back.easeOut',
    });
    this.scene.cameras.main.shake(250, 0.006);
  }
}
