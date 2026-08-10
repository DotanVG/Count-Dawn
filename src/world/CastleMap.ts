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
 * Romi's four painted wall-sconce torches, one on each blank pillar between
 * a window and a portrait frame — NOT the two outer wall sections, which
 * carry a similar-looking but unrelated corner bracket, not a torch cone
 * (an earlier pass here mistook those for two more torches; testing caught
 * it — only these four are real).
 *
 * Each point is the exact top-center of the pillar's cone-shaped torch
 * holder — the flat top edge where the holder opens to cradle the flame —
 * found by scanning room_bg.jpeg pixel-by-pixel for the holder's dark
 * outline (thresholded against the flat grey pillar face and the pillar's
 * own border dashes on either side) and taking the top row's midpoint. A
 * fire sprite centered here sits with its base in the cup and its flame
 * rising above it, matching where Romi actually drew the holder rather than
 * an eyeballed guess at the shape's overall middle.
 */
export const TORCH_POSITIONS = [
  { x: 364, y: 131 },
  { x: 536, y: 130 },
  { x: 743, y: 130 },
  { x: 915, y: 131 },
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
