import Phaser from 'phaser';
import { COLORS } from '../game/constants';
import { TEXTURES } from './assetKeys';

/**
 * Runtime-generated textures for the few props that have no pack art yet
 * (blood droplet, coffin closed/open, particle dot). Generation is skipped
 * if a real asset already claimed the key in PreloadScene — the artist's
 * coffin sprites will replace the two coffin keys with no other changes.
 */
export function createPlaceholderTextures(scene: Phaser.Scene): void {
  generate(scene, TEXTURES.blood, 16, 16, (g) => {
    g.fillStyle(COLORS.blood, 1);
    g.fillCircle(8, 9, 6);
    g.fillTriangle(8, 0, 4, 8, 12, 8);
  });

  generate(scene, TEXTURES.coffinClosed, 56, 88, (g) => {
    drawCoffinBase(g);
    // Closed lid: full front panel with a cross seam.
    g.lineStyle(2, COLORS.coffinOutline, 0.6);
    g.lineBetween(28, 8, 28, 80);
    g.lineBetween(12, 30, 44, 30);
  });

  generate(scene, TEXTURES.coffinOpen, 56, 88, (g) => {
    drawCoffinBase(g);
    // Open: dark interior with the lid leaning to the side.
    g.fillStyle(0x0a0512, 1);
    g.fillRect(10, 10, 36, 68);
    g.lineStyle(2, COLORS.coffinOutline, 0.8);
    g.strokeRect(10, 10, 36, 68);
    g.fillStyle(COLORS.coffin, 1);
    g.fillRect(44, 4, 12, 80);
    g.lineStyle(2, COLORS.coffinOutline, 1);
    g.strokeRect(44, 4, 12, 80);
  });

  // Soft square dot used by every particle effect (tinted per use).
  generate(scene, TEXTURES.particle, 8, 8, (g) => {
    g.fillStyle(0xffffff, 0.55);
    g.fillRect(0, 0, 8, 8);
    g.fillStyle(0xffffff, 1);
    g.fillRect(2, 2, 4, 4);
  });
}

function drawCoffinBase(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(COLORS.coffin, 1);
  g.fillRect(4, 4, 48, 80);
  g.lineStyle(3, COLORS.coffinOutline, 1);
  g.strokeRect(4, 4, 48, 80);
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
