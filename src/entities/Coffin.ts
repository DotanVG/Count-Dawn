import Phaser from 'phaser';
import { COLORS } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';

/**
 * The coffin: visible from the start, inert until GameFlowSystem activates it.
 * When approached too early it shows a short hint about unmet requirements.
 */
export class Coffin extends Phaser.Physics.Arcade.Image {
  private activated = false;
  private pulseTween: Phaser.Tweens.Tween | null = null;
  private glow: Phaser.GameObjects.Arc;
  private hintText: Phaser.GameObjects.Text | null = null;
  private hintCooldownUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.coffin);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(2);

    this.glow = scene.add.circle(x, y, 58, COLORS.coffinActive, 0.18).setDepth(1).setVisible(false);
  }

  get isActivated(): boolean {
    return this.activated;
  }

  activate(): void {
    if (this.activated) return;
    this.activated = true;
    this.hideHint();

    this.glow.setVisible(true);
    this.pulseTween = this.scene.tweens.add({
      targets: this.glow,
      alpha: { from: 0.1, to: 0.35 },
      scale: { from: 0.9, to: 1.15 },
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    this.setTint(COLORS.coffinActive);
  }

  /** Shown when the player touches the coffin before requirements are met. */
  showRequirementHint(message: string): void {
    if (this.activated || this.scene.time.now < this.hintCooldownUntil) return;
    this.hintCooldownUntil = this.scene.time.now + 2500;

    this.hideHint();
    this.hintText = this.scene.add
      .text(this.x, this.y - 64, message, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '15px',
        color: '#c9a7ff',
        backgroundColor: '#0d0716cc',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(30);
    this.scene.tweens.add({
      targets: this.hintText,
      alpha: 0,
      delay: 1600,
      duration: 400,
      onComplete: () => this.hideHint(),
    });
  }

  private hideHint(): void {
    this.hintText?.destroy();
    this.hintText = null;
  }

  override destroy(fromScene?: boolean): void {
    this.pulseTween?.stop();
    this.glow.destroy();
    this.hideHint();
    super.destroy(fromScene);
  }
}
