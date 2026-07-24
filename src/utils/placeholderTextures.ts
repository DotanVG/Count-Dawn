import Phaser from 'phaser';
import { COLORS } from '../game/constants';
import { TEXTURES } from './assetKeys';

/**
 * Runtime-generated textures for the few props that have no pack art yet
 * (blood droplet, coffin). Generation is skipped if a real asset already
 * claimed the key in PreloadScene.
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  generate(scene, TEXTURES.blood, 16, 16, (g) => {
    g.fillStyle(COLORS.blood, 1);
    g.fillCircle(8, 9, 6);
    g.fillTriangle(8, 0, 4, 8, 12, 8);
  });

  generate(scene, TEXTURES.coffin, 56, 88, (g) => {
    g.fillStyle(COLORS.coffin, 1);
    g.fillRect(4, 4, 48, 80);
    g.lineStyle(3, COLORS.coffinOutline, 1);
    g.strokeRect(4, 4, 48, 80);
    g.lineStyle(2, COLORS.coffinOutline, 0.6);
    g.lineBetween(28, 8, 28, 80);
    g.lineBetween(12, 30, 44, 30);
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
