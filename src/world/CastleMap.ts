import Phaser from 'phaser';
import { ARENA, DEPTHS, MAP_COLS, MAP_ROWS, TILE, TILE_SCALE, TILE_SOURCE } from '../game/constants';
import { TEXTURES, ANIMS } from '../utils/assetKeys';

/**
 * Builds the castle great-hall from the dungeon tileset (16px tiles at 4x):
 * a 3-row north wall with three open-arch windows (transparent interiors, so
 * the DawnSky behind shows through), stone side/bottom walls, a tiled floor
 * with crack variants, and animated torch sconces between the windows.
 *
 * Tile indices refer to walls_floor.png as a 13-column grid.
 */

// Wall face (brick) tiles.
const T_WALL_CAP = 154;
const T_WALL_BRICK_A = 167;
const T_WALL_BRICK_B = 180;

// Windows, 2 wide x 3 tall, with see-through interiors: an open arch
// (for the center, where the sun rises in) and a barred variant (sides).
const OPEN_ARCH = [
  [237, 238],
  [250, 251],
  [263, 264],
];
const BARRED_WINDOW = [
  [241, 242],
  [254, 255],
  [267, 268],
];

const T_FLOOR = 131;

/** Left tile column of each 2-wide window; the middle one is the open arch. */
const WINDOW_COLS = [3, 9, 15];

/** World-x centers of the torch sconces, in the gaps between windows. */
const TORCH_X = [96, 448, 832, 1184];

export class CastleMap {
  constructor(scene: Phaser.Scene) {
    const grid: number[][] = [];

    for (let row = 0; row < MAP_ROWS; row++) {
      const line: number[] = [];
      for (let col = 0; col < MAP_COLS; col++) {
        line.push(this.tileAt(row, col));
      }
      grid.push(line);
    }

    // Punch the windows into the north wall (open arch center, barred sides).
    for (let i = 0; i < WINDOW_COLS.length; i++) {
      const wc = WINDOW_COLS[i];
      const pieces = i === 1 ? OPEN_ARCH : BARRED_WINDOW;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          grid[r][wc + c] = pieces[r][c];
        }
      }
    }

    const map = scene.make.tilemap({
      data: grid,
      tileWidth: TILE_SOURCE,
      tileHeight: TILE_SOURCE,
    });
    const tileset = map.addTilesetImage(TEXTURES.tiles);
    if (tileset) {
      map.createLayer(0, tileset, 0, 0)?.setScale(TILE_SCALE).setDepth(DEPTHS.map);
    }

    // Torch sconces on the wall face, flickering through the night.
    for (const x of TORCH_X) {
      const torch = scene.add
        .sprite(x, TILE * 2 + 8, TEXTURES.fire, 1)
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

  /** Base terrain before windows are punched in. */
  private tileAt(row: number, col: number): number {
    // North wall band (3 rows: cap + two brick courses).
    if (row === 0) return T_WALL_CAP;
    if (row === 1) return T_WALL_BRICK_A;
    if (row === 2) return T_WALL_BRICK_B;

    // Side and bottom walls.
    if (col === 0 || col === MAP_COLS - 1 || row >= MAP_ROWS - 2) {
      return row % 2 === 0 ? T_WALL_BRICK_A : T_WALL_BRICK_B;
    }

    return T_FLOOR;
  }
}
