import Phaser from 'phaser';
import { BLOOD, PLAYER } from '../data/balance';
import { GAME_WIDTH } from '../game/constants';
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
 * All in-game HUD elements: sunrise timer (the visual centerpiece), health
 * bar, blood meter, objective line, attack-cooldown pip and boss bar.
 * Driven entirely by events from the per-run emitter.
 */
export class HUD {
  private timerText: Phaser.GameObjects.Text;
  private healthBarFill: Phaser.GameObjects.Rectangle;
  private healthText: Phaser.GameObjects.Text;
  private bloodBarFill: Phaser.GameObjects.Rectangle;
  private bloodText: Phaser.GameObjects.Text;
  private objectiveText: Phaser.GameObjects.Text;
  private cooldownPip: Phaser.GameObjects.Arc;
  private bossBar: BossHealthBar;
  private urgent = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly emitter: Phaser.Events.EventEmitter,
  ) {
    const cx = GAME_WIDTH / 2;

    // Sunrise timer — deliberately the biggest HUD element.
    this.timerText = scene.add
      .text(cx, 16, '', { fontFamily: FONT, fontSize: '44px', color: '#e8ddff', fontStyle: 'bold' })
      .setOrigin(0.5, 0)
      .setDepth(100);

    // Health (top-left).
    scene.add.rectangle(20, 24, 220, 18, 0x000000, 0.5).setOrigin(0, 0.5).setDepth(100);
    this.healthBarFill = scene.add.rectangle(22, 24, 216, 14, 0x4caf50).setOrigin(0, 0.5).setDepth(101);
    this.healthText = scene.add
      .text(24, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#cfe8cf' })
      .setDepth(101);

    // Blood meter (top-right).
    scene.add.rectangle(GAME_WIDTH - 240, 24, 220, 18, 0x000000, 0.5).setOrigin(0, 0.5).setDepth(100);
    this.bloodBarFill = scene.add
      .rectangle(GAME_WIDTH - 238, 24, 0, 14, 0xc41e2f)
      .setOrigin(0, 0.5)
      .setDepth(101);
    this.bloodText = scene.add
      .text(GAME_WIDTH - 236, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#f0b7bd' })
      .setDepth(101);

    // Objective line under the timer.
    this.objectiveText = scene.add
      .text(cx, 72, OBJECTIVE_TEXT['collect-blood'], { fontFamily: FONT, fontSize: '18px', color: '#c9a7ff' })
      .setOrigin(0.5, 0)
      .setDepth(100);

    // Attack cooldown pip (bottom-left).
    this.cooldownPip = scene.add.circle(34, scene.scale.height - 34, 14, 0xff5f7a, 1).setDepth(100);

    this.bossBar = new BossHealthBar(scene, emitter);

    this.setHealth(PLAYER.maxHealth, PLAYER.maxHealth);
    this.setBlood(0, BLOOD.target);

    emitter.on(EVENTS.COUNTDOWN_TICK, this.onTick, this);
    emitter.on(EVENTS.FINAL_TEN_SECONDS, this.onFinalSeconds, this);
    emitter.on(EVENTS.PLAYER_DAMAGED, this.setHealth, this);
    emitter.on(EVENTS.BLOOD_CHANGED, this.setBlood, this);
    emitter.on(EVENTS.OBJECTIVE_CHANGED, this.onObjective, this);
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

  private onTick(secondsRemaining: number): void {
    const m = Math.floor(secondsRemaining / 60);
    const s = secondsRemaining % 60;
    this.timerText.setText(`${m}:${s.toString().padStart(2, '0')}`);

    if (this.urgent) {
      this.timerText.setColor(secondsRemaining % 2 === 0 ? '#ff5f5f' : '#ffd76b');
    }
  }

  private onFinalSeconds(): void {
    this.urgent = true;
    this.timerText.setColor('#ff5f5f');
    this.scene.tweens.add({
      targets: this.timerText,
      scale: { from: 1, to: 1.18 },
      duration: 500,
      yoyo: true,
      repeat: -1,
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
