import Phaser from 'phaser';
import { COLORS } from '../game/constants';
import { TEXTURES } from './assetKeys';

/**
 * Runtime-generated textures for props with no pack art yet (blood droplet,
 * particle dot). Runs AFTER PreloadScene's loading, and skips any key a real
 * asset already claimed — so shipping art always wins.
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  generate(scene, TEXTURES.blood, 16, 16, (g) => {
    g.fillStyle(COLORS.blood, 1);
    g.fillCircle(8, 9, 6);
    g.fillTriangle(8, 0, 4, 8, 12, 8);
  });

  // Soft square dot used by every particle effect (tinted per use).
  generate(scene, TEXTURES.particle, 8, 8, (g) => {
    g.fillStyle(0xffffff, 0.55);
    g.fillRect(0, 0, 8, 8);
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 2, 4, 4);
  });
}

function generate(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return; // a real asset already claimed this key
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}
