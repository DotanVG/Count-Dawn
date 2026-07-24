import Phaser from 'phaser';
import { PLAYER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { EVENTS, type GameEventEmitter } from '../game/events';
import { TEXTURES, animKey, type Dir4 } from '../utils/assetKeys';
import { angleToDir4 } from '../utils/direction';
import { VAMPIRE_ATTACK_DURATION_MS } from '../utils/animations';

/**
 * The vampire. Handles movement, directional animation, health, damage
 * invulnerability and the hurt flash. Attack timing lives in CombatSystem;
 * this class plays the matching animation via playAttackAnim().
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  health: number = PLAYER.maxHealth;
  /** Radians toward the current aim point; CombatSystem reads this. */
  aimAngle = 0;

  private invulnUntil = 0;
  private attackAnimUntil = 0;
  private facing: Dir4 = 'down';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
  ) {
    super(scene, x, y, TEXTURES.vampireIdle, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(PLAYER.spriteScale);
    // Body in unscaled 64x64 texture space: a small circle around the torso/feet.
    this.setCircle(11, 21, 26);
    this.setCollideWorldBounds(true);
    this.setDepth(DEPTHS.player);
    this.play(animKey('vampire', 'idle', 'down'));
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
    this.updateAnimation(moveX !== 0 || moveY !== 0);
  }

  aimAt(worldX: number, worldY: number): void {
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, worldX, worldY);
    this.facing = angleToDir4(this.aimAngle);
  }

  /**
   * Called by CombatSystem the moment an attack fires. Holds the attack pose
   * for the FULL swing+magic-burst animation (400ms) so every frame actually
   * plays instead of being cut short by movement resuming — the flashy
   * charge/star-burst frames near the end were getting skipped entirely
   * before. The sprite itself also pops bigger for the swing (instead of a
   * separate overlay effect) so the small attack frames read as impact.
   */
  playAttackAnim(): void {
    this.attackAnimUntil = this.scene.time.now + VAMPIRE_ATTACK_DURATION_MS;
    // Held input can fire again before the previous animation finishes.
    // Force each accepted attack to restart instead of leaving the sprite
    // parked on the completed animation's final frame between strikes.
    this.play(animKey('vampire', 'attack', this.facing), false);

    this.scene.tweens.add({
      targets: this,
      scale: { from: PLAYER.spriteScale * 1.22, to: PLAYER.spriteScale },
      duration: 180,
      ease: 'Quad.easeOut',
    });
  }

  playDeathAnim(): void {
    this.play(animKey('vampire', 'death', this.facing), true);
  }

  /**
   * Called between rounds in the seamless day/night loop: the Player entity
   * persists across rounds (unlike GameFlowSystem, which is recreated), so
   * without this its `health` field would carry over from the previous
   * night instead of the HUD's fresh-looking bar actually meaning 100/100.
   */
  resetForNewRound(): void {
    this.health = PLAYER.maxHealth;
    this.invulnUntil = 0;
    this.clearTint();
    this.setTintMode(Phaser.TintModes.MULTIPLY);
    this.setAlpha(1);
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
      this.playDeathAnim();
      this.emitter.emit(EVENTS.PLAYER_DIED);
    }
  }

  private updateAnimation(moving: boolean): void {
    if (!this.isAlive) return;
    if (this.scene.time.now < this.attackAnimUntil) return; // let the strike finish

    const action = moving ? 'run' : 'idle';
    const key = animKey('vampire', action, this.facing);
    if (this.anims.currentAnim?.key !== key) {
      this.play(key, true);
    }
  }
}
