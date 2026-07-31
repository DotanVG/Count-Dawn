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
 * The old tile version drew the floor and the wall band as two SEPARATE
 * layers (DEPTHS.floor below DEPTHS.wall) so an entering hunter, parked at
 * DEPTHS.enteringHunter in between, was hidden by the wall band but never by
 * the floor — see Hunter.beginEntrance(). A single flat image can't be cut
 * into a floor-shaped and a wall-shaped piece, so for now the whole image
 * sits at DEPTHS.floor: entering hunters are visible for their full walk-in
 * instead of emerging from behind the wall. Everything else about the
 * depth system (DEPTHS itself, the floor/wall ordering relative to hunters)
 * is unchanged. Restoring the hidden-approach look is Phase 2 work, once
 * there's either a wall-only alpha layer to draw separately or real
 * entrance animations that don't need it.
 */

/** World-x centers of the three windows, left, center (sun/moon arc), right. */
export const WINDOW_X_CENTERS = [253, 640, 1026] as const;
/** Y in the middle of the window band, for anything flying "through" one. */
export const WINDOW_Y = 119;

/** World-x centers of the four wall-sconce torches, in the gaps between windows/portraits. */
export const TORCH_X_CENTERS = [348, 549, 730, 931] as const;
export const TORCH_Y = 152;

/**
 * Measured entrance positions, NOT wired into spawn/walk-in logic yet
 * (Phase 2 — SpawnSystem still picks generic ARENA-edge points). Recorded
 * here so that work doesn't have to re-measure the image.
 */
export const ENTRANCES = {
  left: { x: 46, y: 383 },
  right: { x: 1233, y: 383 },
  down: { x: 640, y: 646 },
} as const;

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
