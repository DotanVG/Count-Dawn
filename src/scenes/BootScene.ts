import Phaser from 'phaser';
import { SCENES } from '../game/constants';
import { installAudioDirector } from '../systems/AudioDirector';
import { installAudioEditor } from '../ui/AudioEditor';

/**
 * First scene: HTML loader removal, then PreloadScene. Placeholder textures
 * are generated in PreloadScene AFTER loading, so real assets always win
 * their keys.
 *
 * This is also where the game-wide audio authority is created. It is put up
 * once here, not per scene, because the music has to outlive every scene the
 * game starts (see systems/AudioDirector.ts).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    document.getElementById('boot-loader')?.remove();

    const director = installAudioDirector(this.game);
    installAudioEditor(this.game, director);

    this.scene.start(SCENES.preload);
  }
}
