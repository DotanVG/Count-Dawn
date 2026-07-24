import Phaser from 'phaser';
import { SCENES } from '../game/constants';
import { createPlaceholderTextures } from '../utils/placeholderTextures';

/** First scene: generated prop textures, HTML loader removal, then PreloadScene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    createPlaceholderTextures(this);

    document.getElementById('boot-loader')?.remove();

    this.scene.start(SCENES.preload);
  }
}
