import Phaser from 'phaser';
import { DEPTHS } from '../game/constants';
import { EVENTS } from '../game/events';

const BAR_WIDTH = 132;
/** How far above the Captain's origin the bar floats, clearing his helmet. */
const HOVER_Y = 96;

/**
 * The Hunter Captain's health, carried above his head rather than pinned to
 * the top of the screen. A banner up in the wall band made the player look
 * away from the fight to read it, and it sat across the window the sun and
 * moon pass through. Over the Captain it is unambiguous whose health it is,
 * and it goes where the player is already looking.
 */
export class BossHealthBar {
  private container: Phaser.GameObjects.Container;
  private fill: Phaser.GameObjects.Rectangle;

  constructor(
    scene: Phaser.Scene,
    private readonly emitter: Phaser.Events.EventEmitter,
  ) {
    const bg = scene.add.rectangle(0, 0, BAR_WIDTH, 10, 0x000000, 0.7).setOrigin(0.5);
    this.fill = scene.add
      .rectangle(-BAR_WIDTH / 2 + 2, 0, BAR_WIDTH - 4, 6, 0xffd76b)
      .setOrigin(0, 0.5);
    const label = scene.add
      .text(0, -15, 'Hunter Captain', {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '12px',
        color: '#ffd76b',
        stroke: '#0d0716',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    this.container = scene.add
      .container(0, 0, [bg, this.fill, label])
      .setDepth(DEPTHS.hud)
      .setVisible(false);

    emitter.on(EVENTS.BOSS_SPAWNED, this.onSpawned, this);
    emitter.on(EVENTS.BOSS_HEALTH_CHANGED, this.onHealthChanged, this);
    emitter.on(EVENTS.BOSS_DEFEATED, this.onDefeated, this);
  }

  /** Called every frame while the Captain lives, from GameScene.update. */
  follow(x: number, y: number): void {
    this.container.setPosition(x, y - HOVER_Y);
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
