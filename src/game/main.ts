import Phaser from 'phaser';
import { gameConfig } from './config';
import { installFullscreenButton } from './fullscreen';
import { installOrientationGate } from './orientation';
import { installVampireCursor } from './vampireCursor';
import { gameSettings } from '../data/gameSettings';

/** Called only after entry; resolves to the menu's unchanged Start action. */
export function bootGame(
  context: AudioContext | undefined,
  progress: (value: number) => void,
): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const game = new Phaser.Game({
      ...gameConfig,
      audio: { ...gameConfig.audio, context },
      callbacks: {
        preBoot: (game) => {
          game.events.on('landing-progress', progress);
          game.events.once('landing-load-error', () => {
            game.events.off('landing-progress', progress);
            game.destroy(true);
            reject(new Error('Game assets could not load'));
          });
          game.events.once('landing-ready', (start: () => void) => {
            game.events.off('landing-progress', progress);
            game.events.removeAllListeners('landing-load-error');
            resolve(start);
          });
        },
      },
    });

    installFullscreenButton(game);
    gameSettings.install();
    installVampireCursor();
    // Landscape-only gate: pauses gameplay + audio while a phone is in portrait.
    installOrientationGate(game);

    if (import.meta.env.DEV) {
      (window as unknown as { game: Phaser.Game }).game = game;
    }
  });
}
