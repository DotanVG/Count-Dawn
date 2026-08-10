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
 * the end pillars (an earlier pass here dropped those two as a mistaken
 * bracket shape — they're real torches after all; testing caught it).
 *
 * Each point starts from the exact top-center of the pillar's cone-shaped
 * torch holder — the flat top edge where the holder opens to cradle the
 * flame — found by scanning room_bg.jpeg pixel-by-pixel for the holder's
 * dark outline (thresholded against the flat grey pillar face and the
 * pillar's own border dashes on either side) and taking the top row's
 * midpoint, then nudged +4 right / -5 up from that raw measurement per
 * testing feedback ("more up and right").
 *
 * CAVEAT: that nudge is this pass's best-effort read of "more up and right"
 * without a direct pixel comparison against Romi's marked-up screenshot
 * (red vs. pink circles) — the raw top-center alone is solid (verified by
 * rendering markers over it and eyeballing the overlay), but the offset is
 * a judgment call. If it's still off once the screenshot itself is
 * available, adjust these six against it directly rather than re-deriving
 * from the image again.
 */
export const TORCH_POSITIONS = [
  { x: 124, y: 128 }, // outer left
  { x: 368, y: 126 }, // between window 1 and portrait 1
  { x: 540, y: 125 }, // between portrait 1 and window 2
  { x: 747, y: 125 }, // between window 2 and portrait 2
  { x: 919, y: 126 }, // between portrait 2 and window 3
  { x: 1163, y: 128 }, // outer right
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
