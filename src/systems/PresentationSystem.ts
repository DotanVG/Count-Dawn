import Phaser from 'phaser';
import { POLISH, scaledParticleCount, type PolishProfile } from '../data/polish';
import { ARENA, DEPTHS, GAME_HEIGHT, GAME_WIDTH } from '../game/constants';
import type { Hunter } from '../entities/Hunter';
import type { Player } from '../entities/Player';
import { TEXTURES } from '../utils/assetKeys';
import {
  TORCH_X_CENTERS,
  TORCH_Y,
  WINDOW_X_CENTERS,
  WINDOW_Y,
} from '../world/CastleMap';

type Actor = Phaser.GameObjects.Sprite;
type ScreenEffectKind = 'bolt' | 'overlay';

function particleBudget(profile: PolishProfile, share: number): number {
  return Math.max(8, Math.floor(profile.maxActiveParticles * share));
}

/**
 * Scene-owned presentation authority. It deliberately has no gameplay rules:
 * callers report resolved events, and this class caps, pools, restores, and
 * cleans every visual response.
 */
export class PresentationSystem {
  private static readonly instances = new WeakMap<Phaser.Scene, PresentationSystem>();

  static forScene(scene: Phaser.Scene): PresentationSystem | undefined {
    return PresentationSystem.instances.get(scene);
  }

  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly baseZoom: number;
  private readonly hitParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly deathParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly lightningParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly smokeParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly movementParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly ambientParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flashOverlay: Phaser.GameObjects.Rectangle;
  private readonly redVignette: Phaser.GameObjects.Graphics;
  private readonly floorHaze: Phaser.GameObjects.Ellipse;
  private readonly torchGlows: Phaser.GameObjects.Arc[] = [];
  private readonly windowGlows: Phaser.GameObjects.Ellipse[] = [];
  private readonly shadows = new Map<Actor, Phaser.GameObjects.Ellipse>();
  private readonly ownedTweens = new Set<Phaser.Tweens.Tween>();
  private ambientTimer: Phaser.Time.TimerEvent | null = null;
  private hitStopTimer: Phaser.Time.TimerEvent | null = null;
  private zoomTween: Phaser.Tweens.Tween | null = null;
  private playerGlow: Phaser.Filters.Glow | null = null;
  private playerGlowTarget: Player | null = null;
  private lastShakeAt = -Infinity;
  private lastHitStopAt = -Infinity;
  private lastMovementParticleAt = -Infinity;
  private activeScreenEffects = 0;
  private activeBolts = 0;
  private healthVignetteAlpha = 0;
  private countdownVignetteAlpha = 0;
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly profile: PolishProfile,
  ) {
    PresentationSystem.instances.set(scene, this);
    this.camera = scene.cameras.main;
    this.baseZoom = this.camera.zoom;

    this.hitParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 55, max: 190 },
        angle: { min: 0, max: 360 },
        gravityY: 155,
        lifespan: { min: 180, max: POLISH.particles.hitLifetimeMs },
        scale: { start: 1.15, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint: [0xf25151, 0xb10f2e, 0x5c0715],
        maxParticles: particleBudget(profile, 0.18),
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx + 1);
    this.deathParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 80, max: 250 },
        angle: { min: 0, max: 360 },
        gravityY: 210,
        lifespan: { min: 260, max: 610 },
        scale: { start: 1.45, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xff6b67, 0xc41e2f, 0x730d24],
        maxParticles: particleBudget(profile, 0.24),
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx + 1);
    this.lightningParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 95, max: 310 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 170, max: 430 },
        scale: { start: 1.3, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffffff, 0xffef88, 0xffbd2e],
        blendMode: 'ADD',
        maxParticles: particleBudget(profile, 0.24),
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx + 6);
    this.smokeParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speedX: { min: -24, max: 24 },
        speedY: { min: -55, max: -18 },
        lifespan: { min: 450, max: POLISH.particles.smokeLifetimeMs },
        scale: { start: 2.1, end: 4.2 },
        alpha: { start: 0.25, end: 0 },
        tint: [0x332b3d, 0x5a5065],
        maxParticles: particleBudget(profile, 0.13),
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx - 1);
    this.movementParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 35, max: 115 },
        angle: { min: 0, max: 360 },
        lifespan: { min: 210, max: 470 },
        scale: { start: 1.45, end: 0 },
        alpha: { start: 0.76, end: 0 },
        tint: [0x241830, 0x6b4d8f, 0x9d6bff, 0xe8ddff],
        maxParticles: particleBudget(profile, 0.21),
        emitting: false,
      })
      .setDepth(DEPTHS.attackFx);
    this.ambientParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speedX: { min: -8, max: 8 },
        speedY: { min: -13, max: -3 },
        lifespan: { min: 1900, max: 3400 },
        scale: { start: 0.45, end: 0.15 },
        alpha: { start: 0.18, end: 0 },
        tint: [0xb4a8c7, 0xffc36b],
        maxParticles: POLISH.particles.maxAmbientActive,
        emitting: false,
      })
      .setDepth(DEPTHS.groundFx - 1);

    this.floorHaze = scene.add
      .ellipse(
        GAME_WIDTH / 2,
        ARENA.bottom - 10,
        GAME_WIDTH * 0.9,
        105,
        0x8c789f,
        profile.quality === 'minimal' ? 0 : 0.035,
      )
      .setDepth(DEPTHS.floor + 1)
      .setBlendMode(Phaser.BlendModes.ADD);

    for (let index = 0; index < TORCH_X_CENTERS.length; index++) {
      const glow = scene.add
        .circle(
          TORCH_X_CENTERS[index],
          TORCH_Y,
          52,
          0xff9a3d,
          POLISH.atmosphere.torchGlowAlpha,
        )
        .setDepth(DEPTHS.torch - 1)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.torchGlows.push(glow);

      if (!profile.reducedMotion && profile.quality !== 'minimal') {
        const tween = scene.tweens.add({
          targets: glow,
          alpha: {
            from: POLISH.atmosphere.torchGlowAlpha * 0.72,
            to: POLISH.atmosphere.torchGlowAlpha * 1.18,
          },
          scale: { from: 0.92, to: 1.07 },
          duration: 780 + index * 137,
          delay: index * 91,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.ownedTweens.add(tween);
      }
    }

    for (const x of WINDOW_X_CENTERS) {
      this.windowGlows.push(
        scene.add
          .ellipse(x, WINDOW_Y + 4, 125, 176, 0xffb458, 0)
          .setDepth(DEPTHS.wall - 1)
          .setBlendMode(Phaser.BlendModes.ADD),
      );
    }

    this.flashOverlay = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(DEPTHS.ultOverlay + 1);

    this.redVignette = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(DEPTHS.ultOverlay + 1)
      .setAlpha(0);
    this.drawVignette();

    if (profile.enableAmbientParticles) {
      this.ambientTimer = scene.time.addEvent({
        delay: POLISH.atmosphere.ambientDustFrequencyMs,
        loop: true,
        callback: () => this.emitAmbientMote(),
      });
    }
  }

  /** Creates and follows cheap floor ellipses for living actors. */
  syncActorShadows(player: Player, hunters: readonly Hunter[]): void {
    if (this.destroyed) return;
    const actors: Actor[] = player.active ? [player, ...hunters] : [...hunters];
    const active = new Set(actors);

    for (const actor of actors) {
      let shadow = this.shadows.get(actor);
      if (!shadow) {
        shadow = this.scene.add
          .ellipse(actor.x, actor.y, 35, 13, 0x07040c, 0.36)
          .setDepth(DEPTHS.groundFx - 1);
        this.shadows.set(actor, shadow);
      }
      shadow
        .setPosition(actor.x, actor.y + Math.max(12, actor.displayHeight * 0.28))
        .setScale(
          Phaser.Math.Clamp(actor.displayWidth / 58, 0.72, 1.75),
          Phaser.Math.Clamp(actor.displayWidth / 68, 0.68, 1.45),
        )
        .setVisible(actor.active && actor.visible && actor.alpha > 0.08);
    }

    for (const [actor, shadow] of this.shadows) {
      if (!actor.active || !active.has(actor)) {
        shadow.destroy();
        this.shadows.delete(actor);
      }
    }

    const body = player.body as Phaser.Physics.Arcade.Body | null;
    const movementDelay = this.profile.isTouch ? 155 : 105;
    if (
      body &&
      this.profile.quality !== 'minimal' &&
      body.velocity.lengthSq() > 360 * 360 &&
      this.scene.time.now - this.lastMovementParticleAt >= movementDelay
    ) {
      this.lastMovementParticleAt = this.scene.time.now;
      this.smokeParticles.emitParticleAt(
        player.x + Phaser.Math.Between(-8, 8),
        player.y + player.displayHeight * 0.28,
        1,
      );
    }
  }

  setNightProgress(progress: number): void {
    const p = Phaser.Math.Clamp(progress, 0, 1);
    const preDawn = Phaser.Math.Easing.Cubic.In(Phaser.Math.Clamp((p - 0.58) / 0.42, 0, 1));
    for (const glow of this.windowGlows) {
      glow.setAlpha(POLISH.atmosphere.windowGlowAlpha * preDawn);
      glow.setScale(0.85 + preDawn * 0.28, 0.9 + preDawn * 0.2);
    }
    this.floorHaze.setAlpha(
      this.profile.quality === 'minimal' ? 0 : 0.035 + preDawn * 0.025,
    );
  }

  /**
   * Per-target response. It runs before canonical death cleanup, so impact
   * coordinates and boss size are still valid.
   */
  combatImpact(hunter: Hunter, killed: boolean, boss: boolean): void {
    if (this.destroyed) return;
    const count = boss
      ? killed
        ? POLISH.particles.bossKillCount
        : POLISH.particles.bossHitCount
      : killed
        ? POLISH.particles.killCount
        : POLISH.particles.hitCount;
    const emitter = killed ? this.deathParticles : this.hitParticles;
    emitter.explode(scaledParticleCount(this.profile, count), hunter.x, hunter.y);

    if (!killed && !boss && hunter.active) this.punchActor(hunter);
  }

  /** One camera/time response for a whole accepted swing, not per enemy. */
  combatResolved(
    hits: number,
    kills: number,
    bossHit: boolean,
    bossKilled: boolean,
    canResumePhysics: () => boolean,
  ): void {
    if (this.destroyed) return;
    if (hits === 0) {
      this.missResponse();
      return;
    }

    const intensity = bossKilled
      ? POLISH.camera.bossKillShakeIntensity
      : kills > 0
        ? POLISH.camera.killShakeIntensity
        : bossHit
          ? POLISH.camera.bossHitShakeIntensity
          : POLISH.camera.hitShakeIntensity;
    const shakeDuration = bossKilled
      ? POLISH.camera.bossKillShakeDurationMs
      : kills > 0
        ? POLISH.camera.killShakeDurationMs
        : POLISH.camera.hitShakeDurationMs;
    this.shake(shakeDuration, intensity);

    if (bossKilled) {
      this.flash(0xffe6c7, POLISH.flashes.killMs, 0.2);
    }
    if (kills > 0 || bossHit) {
      this.zoomPunch(POLISH.camera.zoomPunch);
    }
    const hitStopMs = bossHit
      ? POLISH.hitStop.bossMs
      : kills > 0
        ? POLISH.hitStop.killMs
        : POLISH.hitStop.regularMs;
    this.hitStop(hitStopMs, canResumePhysics);
  }

  playerDamaged(player: Player, health: number, maxHealth: number): void {
    this.hitParticles.explode(
      scaledParticleCount(this.profile, POLISH.particles.playerHitCount),
      player.x,
      player.y,
    );
    this.shake(
      POLISH.camera.killShakeDurationMs,
      POLISH.camera.playerHitShakeIntensity,
    );
    this.flash(0x9b1028, POLISH.flashes.playerHitMs, POLISH.flashes.maxAlpha);
    this.setHealthRatio(maxHealth > 0 ? health / maxHealth : 0);
  }

  setHealthRatio(ratio: number): void {
    const low = 1 - Phaser.Math.Clamp(ratio / 0.3, 0, 1);
    this.healthVignetteAlpha = POLISH.atmosphere.lowHealthVignetteStrength * low;
    this.syncVignette();
  }

  /** Ends countdown urgency without erasing a legitimate low-health warning. */
  clearCountdownUrgency(): void {
    this.countdownVignetteAlpha = 0;
    this.syncVignette();
  }

  dashChanged(_player: Player, active: boolean): void {
    // Player owns the transformation puff and after-images; the central layer
    // adds only the camera response so the existing dash visuals are not
    // duplicated.
    if (active) this.shake(55, POLISH.camera.dashShakeIntensity);
  }

  landingImpact(): void {
    this.shake(120, POLISH.camera.killShakeIntensity);
    this.zoomPunch(1.01, 80);
  }

  batSpawnPuff(x: number, y: number): void {
    this.movementParticles.explode(
      scaledParticleCount(this.profile, POLISH.particles.dashPuffCount),
      x,
      y,
    );
  }

  ultimateAnticipation(player: Player): void {
    this.zoomPunch(POLISH.camera.ultimateZoom, POLISH.ultimate.anticipationMs);
    this.lightningParticles.explode(
      scaledParticleCount(this.profile, POLISH.particles.lightningCount),
      player.x,
      player.y,
    );
    this.installPlayerGlow(player);
  }

  ultimateArrival(): void {
    this.flash(0xffffff, POLISH.flashes.lightningMs, 0.48);
    this.shake(
      POLISH.camera.ultimateShakeDurationMs,
      POLISH.camera.ultimateShakeIntensity,
    );
  }

  /** Public camera entry point for entity/cinematic effects that predate this system. */
  cameraShake(durationMs: number, intensity: number): void {
    this.shake(durationMs, intensity);
  }

  /** Public flash entry point so all full-screen light respects the active profile. */
  cameraFlash(color: number, durationMs: number, alpha: number): void {
    this.flash(color, durationMs, alpha);
  }

  ultimateStrike(x: number, y: number, boss: boolean): void {
    this.lightningParticles.explode(
      scaledParticleCount(
        this.profile,
        boss ? POLISH.particles.bossKillCount : POLISH.particles.lightningCount,
      ),
      x,
      y,
    );
    this.smokeParticles.explode(
      scaledParticleCount(this.profile, boss ? 7 : 4),
      x,
      y + 8,
    );
  }

  ultimateFinished(player: Player): void {
    this.removePlayerGlow(player);
    this.restoreZoom();
  }

  countdownTick(seconds: number): void {
    if (seconds > 10 || seconds <= 0) return;
    const urgency = (11 - seconds) / 10;
    this.shake(
      seconds <= 3 ? 65 : 45,
      POLISH.camera.hitShakeIntensity * (0.35 + urgency * 0.95),
    );
    if (seconds <= 3) {
      this.flash(0xffc9a0, 45, 0.11 + urgency * 0.05);
    }
    this.countdownVignetteAlpha = Math.max(
      this.countdownVignetteAlpha,
      POLISH.atmosphere.vignetteStrength * urgency,
    );
    this.syncVignette();
  }

  sunriseWash(): void {
    this.flash(0xffa34e, 240, 0.28);
    for (const glow of this.windowGlows) glow.setAlpha(0.52).setScale(1.22, 1.12);
  }

  /** Caps temporary full-screen/bolt objects that live outside this system. */
  acquireScreenEffect(kind: ScreenEffectKind): boolean {
    if (
      this.destroyed ||
      this.activeScreenEffects >= POLISH.limits.maxSimultaneousScreenEffects ||
      (kind === 'bolt' && this.activeBolts >= this.profile.maxSimultaneousBolts)
    ) {
      return false;
    }
    this.activeScreenEffects++;
    if (kind === 'bolt') this.activeBolts++;
    return true;
  }

  releaseScreenEffect(kind: ScreenEffectKind): void {
    this.activeScreenEffects = Math.max(0, this.activeScreenEffects - 1);
    if (kind === 'bolt') this.activeBolts = Math.max(0, this.activeBolts - 1);
  }

  cancelHitStop(resumePhysics: boolean): void {
    const hadTimer = this.hitStopTimer !== null;
    this.hitStopTimer?.remove(false);
    this.hitStopTimer = null;
    if (hadTimer && resumePhysics && this.scene.physics.world.isPaused) {
      this.scene.physics.world.resume();
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    PresentationSystem.instances.delete(this.scene);
    this.cancelHitStop(false);
    this.ambientTimer?.remove(false);
    this.ambientTimer = null;
    this.zoomTween?.stop();
    this.zoomTween = null;
    this.camera.setZoom(this.baseZoom);
    this.camera.resetFX();
    if (this.playerGlow && this.playerGlowTarget?.active) {
      this.playerGlowTarget.filters?.internal.remove(this.playerGlow, true);
    }
    this.playerGlow = null;
    this.playerGlowTarget = null;
    this.activeScreenEffects = 0;
    this.activeBolts = 0;

    for (const tween of this.ownedTweens) tween.stop();
    this.ownedTweens.clear();
    for (const shadow of this.shadows.values()) shadow.destroy();
    this.shadows.clear();
    for (const glow of this.torchGlows) glow.destroy();
    for (const glow of this.windowGlows) glow.destroy();

    this.hitParticles.destroy();
    this.deathParticles.destroy();
    this.lightningParticles.destroy();
    this.smokeParticles.destroy();
    this.movementParticles.destroy();
    this.ambientParticles.destroy();
    this.flashOverlay.destroy();
    this.redVignette.destroy();
    this.floorHaze.destroy();
  }

  private drawVignette(): void {
    this.redVignette.clear();
    for (let index = 0; index < 5; index++) {
      this.redVignette.lineStyle(18, 0x9b1028, 0.24 - index * 0.035);
      this.redVignette.strokeRect(
        9 + index * 17,
        9 + index * 17,
        GAME_WIDTH - 18 - index * 34,
        GAME_HEIGHT - 18 - index * 34,
      );
    }
  }

  private syncVignette(): void {
    this.redVignette.setAlpha(
      Math.max(this.healthVignetteAlpha, this.countdownVignetteAlpha),
    );
  }

  private emitAmbientMote(): void {
    if (this.destroyed || !this.profile.enableAmbientParticles) return;
    this.ambientParticles.emitParticleAt(
      Phaser.Math.Between(ARENA.left + 20, ARENA.right - 20),
      Phaser.Math.Between(ARENA.top + 30, ARENA.bottom - 10),
      1,
    );
    if (Phaser.Math.Between(0, 2) === 0) {
      const torchIndex = Phaser.Math.Between(0, TORCH_X_CENTERS.length - 1);
      this.lightningParticles.emitParticleAt(
        TORCH_X_CENTERS[torchIndex],
        TORCH_Y - 12,
        1,
      );
    }
  }

  private punchActor(actor: Actor): void {
    const baseX = actor.scaleX;
    const baseY = actor.scaleY;
    const tween = this.scene.tweens.add({
      targets: actor,
      scaleX: baseX * 1.055,
      scaleY: baseY * 0.94,
      duration: 42,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.ownedTweens.delete(tween);
        if (actor.active) actor.setScale(baseX, baseY);
      },
    });
    this.ownedTweens.add(tween);
  }

  private missResponse(): void {
    if (this.profile.reducedMotion) return;
    this.zoomPunch(1.006, 90);
  }

  private shake(duration: number, intensity: number): void {
    if (!this.profile.enableCameraShake || this.destroyed) return;
    if (this.scene.time.now - this.lastShakeAt < POLISH.limits.cameraShakeCooldownMs) return;
    this.lastShakeAt = this.scene.time.now;
    this.camera.shake(
      duration,
      intensity * this.profile.cameraShakeMultiplier,
      true,
    );
  }

  private zoomPunch(targetZoom: number, holdMs = 70): void {
    if (!this.profile.enableZoomPunch || this.destroyed) return;
    this.zoomTween?.stop();
    const punch = this.baseZoom + (targetZoom - this.baseZoom) * this.profile.zoomMultiplier;
    this.zoomTween = this.scene.tweens.add({
      targets: this.camera,
      zoom: punch,
      duration: Math.max(45, Math.round(holdMs * 0.48)),
      ease: 'Quad.easeOut',
      yoyo: true,
      hold: Math.max(0, Math.round(holdMs * 0.2)),
      onComplete: () => {
        this.camera.setZoom(this.baseZoom);
        this.zoomTween = null;
      },
    });
  }

  private restoreZoom(): void {
    this.zoomTween?.stop();
    this.zoomTween = this.scene.tweens.add({
      targets: this.camera,
      zoom: this.baseZoom,
      duration: POLISH.camera.restoreDurationMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.camera.setZoom(this.baseZoom);
        this.zoomTween = null;
      },
    });
  }

  private hitStop(durationMs: number, canResumePhysics: () => boolean): void {
    if (
      !this.profile.enableHitStop ||
      this.destroyed ||
      this.scene.physics.world.isPaused ||
      this.scene.time.now - this.lastHitStopAt < POLISH.limits.hitStopCooldownMs
    ) {
      return;
    }
    this.lastHitStopAt = this.scene.time.now;
    this.scene.physics.world.pause();
    this.hitStopTimer = this.scene.time.delayedCall(durationMs, () => {
      this.hitStopTimer = null;
      if (!this.destroyed && canResumePhysics() && this.scene.physics.world.isPaused) {
        this.scene.physics.world.resume();
      }
    });
  }

  private flash(color: number, durationMs: number, alpha: number): void {
    if (this.destroyed) return;
    this.flashOverlay.setFillStyle(color, 1);
    this.scene.tweens.killTweensOf(this.flashOverlay);
    this.flashOverlay.setAlpha(
      Phaser.Math.Clamp(alpha * this.profile.flashMultiplier, 0, 0.55),
    );
    this.scene.tweens.add({
      targets: this.flashOverlay,
      alpha: 0,
      duration: Math.max(45, durationMs),
      ease: 'Quad.easeOut',
    });
  }

  private installPlayerGlow(player: Player): void {
    if (
      !this.profile.enableExpensiveFx ||
      this.scene.game.renderer.type !== Phaser.WEBGL
    ) {
      return;
    }
    try {
      player.enableFilters();
      this.playerGlow =
        player.filters?.internal.addGlow(0xffd64a, POLISH.fx.glowStrength, 0.25, 1) ??
        null;
      this.playerGlowTarget = this.playerGlow ? player : null;
    } catch {
      this.playerGlow = null;
      this.playerGlowTarget = null;
    }
  }

  private removePlayerGlow(player: Player): void {
    if (!this.playerGlow) return;
    player.filters?.internal.remove(this.playerGlow, true);
    this.playerGlow = null;
    this.playerGlowTarget = null;
  }
}
