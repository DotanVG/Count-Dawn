import Phaser from 'phaser';
import { COLORS } from '../game/constants';
import { TEXTURES } from './assetKeys';

/**
 * Generates every placeholder texture at runtime with Phaser Graphics.
 * Delete the relevant generator call once a real asset is loaded under the
 * same key in PreloadScene (generation is skipped if the key already exists).
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  generate(scene, TEXTURES.vampire, 48, 48, (g) => {
    // Dark purple rounded body with a lighter outline and a small "fang" notch.
    g.fillStyle(COLORS.vampire, 1);
    g.fillRoundedRect(4, 4, 40, 40, 12);
    g.lineStyle(3, COLORS.vampireOutline, 1);
    g.strokeRoundedRect(4, 4, 40, 40, 12);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(18, 30, 22, 30, 20, 38);
    g.fillTriangle(26, 30, 30, 30, 28, 38);
  });

  generate(scene, TEXTURES.hunter, 32, 32, (g) => {
    g.fillStyle(COLORS.hunter, 1);
    g.fillRect(4, 4, 24, 24);
    g.lineStyle(2, 0x6b6350, 1);
    g.strokeRect(4, 4, 24, 24);
  });

  generate(scene, TEXTURES.boss, 72, 72, (g) => {
    g.fillStyle(COLORS.boss, 1);
    g.fillRect(6, 6, 60, 60);
    g.lineStyle(5, COLORS.bossOutline, 1);
    g.strokeRect(6, 6, 60, 60);
  });

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
