import Phaser from 'phaser';
import { ARENA, DEPTHS, GAME_HEIGHT, GAME_WIDTH } from '../game/constants';
import { TEXTURES, ANIMS } from '../utils/assetKeys';

/**
 * Phase 1 room-replacement test: the castle great-hall as ONE flat painted
 * image (Romi's room_bg.jpeg, 1280x768) stretched to fill the 1280x720
 * canvas, standing in for the old walls_floor.png tilemap (still loaded,
 * unused — see PreloadScene). All the position constants below were
 * measured directly off that image; they will drift the moment Romi ships a
 * revised painting and need re-measuring.
 *
 * Phase 2: entrances are now real doors (see systems/EntranceController.ts,
 * which owns ENTRANCES — kept out of this file because it has to stay
 * Phaser-free for the unit tests). Hunters walking in are handed the
 * DEPTHS.enteringHunter depth for the whole walk, same as before; there is
 * still no separate wall layer to hide behind, so the fade-in on
 * Hunter.beginEntrance() is what sells "emerging from the door" instead.
 */

/** World-x centers of the three windows, left, center (sun/moon arc), right. */
export const WINDOW_X_CENTERS = [253, 640, 1026] as const;
/** Y in the middle of the window band, for anything flying "through" one. */
export const WINDOW_Y = 119;

/**
 * World-x centers of Romi's six painted wall-sconce torches: the four
 * between each window/portrait pair, plus the two on the outer wall
 * sections flanking the end pillars. Measured directly off room_bg.jpeg —
 * each is the small grey bracket-and-drip shape at TORCH_Y, centered on the
 * blank pillar between two window/portrait frames (or, for the outer two,
 * between the corner and the nearest window).
 */
export const TORCH_X_CENTERS = [118, 360, 535, 740, 908, 1160] as const;
export const TORCH_Y = 150;

export class CastleMap {
  constructor(scene: Phaser.Scene) {
    scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEXTURES.roomBg)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.floor);

    // Torch sconces on the wall face, flickering through the night.
    for (const x of TORCH_X_CENTERS) {
      const torch = scene.add
        .sprite(x, TORCH_Y, TEXTURES.fire, 1)
        .setScale(1.6)
        .setDepth(DEPTHS.torch);
      torch.play({ key: ANIMS.torch, startFrame: Phaser.Math.Between(0, 5) });
    }

    // Physics: the playfield is everything inside the walls.
    scene.physics.world.setBounds(
      ARENA.left,
      ARENA.top,
      ARENA.right - ARENA.left,
      ARENA.bottom - ARENA.top,
    );
  }
}
