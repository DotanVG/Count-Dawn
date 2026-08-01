import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './constants';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { GameScene } from '../scenes/GameScene';
import { PauseScene } from '../scenes/PauseScene';
import { GameOverScene } from '../scenes/GameOverScene';
import { VictoryScene } from '../scenes/VictoryScene';

/**
 * Phaser configuration: stable 1280x720 internal world, discretely scaled by
 * pixelPerfectScale.ts, pixel-art rendering, top-down Arcade physics (no gravity).
 * GameScene doubles as the main menu, so there is no separate menu scene.
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-root',
  backgroundColor: COLORS.nightSky,
  pixelArt: true,
  roundPixels: true,
  scale: {
    // FIT is deliberately not used: it fills the parent with arbitrary CSS
    // ratios. NONE lets the integer-scale controller supply exact zoom levels
    // while Phaser retains centering and pointer-coordinate transforms.
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    autoRound: true,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, GameScene, PauseScene, GameOverScene, VictoryScene],
};
