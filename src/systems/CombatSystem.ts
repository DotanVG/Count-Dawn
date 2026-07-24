import Phaser from 'phaser';
import { PLAYER } from '../data/balance';
import { COLORS, DEPTHS } from '../game/constants';
import type { Player } from '../entities/Player';
import { Hunter } from '../entities/Hunter';

/**
 * The player's directional melee strike: cooldown, arc hit detection against
 * all living hunters (boss included), and a short-lived arc visualization.
 */
export class CombatSystem {
  private nextAttackAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    /** Kill callback so the scene owns drops/removal, not the combat math. */
    private readonly onKill: (hunter: Hunter) => void,
    private readonly onAttack: () => void,
  ) {}

  /** Fraction of the cooldown already recovered, 0..1, for the HUD meter. */
  get cooldownProgress(): number {
    const remaining = this.nextAttackAt - this.scene.time.now;
    if (remaining <= 0) return 1;
    return 1 - remaining / PLAYER.attackCooldownMs;
  }

  tryAttack(targets: Hunter[]): void {
    const now = this.scene.time.now;
    if (now < this.nextAttackAt || !this.player.isAlive) return;
    this.nextAttackAt = now + PLAYER.attackCooldownMs;

    this.player.playAttackAnim();
    this.onAttack();
    this.drawArc();

    const halfArc = Phaser.Math.DegToRad(PLAYER.attackArcHalfAngleDeg);
    for (const hunter of targets) {
      if (!hunter.active || !hunter.isAlive) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, hunter.x, hunter.y);
      // Padding by half the target's body keeps big targets (the boss) fair to hit.
      if (dist > PLAYER.attackRange + hunter.displayWidth / 2) continue;

      const angleTo = Phaser.Math.Angle.Between(this.player.x, this.player.y, hunter.x, hunter.y);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(angleTo - this.player.aimAngle));
      if (diff > halfArc) continue;

      if (hunter.takeDamage(PLAYER.attackDamage)) {
        this.onKill(hunter);
      }
    }
  }

  private drawArc(): void {
    const halfArc = Phaser.Math.DegToRad(PLAYER.attackArcHalfAngleDeg);
    const g = this.scene.add.graphics({ x: this.player.x, y: this.player.y }).setDepth(DEPTHS.attackFx);
    g.fillStyle(COLORS.attackArc, 0.35);
    g.slice(0, 0, PLAYER.attackRange, this.player.aimAngle - halfArc, this.player.aimAngle + halfArc);
    g.fillPath();
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 130,
      onComplete: () => g.destroy(),
    });
  }
}
