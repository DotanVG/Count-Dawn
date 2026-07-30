import Phaser from 'phaser';
import { PLAYER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import type { Player } from '../entities/Player';
import { Hunter } from '../entities/Hunter';
import { TEXTURES, ANIMS } from '../utils/assetKeys';
import { selectAutoAttackTarget } from './enemyNavigation';

/** The impact burst on a struck hunter — sized to read as a hit, not a spark. */
const HIT_BURST_SCALE = 1.8;

export interface CombatResolution {
  hits: number;
  kills: number;
  heavyHit: boolean;
  heavyKill: boolean;
}

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
    /**
     * Presentation callback runs while the target still exists. Returning true
     * marks a boss/heavy impact for the single post-swing camera response.
     */
    private readonly onImpact: (hunter: Hunter, killed: boolean) => boolean,
    private readonly onResolved: (resolution: CombatResolution) => void,
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
    const resolution: CombatResolution = {
      hits: 0,
      kills: 0,
      heavyHit: false,
      heavyKill: false,
    };
    for (const hunter of targets) {
      if (!hunter.active || !hunter.isAlive || hunter.isEntering) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, hunter.x, hunter.y);
      // Padding by half the target's body keeps big targets (the boss) fair to hit.
      if (dist > PLAYER.attackRange + hunter.displayWidth / 2) continue;

      const angleTo = Phaser.Math.Angle.Between(this.player.x, this.player.y, hunter.x, hunter.y);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(angleTo - this.player.aimAngle));
      if (diff > halfArc) continue;

      const killed = hunter.takeDamage(PLAYER.attackDamage);
      this.spawnHitMagic(hunter.x, hunter.y);
      const heavy = this.onImpact(hunter, killed);
      resolution.hits++;
      resolution.kills += killed ? 1 : 0;
      resolution.heavyHit ||= heavy;
      resolution.heavyKill ||= heavy && killed;
      if (killed) {
        this.onKill(hunter);
      } else {
        // Shove survivors away from the Count so the hit reads as an impact.
        hunter.applyKnockback(this.player.x, this.player.y);
      }
    }
    this.onResolved(resolution);
  }

  /**
   * Mobile's sword snaps only to a living, fully-entered hunter this swing can
   * reach. This prevents an off-canvas left-wall spawn from stealing aim from
   * the enemy standing beside the Count.
   */
  tryAutoAttack(targets: Hunter[]): void {
    const nearest = selectAutoAttackTarget(this.player, targets, PLAYER.attackRange);
    if (nearest) this.player.aimAt(nearest.x, nearest.y);
    this.tryAttack(targets);
  }

  /** One-shot magic burst on the hunter that got hit, self-destroying when it finishes. */
  private spawnHitMagic(x: number, y: number): void {
    const fx = this.scene.add
      .sprite(x, y, TEXTURES.vampireAttackMagic, 0)
      .setScale(HIT_BURST_SCALE)
      .setDepth(DEPTHS.attackFx);
    fx.play(ANIMS.hitMagic);
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
  }
}
