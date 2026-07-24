import type Phaser from 'phaser';

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function isFullscreen(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

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

  const doc = document as FullscreenDocument;
  const target = (document.getElementById('game-root') ?? document.documentElement) as FullscreenElement;
  const supported = Boolean(
    (doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? false) &&
      (target.requestFullscreen || target.webkitRequestFullscreen),
  );

  const sync = (): void => {
    button.hidden = !supported;
    const label = isFullscreen() ? 'Exit fullscreen' : 'Enter fullscreen';
    button.setAttribute('aria-label', label);
    button.title = label;
    game.scale.refresh();
  };

  button.addEventListener('click', async () => {
    try {
      if (isFullscreen()) {
        await Promise.resolve(doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else {
        await Promise.resolve(target.requestFullscreen?.() ?? target.webkitRequestFullscreen?.());
      }
    } finally {
      sync();
    }
  });

  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync as EventListener);
  window.addEventListener('resize', () => game.scale.refresh());

  sync();
}
