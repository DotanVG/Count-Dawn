"""
Strips the dithered sill out of the castle window tiles.

The dungeon tileset draws its window openings with a checkerboard of
half-transparent pixels along the bottom of the arch - a stipple meant to read as
a fading sill when the tile sits over solid ground. Count Dawn puts the live
sky behind those openings instead, so the stipple has nothing to fade into: it
renders as a floating checkered strip across the middle window, right under the
sunrise timer, looking like a leftover doorway threshold.

Every one of those pixels is partially transparent (0 < alpha < 255) and every
pixel meant to be wall is fully opaque, so the fix is exact rather than a
guess: drop the partial ones from the window tiles only, leaving the stone
untouched. Idempotent - a second run finds nothing left to clear.

Usage:  python tools/clean_window_dither.py
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SHEET = Path("public/assets/environment/castle/walls_floor.png")
TILE = 16
COLUMNS = 13

# The two window variants CastleMap punches into the north wall, open arch
# (centre) and barred (sides). See src/world/CastleMap.ts.
WINDOW_TILES = [237, 238, 250, 251, 263, 264, 241, 242, 254, 255, 267, 268]


def main() -> None:
    image = np.array(Image.open(SHEET).convert("RGBA"))
    cleared = 0

    for index in WINDOW_TILES:
        row, column = divmod(index, COLUMNS)
        y, x = row * TILE, column * TILE
        alpha = image[y : y + TILE, x : x + TILE, 3]

        stipple = (alpha > 0) & (alpha < 255)
        count = int(stipple.sum())
        if count == 0:
            continue

        # Zero the colour too, so no half-lit fringe survives the downscale
        # into the tilemap.
        image[y : y + TILE, x : x + TILE][stipple] = (0, 0, 0, 0)
        cleared += count
        print(f"  tile {index}: cleared {count} stipple px")

    if cleared == 0:
        print("nothing to clear - the sheet is already clean")
        return

    Image.fromarray(image, "RGBA").save(SHEET)
    print(f"wrote {SHEET} ({cleared} px cleared)")


if __name__ == "__main__":
    main()
