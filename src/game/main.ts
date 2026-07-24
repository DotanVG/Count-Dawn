import Phaser from 'phaser';
import { gameConfig } from './config';
import { installFullscreenButton } from './fullscreen';

/** Entry point. The HTML boot loader is removed in BootScene. */
const game = new Phaser.Game(gameConfig);

installFullscreenButton(game);

// Expose the instance for debugging during development only.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}

export default game;
