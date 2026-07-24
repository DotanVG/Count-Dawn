import Phaser from 'phaser';
import { PLAYER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import type { Player } from '../entities/Player';
import { Hunter } from '../entities/Hunter';
import { TEXTURES, ANIMS } from '../utils/assetKeys';

/**
 * The player's directional melee strike: cooldown and arc hit detection
 * against all living hunters (boss included). No overlay on the player
 * himself — the attack sprite pops bigger instead (Player.playAttackAnim) so
 * the small pixel-art frames read clearly. Every landed hit spawns a
 * standalone magic-burst effect (the Vampires1_Attack_magic sheet) at the
 * TARGET's position, separate from the player's own attack animation.
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

    const halfArc = Phaser.Math.DegToRad(PLAYER.attackArcHalfAngleDeg);
    for (const hunter of targets) {
      if (!hunter.active || !hunter.isAlive) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, hunter.x, hunter.y);
      // Padding by half the target's body keeps big targets (the boss) fair to hit.
      if (dist > PLAYER.attackRange + hunter.displayWidth / 2) continue;

      const angleTo = Phaser.Math.Angle.Between(this.player.x, this.player.y, hunter.x, hunter.y);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(angleTo - this.player.aimAngle));
      if (diff > halfArc) continue;

      const killed = hunter.takeDamage(PLAYER.attackDamage);
      this.spawnHitMagic(hunter.x, hunter.y);
      if (killed) {
        this.onKill(hunter);
      } else {
        // Shove survivors away from the Count so the hit reads as an impact.
        hunter.applyKnockback(this.player.x, this.player.y);
      }
    }
  }

  /** One-shot magic burst on the hunter that got hit, self-destroying when it finishes. */
  private spawnHitMagic(x: number, y: number): void {
    const fx = this.scene.add.sprite(x, y, TEXTURES.vampireAttackMagic, 0).setDepth(DEPTHS.attackFx);
    fx.play(ANIMS.hitMagic);
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }
}
