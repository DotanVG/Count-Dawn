import type Phaser from 'phaser';
import { SCENES } from './constants';

/**
 * Landscape-only gate for touch devices. The visible "rotate your device"
 * overlay is a pure-CSS DOM layer in index.html (shown by an
 * `orientation: portrait` + `pointer: coarse` media query), so it is large
 * and crisp regardless of how the Phaser canvas is letterboxed. This module
 * is only the coordination layer: while a touch device is in portrait it
 * pauses an in-progress GameScene and suspends audio, and undoes exactly that
 * on return to landscape (a user-opened PauseScene is left untouched).
 * Desktop (fine pointer) never trips it.
 */
export function installOrientationGate(game: Phaser.Game): void {
  const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
  let gateActive = false;
  let autoPausedGame = false;
  let autoPausedAudio = false;

  const sync = (): void => {
    const active = coarsePointerQuery.matches && window.innerHeight > window.innerWidth;
    if (active === gateActive) return;
    gateActive = active;

    if (active) {
      if (!game.sound.locked) {
        game.sound.pauseAll();
        autoPausedAudio = true;
      }
      if (game.scene.isActive(SCENES.game) && !game.scene.isPaused(SCENES.game)) {
        game.scene.pause(SCENES.game);
        autoPausedGame = true;
      }
    } else {
      if (autoPausedAudio && !game.sound.locked) {
        game.sound.resumeAll();
        autoPausedAudio = false;
      }
      if (autoPausedGame) {
        game.scene.resume(SCENES.game);
        autoPausedGame = false;
      }
    }
  };

  // Coalesce the resize/orientation event bursts phones fire while rotating.
  let timer: number | null = null;
  const queueSync = (): void => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      sync();
      game.scale.refresh();
    }, 40);
  };

  coarsePointerQuery.addEventListener('change', queueSync);
  window.addEventListener('resize', queueSync);
  window.addEventListener('orientationchange', queueSync);
  window.screen.orientation?.addEventListener('change', queueSync);

  queueSync();
}
