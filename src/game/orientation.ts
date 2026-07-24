import type Phaser from 'phaser';
import { SCENES } from './constants';

/**
 * Landscape-only gate for touch devices: entering portrait launches the
 * RotateScene overlay, suspends audio, and pauses an in-progress GameScene;
 * returning to landscape undoes exactly what this module did (a user-opened
 * PauseScene is left untouched). Desktop (fine pointer) never trips it.
 * Simplified from BeatEmPie — Scale.FIT handles the canvas itself.
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
      if (!game.scene.isActive(SCENES.rotate)) {
        game.scene.start(SCENES.rotate);
      }
      if (!game.sound.locked) {
        game.sound.pauseAll();
        autoPausedAudio = true;
      }
      if (game.scene.isActive(SCENES.game) && !game.scene.isPaused(SCENES.game)) {
        game.scene.pause(SCENES.game);
        autoPausedGame = true;
      }
    } else {
      game.scene.stop(SCENES.rotate);
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
