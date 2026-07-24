import Phaser from 'phaser';
import { GAME_WIDTH } from '../game/constants';
import { EVENTS } from '../game/events';

const BAR_WIDTH = 480;

/** Boss health bar, shown under the timer only while the Hunter Captain lives. */
export class BossHealthBar {
  private container: Phaser.GameObjects.Container;
  private fill: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    private readonly emitter: Phaser.Events.EventEmitter,
  ) {
    const bg = scene.add.rectangle(0, 0, BAR_WIDTH, 16, 0x000000, 0.6).setOrigin(0.5);
    this.fill = scene.add
      .rectangle(-BAR_WIDTH / 2 + 2, 0, BAR_WIDTH - 4, 12, 0xffd76b)
      .setOrigin(0, 0.5);
    const label = scene.add
      .text(0, -16, 'Hunter Captain', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '14px',
        color: '#ffd76b',
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container(GAME_WIDTH / 2, 252, [bg, this.fill, label])
      .setDepth(100)
      .setVisible(false);

    emitter.on(EVENTS.BOSS_SPAWNED, this.onSpawned, this);
    emitter.on(EVENTS.BOSS_HEALTH_CHANGED, this.onHealthChanged, this);
    emitter.on(EVENTS.BOSS_DEFEATED, this.onDefeated, this);
  }

  destroy(): void {
    this.emitter.off(EVENTS.BOSS_SPAWNED, this.onSpawned, this);
    this.emitter.off(EVENTS.BOSS_HEALTH_CHANGED, this.onHealthChanged, this);
    this.emitter.off(EVENTS.BOSS_DEFEATED, this.onDefeated, this);
  }

  private onSpawned(): void {
    this.container.setVisible(true);
    this.fill.width = BAR_WIDTH - 4;
  }

  private onHealthChanged(current: number, max: number): void {
    this.fill.width = (BAR_WIDTH - 4) * Phaser.Math.Clamp(current / max, 0, 1);
  }

  private onDefeated(): void {
    this.container.setVisible(false);
  }
}
