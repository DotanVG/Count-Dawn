import Phaser from 'phaser';
import { gameConfig } from './config';
import { installFullscreenButton } from './fullscreen';
import { installOrientationGate } from './orientation';
import { installVampireCursor } from './vampireCursor';

/** Entry point. The HTML boot loader is removed in BootScene. */
const game = new Phaser.Game(gameConfig);

installFullscreenButton(game);
installVampireCursor();
// Landscape-only gate: pauses gameplay + audio while a phone is in portrait.
installOrientationGate(game);

/**
 * Tell an embedding page (itch/index.html) that the game really did come up.
 * A frame that gets refused — CSP, an ad blocker, an offline deploy — still
 * fires `load` for its error page, so the wrapper cannot tell "running" from
 * "blocked" without hearing from us directly.
 */
if (window.parent !== window) {
  window.parent.postMessage('count-dawn:ready', '*');
}

// Expose the instance for debugging during development only.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}

export default game;
