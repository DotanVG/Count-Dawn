import Phaser from 'phaser';
import { BLOOD, NIGHT, PLAYER } from '../data/balance';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT, HUD_ANCHORS } from '../game/constants';
import { EVENTS } from '../game/events';
import { TEXTURES } from '../utils/assetKeys';
import type { Objective } from '../types/game';
import { BossHealthBar } from './BossHealthBar';

const OBJECTIVE_TEXT: Record<Objective, string> = {
  'collect-blood': 'Collect blood before sunrise',
  'defeat-boss': 'Defeat the Hunter Captain',
  'collect-more-blood': 'Collect more blood',
  'return-to-coffin': 'Return to your coffin',
};

const FONT = 'Trebuchet MS, sans-serif';
const HP_GREEN = 0x4caf50;
const BLOOD_RED = 0xc41e2f;
const BAR_W = 216;

/**
 * All in-game HUD elements. The sunrise timer is the centerpiece: it sits in
 * the middle sky window (where the sun rises into it), pops on every tick,
 * trembles harder as time runs out, and goes into a red panic mode for the
 * final ten seconds. Health/blood changes puff matching green/red particles
 * at the bars, and the victory coffin-transfer drains blood into health.
 */
export class HUD {
  private timerText: Phaser.GameObjects.Text;
  private timerHome = { x: GAME_WIDTH / 2, y: 88 };
  private healthBarFill: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private bloodBarFill: Phaser.GameObjects.Rectangle;
  private bloodText: Phaser.GameObjects.Text;
  private objectiveText: Phaser.GameObjects.Text;
  private nightText: Phaser.GameObjects.Text;
  private vignette: Phaser.GameObjects.Rectangle;
  private bossBar: BossHealthBar;
  private hpParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private bloodParticles: Phaser.GameObjects.Particles.ParticleEmitter;
  private appearTargets: Phaser.GameObjects.GameObject[] = [];
  private panic = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly emitter: Phaser.Events.EventEmitter,
  ) {
    // Sunrise timer — centered in the middle sky window.
    this.timerText = scene.add
      .text(this.timerHome.x, this.timerHome.y, this.format(NIGHT.durationSeconds), {
        fontFamily: FONT,
        fontSize: '58px',
        color: '#e8ddff',
        fontStyle: 'bold',
        stroke: '#0d0716',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud);

    // Health (top-left).
    const healthBg = scene.add
      .rectangle(20, 24, BAR_W + 4, 18, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud);
    this.healthBarFill = scene.add
      .rectangle(22, 24, BAR_W, 14, HP_GREEN)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud + 1);
    this.healthText = scene.add
      .text(24, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#cfe8cf' })
      .setDepth(DEPTHS.hud + 1);

    // Blood meter (top-right).
    const bloodBg = scene.add
      .rectangle(GAME_WIDTH - 240, 24, BAR_W + 4, 18, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud);
    this.bloodBarFill = scene.add
      .rectangle(GAME_WIDTH - 238, 24, 0, 14, BLOOD_RED)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud + 1);
    this.bloodText = scene.add
      .text(GAME_WIDTH - 236, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#f0b7bd' })
      .setDepth(DEPTHS.hud + 1);

    // Objective, just under the wall band.
    this.objectiveText = scene.add
      .text(GAME_WIDTH / 2, 208, OBJECTIVE_TEXT['collect-blood'], {
        fontFamily: FONT,
        fontSize: '19px',
        color: '#c9a7ff',
        stroke: '#0d0716',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud);

    // Night counter, tucked just above the objective line.
    this.nightText = scene.add
      .text(GAME_WIDTH / 2, 184, 'Night 1', {
        fontFamily: FONT,
        fontSize: '15px',
        color: '#9d8bbf',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.hud);

    // Red panic vignette for the final seconds.
    this.vignette = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, BLOOD_RED, 0)
      .setOrigin(0)
      .setDepth(DEPTHS.hud - 1);

    // Green/red puffs used for HP loss, blood gain, and the coffin transfer.
    this.hpParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 40, max: 140 },
        lifespan: { min: 250, max: 550 },
        scale: { start: 1.1, end: 0 },
        tint: HP_GREEN,
        emitting: false,
      })
      .setDepth(DEPTHS.hud + 2);
    this.bloodParticles = scene.add
      .particles(0, 0, TEXTURES.particle, {
        speed: { min: 40, max: 140 },
        lifespan: { min: 250, max: 550 },
        scale: { start: 1.1, end: 0 },
        tint: 0xff4d4d,
        emitting: false,
      })
      .setDepth(DEPTHS.hud + 2);

    this.bossBar = new BossHealthBar(scene, emitter);

    this.setHealth(PLAYER.maxHealth, PLAYER.maxHealth);
    this.setBlood(0, BLOOD.target);

    this.appearTargets = [
      this.timerText,
      healthBg,
      this.healthBarFill,
      this.healthText,
      bloodBg,
      this.bloodBarFill,
      this.bloodText,
      this.objectiveText,
      this.nightText,
    ];

    emitter.on(EVENTS.COUNTDOWN_TICK, this.onTick, this);
    emitter.on(EVENTS.FINAL_TEN_SECONDS, this.onFinalSeconds, this);
    emitter.on(EVENTS.PLAYER_DAMAGED, this.onPlayerDamaged, this);
    emitter.on(EVENTS.BLOOD_CHANGED, this.onBloodChanged, this);
    emitter.on(EVENTS.OBJECTIVE_CHANGED, this.onObjective, this);
  }

  /** Fade/slide the HUD in when the night starts. */
  animateIn(): void {
    for (const target of this.appearTargets) {
      const obj = target as unknown as Phaser.GameObjects.Components.Transform &
        Phaser.GameObjects.Components.AlphaSingle;
      const toY = obj.y;
      obj.setAlpha(0);
      obj.y = toY - 24;
      this.scene.tweens.add({
        targets: obj,
        alpha: 1,
        y: toY,
        duration: 450,
        ease: 'Quad.easeOut',
        delay: 100,
      });
    }
  }

  /** Red burst where a bloodlet reaches the blood bar. */
  burstAtBloodBar(): void {
    this.bloodParticles.explode(8, HUD_ANCHORS.bloodBar.x, HUD_ANCHORS.bloodBar.y);
  }

  setNight(n: number): void {
    this.nightText.setText(`Night ${n}`);
  }

  /**
   * Called between rounds in the seamless day/night loop: clears any panic
   * styling left over from a previous night's final seconds and snaps the
   * bars back to a fresh-round look (the coffin transfer already set the
   * numbers; this just resets cosmetic state — color, size, jitter, vignette).
   */
  resetForNewRound(bloodTarget: number): void {
    this.panic = false;
    this.timerText.setColor('#e8ddff');
    this.timerText.setFontSize('58px');
    this.timerText.setScale(1);
    this.timerText.setAngle(0);
    this.timerText.setPosition(this.timerHome.x, this.timerHome.y);
    this.vignette.setAlpha(0);
    this.setHealth(PLAYER.maxHealth, PLAYER.maxHealth);
    this.setBlood(0, bloodTarget);
    // Without this the objective line kept showing "Return to your coffin"
    // (the previous round's final state) until the new round's first
    // OBJECTIVE_CHANGED event — GameFlowSystem only emits on state changes,
    // not on construction, so nothing would correct it otherwise.
    this.objectiveText.setText(OBJECTIVE_TEXT['collect-blood']);
  }

  /**
   * Victory beat: the blood meter drains into the health bar — HP fills as
   * blood empties, green/red particles streaming at each bar.
   */
  playCoffinTransfer(bloodRatio: number, healthRatio: number, onComplete: () => void): void {
    const stream = this.scene.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        this.hpParticles.explode(5, 22 + this.healthBarFill.width, 24);
        this.bloodParticles.explode(5, GAME_WIDTH - 238 + this.bloodBarFill.width, 24);
      },
    });

    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1300,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        this.bloodBarFill.width = BAR_W * bloodRatio * (1 - t);
        this.healthBarFill.width = BAR_W * Phaser.Math.Linear(healthRatio, 1, t);
        this.healthBarFill.setFillStyle(HP_GREEN);
      },
      onComplete: () => {
        stream.remove();
        this.healthText.setText(`HP ${PLAYER.maxHealth}/${PLAYER.maxHealth}`);
        this.bloodText.setText('Blood spent');
        onComplete();
      },
    });
  }

  destroy(): void {
    this.emitter.off(EVENTS.COUNTDOWN_TICK, this.onTick, this);
    this.emitter.off(EVENTS.FINAL_TEN_SECONDS, this.onFinalSeconds, this);
    this.emitter.off(EVENTS.PLAYER_DAMAGED, this.onPlayerDamaged, this);
    this.emitter.off(EVENTS.BLOOD_CHANGED, this.onBloodChanged, this);
    this.emitter.off(EVENTS.OBJECTIVE_CHANGED, this.onObjective, this);
    this.bossBar.destroy();
  }

  private format(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private onTick(secondsRemaining: number): void {
    this.timerText.setText(this.format(secondsRemaining));

    // Tension ramp: 0 while relaxed → 1 at the final seconds.
    const tension = Phaser.Math.Clamp(
      1 - (secondsRemaining - NIGHT.finalWarningSeconds) / 20,
      0,
      1,
    );

    this.scene.tweens.add({
      targets: this.timerText,
      scale: { from: 1 + 0.08 + tension * 0.22, to: 1 },
      duration: 220,
      ease: 'Quad.easeOut',
    });

    if (tension > 0) {
      const shake = 2 + tension * 6;
      this.timerText.setPosition(
        this.timerHome.x + Phaser.Math.Between(-shake, shake),
        this.timerHome.y + Phaser.Math.Between(-shake, shake),
      );
      this.timerText.setAngle(Phaser.Math.FloatBetween(-tension * 4, tension * 4));
    }

    if (this.panic) {
      this.timerText.setColor(secondsRemaining % 2 === 0 ? '#ff4d4d' : '#ffd76b');
      this.scene.cameras.main.shake(60, 0.0015 + 0.002 * (1 - secondsRemaining / 10));
      this.vignette.setAlpha(0.16);
      this.scene.tweens.add({ targets: this.vignette, alpha: 0.05, duration: 420 });
    }
  }

  private onFinalSeconds(): void {
    this.panic = true;
    this.timerText.setColor('#ff4d4d');
    this.timerText.setFontSize('72px');
    this.scene.tweens.add({
      targets: this.vignette,
      alpha: { from: 0, to: 0.08 },
      duration: 300,
    });
  }

  private onPlayerDamaged(current: number, max: number): void {
    this.setHealth(current, max);
    // Green motes falling away from the end of the health bar — HP lost.
    this.hpParticles.explode(10, 22 + this.healthBarFill.width, 24);
  }

  private onBloodChanged(current: number, target: number): void {
    this.setBlood(current, target);
  }

  private setHealth(current: number, max: number): void {
    const ratio = Phaser.Math.Clamp(current / max, 0, 1);
    this.healthBarFill.width = BAR_W * ratio;
    this.healthBarFill.setFillStyle(ratio > 0.35 ? HP_GREEN : 0xe53935);
    this.healthText.setText(`HP ${current}/${max}`);
  }

  private setBlood(current: number, target: number): void {
    const ratio = Phaser.Math.Clamp(current / target, 0, 1);
    this.bloodBarFill.width = BAR_W * ratio;
    this.bloodText.setText(`Blood ${Math.min(current, target)}/${target}`);
  }

  private onObjective(objective: Objective): void {
    this.objectiveText.setText(OBJECTIVE_TEXT[objective]);
  }
}
