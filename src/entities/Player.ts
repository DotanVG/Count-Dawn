import Phaser from 'phaser';
import { DASH, PLAYER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { EVENTS, type GameEventEmitter } from '../game/events';
import { TEXTURES, animKey, type Dir4 } from '../utils/assetKeys';
import { angleToDir4 } from '../utils/direction';
import { VAMPIRE_ATTACK_DURATION_MS } from '../utils/animations';

/**
 * The vampire. Handles movement, the bat dash, directional animation, health,
 * damage invulnerability and the hurt flash. Attack timing lives in
 * CombatSystem; this class plays the matching animation via playAttackAnim().
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  health: number = PLAYER.maxHealth;
  /** Radians toward the current aim point; CombatSystem reads this. */
  aimAngle = 0;

  private invulnUntil = 0;
  private attackAnimUntil = 0;
  private dashUntil = 0;
  private nextDashAt = 0;
  private batForm = false;
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

  get isDashing(): boolean {
    return this.scene.time.now < this.dashUntil;
  }

  /** 0..1 — how much of the dash cooldown has recovered, for the HUD pip. */
  get dashCooldownProgress(): number {
    const remaining = this.nextDashAt - this.scene.time.now;
    if (remaining <= 0) return 1;
    return 1 - remaining / DASH.cooldownMs;
  }

  /** moveX/moveY is a normalized direction from InputController. */
  move(moveX: number, moveY: number): void {
    if (this.isDashing) return; // the dash owns the velocity until it ends
    this.setVelocity(moveX * PLAYER.moveSpeed, moveY * PLAYER.moveSpeed);
    this.updateAnimation(moveX !== 0 || moveY !== 0);
  }

  /**
   * The bat dash: a short, fast, invulnerable burst — the escape hatch from a
   * crowd of hunters and the answer to a garlic thrower's lock. Dashes in the
   * requested direction, or straight ahead (aim direction) when standing
   * still. Returns false if it's still on cooldown or he's down.
   */
  tryDash(dirX: number, dirY: number): boolean {
    const now = this.scene.time.now;
    if (!this.isAlive || this.isDashing || now < this.nextDashAt) return false;

    const dir = new Phaser.Math.Vector2(dirX, dirY);
    if (dir.lengthSq() < 0.01) dir.set(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
    dir.normalize();

    this.dashUntil = now + DASH.durationMs;
    this.nextDashAt = now + DASH.cooldownMs;
    // Invulnerable slightly past the burst so the escape lands clean.
    this.invulnUntil = Math.max(this.invulnUntil, now + DASH.invulnerabilityMs);
    this.facing = angleToDir4(Math.atan2(dir.y, dir.x));

    this.setVelocity(dir.x * DASH.speed, dir.y * DASH.speed);
    this.setBatForm(true);
    this.spawnDashTrail();

    this.scene.time.delayedCall(DASH.durationMs, () => {
      if (!this.active) return;
      this.setVelocity(0, 0);
      this.setBatForm(false);
    });

    return true;
  }

  /**
   * BAT PLACEHOLDER: the single place the Count stops being a man. Today it
   * just swaps to the run animation; when the bat spritesheet lands
   * (TEXTURES.bat + ANIMS.batFly) swap the texture/anim here and every user
   * gets it at once — the coffin fly-in/fly-out (GameScene.riseFromCoffin /
   * playVictoryOutro) AND the dash above. The same sheet will power the
   * future bat-minion summons that pull hunter aggro.
   */
  setBatForm(active: boolean): void {
    this.batForm = active;
    this.play(animKey('vampire', active ? 'run' : 'idle', this.facing), true);
  }

  /** Fading after-images strung along the dash path. */
  private spawnDashTrail(): void {
    for (let i = 0; i < DASH.afterimages; i++) {
      this.scene.time.delayedCall((DASH.durationMs / DASH.afterimages) * i, () => {
        if (!this.active) return;
        const ghost = this.scene.add
          .sprite(this.x, this.y, this.texture.key, this.frame.name)
          .setScale(this.scaleX, this.scaleY)
          .setDepth(DEPTHS.player - 1)
          .setTint(0x9d6bff)
          .setAlpha(0.5);
        this.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          scale: this.scaleX * 0.8,
          duration: 260,
          onComplete: () => ghost.destroy(),
        });
      });
    }
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
    this.dashUntil = 0;
    this.nextDashAt = 0;
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
    if (this.batForm) return; // bat form (dash / coffin flight) owns the sprite
    if (this.scene.time.now < this.attackAnimUntil) return; // let the strike finish

    const action = moving ? 'run' : 'idle';
    const key = animKey('vampire', action, this.facing);
    if (this.anims.currentAnim?.key !== key) {
      this.play(key, true);
    }
  }
}
