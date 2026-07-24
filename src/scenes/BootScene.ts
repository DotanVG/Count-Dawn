import Phaser from 'phaser';
import { SCENES } from '../game/constants';

/**
 * First scene: HTML loader removal, then PreloadScene. Placeholder textures
 * are generated in PreloadScene AFTER loading, so real assets always win
 * their keys.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    document.getElementById('boot-loader')?.remove();

    this.scene.start(SCENES.preload);
  }
}
