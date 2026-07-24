import Phaser from 'phaser';
import { HUNTER } from '../data/balance';
import { TEXTURES } from '../utils/assetKeys';

/** A dropped blood droplet. Sits in the arena until the player overlaps it. */
export class BloodPickup extends Phaser.Physics.Arcade.Sprite {
  readonly amount = HUNTER.bloodDrop;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.blood);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(3);

    // Gentle bob so pickups read as collectible.
    scene.tweens.add({
      targets: this,
      y: y - 4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Small rising "+N" feedback at the pickup position, then removal. */
  collect(): void {
    const scene = this.scene;
    const text = scene.add
      .text(this.x, this.y - 10, `+${this.amount}`, {
        fontFamily: 'Trebuchet MS, sans-serif',
        fontSize: '16px',
        color: '#ff6b7d',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(20);
    scene.tweens.add({
      targets: text,
      y: text.y - 26,
      alpha: 0,
      duration: 500,
      onComplete: () => text.destroy(),
    });
    this.destroy();
  }
}
