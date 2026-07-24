import Phaser from 'phaser';
import { BLOOD } from '../data/balance';
import { DEPTHS } from '../game/constants';
import { TEXTURES } from '../utils/assetKeys';

/**
 * A dropped bloodlet worth BLOOD.dropletValue. Bobs in place until the player
 * overlaps it; the scene then flies it to the blood bar (see GameScene) —
 * no floating "+N" text, the flight itself is the feedback.
 */
export class BloodPickup extends Phaser.Physics.Arcade.Sprite {
  readonly amount = BLOOD.dropletValue;
  /** Set once the fly-to-bar tween has claimed this droplet. */
  collecting = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.blood);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTHS.pickup);

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
}
