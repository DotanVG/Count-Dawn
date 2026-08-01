import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './constants';
import { selectPixelScale } from './pixelScalePolicy';

/**
 * Keeps Phaser's fixed-size canvas on a discrete display scale.
 *
 * Scale.NONE is intentional: FIT always consumes the available area and can
 * therefore choose ratios such as 1.498x. ScaleManager.setZoom still performs
 * the CSS sizing, centering, bounds refresh, and pointer-coordinate mapping,
 * while this controller supplies the safe zoom after resize/fullscreen events.
 */
export function installPixelPerfectScale(game: Phaser.Game): void {
  const parent = document.getElementById('game-root');
  if (!parent) return;

  let frameRequest: number | null = null;

  const sync = (): void => {
    frameRequest = null;
    const bounds = parent.getBoundingClientRect();
    const decision = selectPixelScale(bounds.width, bounds.height, GAME_WIDTH, GAME_HEIGHT);

    if (game.scale.zoom !== decision.scale) {
      game.scale.setZoom(decision.scale);
    } else {
      // Parent bounds and input transforms can change without crossing a
      // discrete scale threshold, so they still need a normal refresh.
      game.scale.refresh();
    }

    const canvas = game.canvas;
    canvas.dataset.pixelScale = String(decision.scale);
    canvas.dataset.pixelScaleMode = decision.mode;
    if (decision.downscaleDivisor === null) {
      delete canvas.dataset.pixelDownscaleDivisor;
    } else {
      canvas.dataset.pixelDownscaleDivisor = String(decision.downscaleDivisor);
    }
  };

  const queueSync = (): void => {
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    frameRequest = requestAnimationFrame(sync);
  };

  const resizeObserver = new ResizeObserver(queueSync);
  resizeObserver.observe(parent);
  window.addEventListener('resize', queueSync);
  window.addEventListener('orientationchange', queueSync);
  document.addEventListener('fullscreenchange', queueSync);
  document.addEventListener('webkitfullscreenchange', queueSync as EventListener);

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    resizeObserver.disconnect();
    window.removeEventListener('resize', queueSync);
    window.removeEventListener('orientationchange', queueSync);
    document.removeEventListener('fullscreenchange', queueSync);
    document.removeEventListener('webkitfullscreenchange', queueSync as EventListener);
  });

  queueSync();
}
