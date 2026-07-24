import Phaser from 'phaser';
import { BLOOD, NIGHT, PLAYER } from '../data/balance';
import { DEPTHS, GAME_WIDTH, GAME_HEIGHT } from '../game/constants';
import { EVENTS } from '../game/events';
import type { Objective } from '../types/game';
import { BossHealthBar } from './BossHealthBar';

const OBJECTIVE_TEXT: Record<Objective, string> = {
  'collect-blood': 'Collect blood before sunrise',
  'defeat-boss': 'Defeat the Hunter Captain',
  'collect-more-blood': 'Collect more blood',
  'return-to-coffin': 'Return to your coffin',
};

const FONT = 'Trebuchet MS, sans-serif';

/**
 * All in-game HUD elements. The sunrise timer is the centerpiece: it sits in
 * the middle sky window (where the sun rises into it), pops on every tick,
 * trembles harder as time runs out, and goes into a red panic mode for the
 * final ten seconds, complete with a pulsing vignette and camera shakes.
 */
export class HUD {
  private timerText: Phaser.GameObjects.Text;
  private timerHome = { x: GAME_WIDTH / 2, y: 88 };
  private healthBarFill: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private bloodBarFill: Phaser.GameObjects.Rectangle;
  private bloodText: Phaser.GameObjects.Text;
  private objectiveText: Phaser.GameObjects.Text;
  private cooldownPip: Phaser.GameObjects.Arc;
  private vignette: Phaser.GameObjects.Rectangle;
  private bossBar: BossHealthBar;
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
      .rectangle(20, 24, 220, 18, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud);
    this.healthBarFill = scene.add
      .rectangle(22, 24, 216, 14, 0x4caf50)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud + 1);
    this.healthText = scene.add
      .text(24, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#cfe8cf' })
      .setDepth(DEPTHS.hud + 1);

    // Blood meter (top-right).
    const bloodBg = scene.add
      .rectangle(GAME_WIDTH - 240, 24, 220, 18, 0x000000, 0.55)
      .setOrigin(0, 0.5)
      .setDepth(DEPTHS.hud);
    this.bloodBarFill = scene.add
      .rectangle(GAME_WIDTH - 238, 24, 0, 14, 0xc41e2f)
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

    // Attack cooldown pip (bottom-left).
    this.cooldownPip = scene.add
      .circle(34, GAME_HEIGHT - 34, 14, 0xff5f7a, 1)
      .setDepth(DEPTHS.hud);

    // Red panic vignette for the final seconds (border-only feel via 4 edges
    // would cost more objects; a soft full flash reads fine at low alpha).
    this.vignette = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xc41e2f, 0)
      .setOrigin(0)
      .setDepth(DEPTHS.hud - 1);

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
      this.cooldownPip,
    ];

    emitter.on(EVENTS.COUNTDOWN_TICK, this.onTick, this);
    emitter.on(EVENTS.FINAL_TEN_SECONDS, this.onFinalSeconds, this);
    emitter.on(EVENTS.PLAYER_DAMAGED, this.setHealth, this);
    emitter.on(EVENTS.BLOOD_CHANGED, this.setBlood, this);
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

  /** Called from GameScene.update — cooldown recovery is a smooth value, not an event. */
  setCooldownProgress(progress: number): void {
    this.cooldownPip.setAlpha(progress >= 1 ? 1 : 0.25 + progress * 0.4);
    this.cooldownPip.setScale(0.6 + progress * 0.4);
  }

  destroy(): void {
    this.emitter.off(EVENTS.COUNTDOWN_TICK, this.onTick, this);
    this.emitter.off(EVENTS.FINAL_TEN_SECONDS, this.onFinalSeconds, this);
    this.emitter.off(EVENTS.PLAYER_DAMAGED, this.setHealth, this);
    this.emitter.off(EVENTS.BLOOD_CHANGED, this.setBlood, this);
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

    // Tick pop, bigger as tension grows.
    this.scene.tweens.add({
      targets: this.timerText,
      scale: { from: 1 + 0.08 + tension * 0.22, to: 1 },
      duration: 220,
      ease: 'Quad.easeOut',
    });

    // Tremble: random jitter around the home position, growing with tension.
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

  private setHealth(current: number, max: number): void {
    const ratio = Phaser.Math.Clamp(current / max, 0, 1);
    this.healthBarFill.width = 216 * ratio;
    this.healthBarFill.setFillStyle(ratio > 0.35 ? 0x4caf50 : 0xe53935);
    this.healthText.setText(`HP ${current}/${max}`);
  }

  private setBlood(current: number, target: number): void {
    const ratio = Phaser.Math.Clamp(current / target, 0, 1);
    this.bloodBarFill.width = 216 * ratio;
    this.bloodText.setText(`Blood ${Math.min(current, target)}/${target}`);
  }

  private onObjective(objective: Objective): void {
    this.objectiveText.setText(OBJECTIVE_TEXT[objective]);
  }
}
