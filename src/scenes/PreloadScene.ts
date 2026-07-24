import Phaser from 'phaser';
import { SCENES } from '../game/constants';

/**
 * Loading path for future real assets. Nothing is loaded yet on purpose —
 * placeholders are generated in BootScene. When assets land, load them here
 * under the keys from utils/assetKeys.ts (see docs/ASSET_INTEGRATION.md), e.g.:
 *
 *   this.load.spritesheet(TEXTURES.vampire, 'assets/characters/vampire/vampire.png',
 *     { frameWidth: ..., frameHeight: ... });
 *   this.load.audio(AUDIO.playerAttack, 'assets/audio/player-attack.ogg');
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENES.preload);
  }

  create(): void {
    this.scene.start(SCENES.mainMenu);
  }
}
