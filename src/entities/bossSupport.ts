import { EVENTS, type GameEventEmitter } from '../game/events';
import type { BossHealthBar } from '../ui/BossHealthBar';
import type { Hunter } from './Hunter';

/**
 * Shared boss feedback for HunterCaptain, GarlicCaptain, CrossCaptain and Priest.
 * Ranged Captains have to extend GarlicThrower, so they cannot inherit from
 * the melee HunterCaptain.
 *
 * A boss is a hunter that is bigger, tougher, shrugs off knockback, and
 * carries his own health bar over his head.
 */
export interface BossTraits {
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

export function bossTookDamage(
  boss: Hunter & BossTraits,
  emitter: GameEventEmitter,
): void {
  boss.healthBar.setRatio(Math.max(0, boss.health) / boss.maxHealth);
  emitter.emit(EVENTS.BOSS_HEALTH_CHANGED, Math.max(0, boss.health), boss.maxHealth);
  boss.scene.cameras.main.shake(80, 0.004);
}

/**
 * Arrival flourish once he's walked in from off-screen and reached his
 * spot (called via Hunter.onEntranceArrived): a stomping scale-bounce and
 * a bigger camera shake than a regular hunter's entrance gets.
 */
export function playBossEntrance(boss: Hunter): void {
  const targetScale = boss.scaleX;
  boss.scene.tweens.add({
    targets: boss,
    scale: { from: targetScale * 1.18, to: targetScale },
    duration: 260,
    ease: 'Back.easeOut',
  });
  boss.scene.cameras.main.shake(250, 0.006);
}
