import Phaser from 'phaser';
import { BAT, DASH, PLAYER } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { EVENTS, type GameEventEmitter } from '../game/events';
import { ANIMS, TEXTURES, animKey, type Dir4 } from '../utils/assetKeys';
import { angleToDir4 } from '../utils/direction';
import { VAMPIRE_ATTACK_DURATION_MS } from '../utils/animations';

/** The charge-and-burst stretch of the magic layer, used as his cast. */
const CAST_FLARE_FRAMES = [3, 4, 5, 6, 7, 8];
const CAST_FLARE_SCALE = 1.25;
/**
 * How far out along his aim the spell appears, in world pixels. It scales with
 * the flare so a bigger burst still clears his face rather than sitting on it.
 */
const CAST_FLARE_DISTANCE = 62;

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
  /**
   * What is currently keeping him a bat: his own dash, or a coffin flight.
   * The dash must only undo a bat form it still owns — see setBatForm.
   */
  private batFormCause: 'flight' | 'dash' | null = null;
  /**
   * The dash's queued shape-restore, held so a death can cancel it. Left to
   * run it plays his idle pose over the death animation — see stopForDeath.
   */
  private dashRestore?: Phaser.Time.TimerEvent;
  private facing: Dir4 = 'down';
  /** Display scale before the bat-form shrink — see setBaseScale. */
  private baseScale: number = PLAYER.spriteScale;
  /**
   * The swing's size-pop tween, held so setBatForm can stop it. It animates
   * `scale` directly, so if it were still running when he turns into a bat it
   * would keep driving the sprite back up to full vampire size.
   */
  private attackPopTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly emitter: GameEventEmitter,
  ) {
    super(scene, x, y, TEXTURES.vampireIdle, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setBaseScale(PLAYER.spriteScale);
    // Body in unscaled 64x64 texture space: a circle over his torso and legs.
    // Romi's Count stands taller in the frame than the pack he replaced, so
    // this is wider and lower than the old one — deliberately sized to land on
    // the same on-screen radius at the new sprite scale, because the hitbox is
    // how often a hunter's body actually touches him. The bat sheet uses the
    // same 64x64 frame, so the body survives the swap.
    this.setCircle(15, 16, 23);
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
    this.setBatForm(true, 'dash');
    this.spawnDashTrail();

    this.dashRestore = this.scene.time.delayedCall(DASH.durationMs, () => {
      this.dashRestore = undefined;
      if (!this.active) return;
      // Dashing into an open coffin ends the night mid-dash, and the coffin
      // flight takes the bat over. This timer is still queued from before that
      // happened, so it has to check it still owns the shape — otherwise it
      // turns him back into a man halfway into his own coffin, which is the
      // intermittent bug this guard exists for.
      if (this.batFormCause !== 'dash') return;
      this.setVelocity(0, 0);
      this.setBatForm(false, 'dash');
    });

    return true;
  }

  /**
   * The single place the Count stops being a man. Every caller goes through
   * here — the dash above, and the coffin fly-out/fly-in
   * (GameScene.riseFromCoffin / playVictoryOutro) — so the bat sheet, the
   * mirroring and the *poof* only exist once. The same sheet will dress the
   * future bat-minion summons that pull hunter aggro.
   *
   * The bat has no directional rows: it is painted facing right, so left is
   * flipX and up/down keep whatever mirroring the last horizontal facing set.
   */
  setBatForm(active: boolean, cause: 'flight' | 'dash' = 'flight'): void {
    if (this.batForm === active) {
      // Already the right shape, but the OWNER may be changing hands — which
      // matters. Dash into an open coffin and the flight claims a bat the dash
      // is still holding; without this the dash's own cleanup would fire a
      // moment later and turn him back into a man mid-flight.
      if (active && cause !== this.batFormCause) {
        this.batFormCause = cause;
        this.emitter.emit(EVENTS.BAT_FORM_CHANGED, true, cause);
      }
      return;
    }
    this.batForm = active;
    this.batFormCause = active ? cause : null;
    // A swing landed just before the shape change leaves its size-pop tween
    // running; left alone it would fight applyFormScale below and stretch the
    // bat back to full vampire size for the rest of the dash.
    this.attackPopTween?.stop();
    this.attackPopTween = undefined;
    this.playTransformPuff();

    if (active) {
      this.play(ANIMS.batFly, true);
      this.setFlipX(this.facing === 'left');
    } else {
      this.setFlipX(false); // the vampire sheet has real left/right rows
      this.play(animKey('vampire', 'idle', this.facing), true);
    }
    this.applyFormScale();
    this.emitter.emit(EVENTS.BAT_FORM_CHANGED, active, cause);
  }

  /**
   * Sets the Count's display scale, which the bat form then shrinks. Callers
   * that animate his size (the coffin flight spiral) must use this rather than
   * setScale, or the bat would be tweened back up to full vampire size
   * mid-flight.
   */
  setBaseScale(scale: number): this {
    this.baseScale = scale;
    return this.applyFormScale();
  }

  /** The scale the Count would render at if he were not currently a bat. */
  get displayBaseScale(): number {
    return this.baseScale;
  }

  /** Mirrors the bat to match which way the flight is actually carrying him. */
  faceBatTowards(dx: number): void {
    if (!this.batForm || Math.abs(dx) < 0.05) return;
    this.setFlipX(dx < 0);
  }

  private applyFormScale(): this {
    this.setScale(this.baseScale * (this.batForm ? BAT.scaleFactor : 1));
    return this;
  }

  /**
   * The *poof*: a ball of smoke that swallows him at the instant the shape
   * changes, in either direction, so man and bat never visibly morph into one
   * another — they are simply hidden by the burst for a frame.
   */
  private playTransformPuff(): void {
    const puff = this.scene.add
      .particles(this.x, this.y - 10, TEXTURES.particle, {
        speed: { min: 40, max: 160 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 260, max: 560 },
        scale: { start: 2.8, end: 0 },
        alpha: { start: 0.85, end: 0 },
        tint: [0x9d6bff, 0x6b4d8f, 0x241830, 0xe8ddff],
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx);

    puff.explode(BAT.puffParticles);
    this.scene.time.delayedCall(700, () => puff.destroy());
  }

  /** Fading after-images strung along the dash path. */
  private spawnDashTrail(): void {
    for (let i = 0; i < DASH.afterimages; i++) {
      this.scene.time.delayedCall((DASH.durationMs / DASH.afterimages) * i, () => {
        if (!this.active) return;
        const ghost = this.scene.add
          .sprite(this.x, this.y, this.texture.key, this.frame.name)
          .setScale(this.scaleX, this.scaleY)
          .setFlipX(this.flipX)
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

  /**
   * Where a strike would go, and which way he is drawn. The Count faces the
   * cursor: he is aiming, not steering, so the pointer is the thing he is
   * looking at whether he is standing still or running the other way.
   *
   * Note this deliberately does NOT re-mirror the bat: GameScene aims at the
   * cursor every frame, which would otherwise spin the bat around to face the
   * pointer mid-dash instead of the way he is actually hurtling. In bat form
   * the mirror belongs to the dash direction (setBatForm) or the coffin flight
   * (faceBatTowards); `facing` here only decides which vampire row he lands
   * back on.
   */
  aimAt(worldX: number, worldY: number): void {
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, worldX, worldY);
    this.facing = angleToDir4(this.aimAngle);
  }

  /**
   * Point him somewhere without a world position to aim at — the cutscenes,
   * which hand him to the player already facing the room rather than facing
   * whatever the last flight left him on.
   */
  setFacing(dir: Dir4): void {
    this.facing = dir;
    if (!this.batForm) this.play(animKey('vampire', 'idle', dir), true);
  }

  /**
   * Called by CombatSystem the moment an attack fires. Holds the attack pose
   * for the FULL swing+magic-burst animation (400ms) so every frame actually
   * plays instead of being cut short by movement resuming — the flashy
   * charge/star-burst frames near the end were getting skipped entirely
   * before. The sprite itself also pops bigger for the swing (instead of a
   * separate overlay effect) so the small attack frames read as impact.
   *
   * Does nothing in bat form. The strike itself still lands — CombatSystem
   * owns that — but a bat has no vampire pose to strike in, and playing one
   * here would swap the bat sheet out mid-dash and leave the Count dashing as
   * a man. Bat form owns the sprite for as long as it lasts, exactly as in
   * updateAnimation.
   */
  playAttackAnim(): void {
    if (this.batForm) return;

    this.spawnCastFlare();
    this.attackAnimUntil = this.scene.time.now + VAMPIRE_ATTACK_DURATION_MS;
    // Held input can fire again before the previous animation finishes.
    // Force each accepted attack to restart instead of leaving the sprite
    // parked on the completed animation's final frame between strikes.
    this.play(animKey('vampire', 'attack', this.facing), false);

    this.attackPopTween?.stop();
    this.attackPopTween = this.scene.tweens.add({
      targets: this,
      scale: { from: this.baseScale * 1.22, to: this.baseScale },
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => (this.attackPopTween = undefined),
    });
  }

  /**
   * The magic Romi's attack poses do not contain. She drew him rearing up and
   * roaring, not casting, so the spell itself is the CraftPix pack's
   * effects-only layer thrown out along his aim — close enough to his raised
   * hands that the pose reads as the thing that launched it, far enough that
   * it does not sit on top of his face. The burst that lands on a hunter is a
   * separate one, spawned by CombatSystem on the target.
   */
  private spawnCastFlare(): void {
    const flare = this.scene.add
      .sprite(
        this.x + Math.cos(this.aimAngle) * CAST_FLARE_DISTANCE,
        this.y + Math.sin(this.aimAngle) * CAST_FLARE_DISTANCE - 6,
        TEXTURES.vampireAttackMagic,
        CAST_FLARE_FRAMES[0],
      )
      .setDepth(DEPTHS.attackFx)
      .setScale(this.baseScale * CAST_FLARE_SCALE)
      .setAlpha(0.9);

    flare.play(ANIMS.castFlare);
    flare.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => flare.destroy());
  }

  /**
   * Drops back to the idle pose. Cutscenes need this explicitly: nothing is
   * calling updateAnimation for them, so a strike would otherwise leave the
   * Count frozen on the attack animation's final frame for the rest of the
   * scene.
   */
  playIdleAnim(): void {
    if (this.batForm) return;
    this.attackAnimUntil = 0;
    this.play(animKey('vampire', 'idle', this.facing), true);
  }

  /**
   * Silences everything that could animate over his death, so whichever death
   * animation plays next is the last thing to touch the sprite.
   *
   * This is not housekeeping — it is the fix for a hard freeze. The dawn ending
   * waits on the sunburn's ANIMATION_COMPLETE before it shows the game-over
   * screen. Die within a dash's 175ms and the dash's queued restore played his
   * idle pose over the sunburn, so it never completed, the event never fired,
   * and the run sat there forever with the music still going.
   */
  private stopForDeath(): void {
    this.dashRestore?.remove();
    this.dashRestore = undefined;
    this.dashUntil = 0;
    this.attackAnimUntil = 0;
    this.attackPopTween?.stop();
    this.attackPopTween = undefined;
    this.setVelocity(0, 0);

    // Drop bat form WITHOUT going through setBatForm: that plays an idle pose,
    // which is the very thing being guarded against here.
    if (this.batForm) {
      this.batForm = false;
      this.batFormCause = null;
      this.setFlipX(false);
      this.applyFormScale();
      this.emitter.emit(EVENTS.BAT_FORM_CHANGED, false, 'flight');
    }
  }

  playDeathAnim(): void {
    this.stopForDeath();
    this.play(animKey('vampire', 'death', this.facing), true);
  }

  /**
   * The other ending. Where playDeathAnim is just the fall, this carries on
   * through Romi's burning frames and then her ash frames — the Count catching
   * the sunrise, which is the one death the game is actually named after.
   */
  playSunburnAnim(): void {
    this.stopForDeath();
    this.play(animKey('vampire', 'sunburn', this.facing), true);
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

  /**
   * Blood drunk past the night's quota goes into the Count instead. Returns
   * the amount actually restored, so callers can skip the effects when he was
   * already at full health.
   */
  heal(amount: number): number {
    if (!this.isAlive) return 0;
    const restored = Math.min(amount, PLAYER.maxHealth - this.health);
    if (restored <= 0) return 0;

    this.health += restored;
    this.emitter.emit(EVENTS.PLAYER_HEALED, this.health, PLAYER.maxHealth);
    return restored;
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
