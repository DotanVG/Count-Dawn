import Phaser from 'phaser';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { gameConfig } from './config';
import { installFullscreenButton } from './fullscreen';
import { installOrientationGate } from './orientation';
import { installVampireCursor } from './vampireCursor';
import { gameSettings } from '../data/gameSettings';

if (location.hostname === 'count-dawn.vercel.app') {
  const beforeSend = <T extends { url: string }>(event: T): T => ({
    ...event, url: location.origin + location.pathname,
  });
  inject({ beforeSend });
  injectSpeedInsights({ beforeSend });
}

// Boot immediately into the original menu. Phaser and AudioDirector retain
// their normal gesture-based audio unlock; there is no HTML entry gate.
const game = new Phaser.Game({
  ...gameConfig,
  callbacks: {
    preBoot: (game) => {
      // Signal a working menu, rather than just a constructed engine. Failed
      // preload must leave the itch wrapper's recovery timeout available.
      game.events.once('menu-ready', () => {
        if (window.parent !== window) window.parent.postMessage('count-dawn:ready', '*');
      });
      game.events.once('boot-load-error', () => {
        const message = document.createElement('div');
        message.id = 'boot-loader';
        message.setAttribute('role', 'alert');
        message.textContent = 'The game could not load. Reload this page to try again.';
        document.getElementById('game-root')?.append(message);
      });
    },
  },
});

installFullscreenButton(game);
gameSettings.install();
installVampireCursor();
installOrientationGate(game);

if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}

export default game;
