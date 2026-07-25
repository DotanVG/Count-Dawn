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

  /** Plays one exact excerpt and releases its temporary sound instance afterward. */
  playSegment(key: string, start: number, duration: number): void {
    if (!this.scene.cache.audio.exists(key)) return;

    const sound = this.scene.sound.add(key);
    sound.addMarker({ name: 'segment', start, duration });
    const destroy = (): void => sound.destroy();
    sound.once(Phaser.Sound.Events.COMPLETE, destroy);
    sound.once(Phaser.Sound.Events.STOP, destroy);
    sound.play('segment');
  }

  /** Stops every currently-playing instance of this key (e.g. looping menu music). */
  stop(key: string): void {
    if (!this.scene.cache.audio.exists(key)) return;
    this.scene.sound.stopByKey(key);
  }
}
