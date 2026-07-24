import Phaser from 'phaser';

/**
 * Thin audio wrapper: playing a key that was never loaded is a silent no-op,
 * so the prototype runs cleanly with zero audio files. When real audio lands,
 * load it in PreloadScene under the keys in assetKeys.ts and calls just work.
 */
export class AudioSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  play(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
    if (!this.scene.cache.audio.exists(key)) return;
    this.scene.sound.play(key, config);
  }
}
