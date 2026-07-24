import Phaser from 'phaser';
import { PLAYER } from '../data/balance';
import { EVENTS, type GameEventEmitter } from '../game/events';
import { TEXTURES } from '../utils/assetKeys';

/**
 * The vampire. Handles movement, facing, health, damage invulnerability and
 * the hurt flash. Attacking lives in CombatSystem.
 *
 * Asset note: swap TEXTURES.vampire for a spritesheet + anims without touching
 * movement/health logic — only the constructor's display setup changes.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  health: number = PLAYER.maxHealth;
  /** Radians toward the current aim point; CombatSystem reads this. */
  aimAngle = 0;

  private invulnUntil = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
  ) {
    super(scene, x, y, TEXTURES.vampire);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(20, 4, 4);
    this.setCollideWorldBounds(true);
    this.setDepth(10);
  }

  get isAlive(): boolean {
    return this.health > 0;
  }

  get isInvulnerable(): boolean {
    return this.scene.time.now < this.invulnUntil;
  }

  /** moveX/moveY is a normalized direction from InputController. */
  move(moveX: number, moveY: number): void {
    this.setVelocity(moveX * PLAYER.moveSpeed, moveY * PLAYER.moveSpeed);
  }

  aimAt(worldX: number, worldY: number): void {
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, worldX, worldY);
    // Placeholder facing: subtle lean toward the aim side.
    this.setFlipX(Math.abs(Phaser.Math.Angle.Wrap(this.aimAngle)) > Math.PI / 2);
  }

  takeDamage(amount: number): void {
    if (!this.isAlive || this.isInvulnerable) return;

    this.health = Math.max(0, this.health - amount);
    this.invulnUntil = this.scene.time.now + PLAYER.invulnerabilityMs;
    this.emitter.emit(EVENTS.PLAYER_DAMAGED, this.health, PLAYER.maxHealth);

    this.scene.tweens.add({
      targets: this,
      alpha: 0.25,
      duration: 80,
      yoyo: true,
      repeat: Math.floor(PLAYER.invulnerabilityMs / 160) - 1,
      onComplete: () => this.setAlpha(1),
    });

    if (!this.isAlive) {
      this.setVelocity(0, 0);
      this.emitter.emit(EVENTS.PLAYER_DIED);
    }
  }
}
