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
 * All six of Romi's painted wall-sconce torches: the four between each
 * window/portrait pair, plus the two on the outer wall sections flanking
 * the end pillars.
 *
 * These are placement coordinates for the ANIMATED FIRE SPRITE
 * (TEXTURES.fire), not the torch holder's own position — the two are not
 * the same point, which is why earlier passes at this kept landing wrong
 * even with an accurate read of the holder itself:
 *
 * 1. room_bg.jpeg is authored at 1280x768 but CastleMap stretches it to
 *    the 1280x720 canvas (setDisplaySize) — a 0.9375x vertical squish. A
 *    Y measured on the source file (as the holder positions originally
 *    were) lands ~6% too low on screen unless multiplied by 720/768 first.
 * 2. The fire sprite's OWN painted content is not centered in its 44x48
 *    frame — verified by comparing a background-only capture of the
 *    canvas against one with the torches visible (same crop, per-pixel
 *    brightness delta): the flame's visible centroid sits a consistent
 *    ~18px left of wherever the sprite is placed, the same offset on
 *    every torch regardless of which random animation frame it started
 *    on. So the sprite has to be placed 18px right of the actual target
 *    for the VISIBLE flame to land there.
 *
 * Both corrections are folded in below: each point is the holder's
 * top-center (the upside-down triangle's peak — its widest, flattest
 * edge, where a flame would rise out of the cup), Y already converted to
 * on-screen scale, X shifted +18 to cancel the sprite's own off-center
 * art. Confirmed live, not by calculation alone: with torches hidden vs.
 * shown, the same per-pixel diff used to find the offset was re-run
 * against these corrected coordinates, and the flame's visible centroid
 * landed within ~2px of the holder's actual on-screen top-center on every
 * torch checked.
 */
export const TORCH_POSITIONS = [
  { x: 138, y: 125 }, // outer left
  { x: 382, y: 123 }, // between window 1 and portrait 1
  { x: 554, y: 122 }, // between portrait 1 and window 2
  { x: 761, y: 122 }, // between window 2 and portrait 2
  { x: 933, y: 123 }, // between portrait 2 and window 3
  { x: 1177, y: 125 }, // outer right
] as const;

export class CastleMap {
  constructor(scene: Phaser.Scene) {
    scene.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEXTURES.roomBg)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(DEPTHS.floor);

    // Torch sconces on the wall face, flickering through the night.
    for (const { x, y } of TORCH_POSITIONS) {
      const torch = scene.add
        .sprite(x, y, TEXTURES.fire, 1)
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
