import Phaser from 'phaser';
import { BOSS, KNOCKBACK } from '../data/balance';
import { DEPTHS } from '../game/constants';
import type { GameEventEmitter } from '../game/events';
import { BossHealthBar } from '../ui/BossHealthBar';
import { GarlicThrower } from './GarlicThrower';
import {
  CAPTAIN_TINT,
  captainTookDamage,
  type CaptainTraits,
} from './HunterCaptain';

/** A Captain drawn from the ranged hunter type, armed with one bulb per hand. */
export class GarlicCaptain extends GarlicThrower implements CaptainTraits {
  readonly maxHealth = BOSS.health;
  readonly healthBar: BossHealthBar;
  protected override knockbackResistance = KNOCKBACK.bossFactor;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
  ) {
    super(scene, x, y, {
      stats: BOSS,
      spriteScale: BOSS.spriteScale,
      garlicPerThrow: 2,
      garlicThrowGapMs: BOSS.garlicThrowGapMs,
    });
    this.normalDepth = DEPTHS.boss;
    this.applyBaseTint();
    this.healthBar = new BossHealthBar(scene, 'Garlic Captain');
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
