import type Phaser from 'phaser';
import { createFullscreenController } from './fullscreenController.ts';

let installed = false;

/**
 * Wires the #fullscreen-btn HTML button to the Fullscreen API. Hidden when the
 * API is unsupported (e.g. iPhone Safari). Adapted, simplified, from BeatEmPie.
 */
export function installFullscreenButton(game: Phaser.Game): void {
  if (installed) return;

  const button = document.getElementById('fullscreen-btn') as HTMLButtonElement | null;
  if (!button) return;
  installed = true;

  // Include the sibling fullscreen button and portrait overlay in the fullscreen tree.
  const controller = createFullscreenController(document, document.documentElement, (supported, fullscreen) => {
    button.hidden = !supported;
    const label = fullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(fullscreen));
    button.dataset.fullscreen = String(fullscreen);
    button.title = label;
    game.scale.refresh();
  });

  button.addEventListener('click', () => { void controller.toggle(); });
  window.addEventListener('resize', () => game.scale.refresh());
}
