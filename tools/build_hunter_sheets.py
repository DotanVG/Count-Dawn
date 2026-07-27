"""
Builds the three hunter sheets Romi drew, replacing the bought CraftPix men.

Sources are 240x240 JPEGs on chroma green, six per character — two frames each
for down, up and the left-facing side view:

    RAW/pilgrim/   the basic hunter: tall hat, white shirt, braces
    RAW/huntress/  the other basic hunter: hair in a bun, brown dress
    RAW/farmer/    the garlic thrower: straw hat, blue overalls

Each becomes one 2x4 sheet in the row order animations.ts expects — down, up,
left, right — with the right-facing row being the left pair mirrored, because
Romi drew the side view facing left only.

Two things here are deliberate and worth not undoing:

  1. **They are built into the SAME frame region the CraftPix hunters occupied**
     (head about row 20, soles on row 43 of the 64px frame). That is why
     nothing else in the game had to move: HUNTER.spriteScale, the physics
     circle, `visibleTopY`, and — the one that would have been most annoying to
     re-tune — ArmedHunter's CARRY hand offsets, so Romi's weapons still land
     in Romi's hunters' fists. Change FEET_ROW or SCALE and you are re-tuning
     all four.

  2. **Each direction is registered on its own FEET**, averaged across the pair,
     not on a bounding box. Arms and heads move between the two frames of a
     walk, and the farmer's feet swing 22px apart between his two front frames,
     so a bbox crop slides the whole character around the floor as he steps.
     One box per direction also means the pair cannot drift against each other.

The 448px box downscales 7:1 to the 64px frame — an exact integer ratio, so the
pixel grid survives.

Usage:  python tools/build_hunter_sheets.py [public/assets/RAW]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

OUT_DIR = Path("public/assets/characters/humans")

# Which RAW folder becomes which sheet. The frame stems are the same in all three.
CHARACTERS = {
    "pilgrim": "pilgrim.png",
    "huntress": "huntress.png",
    "farmer": "farmer.png",
}

# Row order must match TWO_FRAME_ROWS in src/utils/animations.ts.
# (direction, source stems, mirror?)
ROWS: list[tuple[str, list[str], bool]] = [
    ("down", ["down-1", "down-2"], False),
    ("up", ["up-1", "up-2"], False),
    ("left", ["left-1", "left-2"], False),
    ("right", ["left-1", "left-2"], True),
]

# Alpha ramp over greenness (g - max(r, b)). The same window the Count uses, for
# the same reason: paint stops well below GREEN_LO and the background starts at
# ~230, so the ramp lives in the empty gap between them and nothing at or below
# GREEN_LO is touched at all. Measured across all eighteen frames before being
# set — see docs/ASSET_INTEGRATION.md.
GREEN_LO, GREEN_HI = 60, 200

FRAME_SIZE = 64
# 5:1, so a ~150px source figure lands at ~30px in the frame.
#
# This was 7:1 first, which put them in exactly the 21px the CraftPix men filled
# and meant not one constant elsewhere had to move. It also threw away most of
# the drawing: at 21px the huntress is a brown blob with no face and no bun,
# because Romi drew far more detail than that can hold. 30px keeps her readable,
# at the cost of re-tuning the four things that are measured off this geometry —
# HUNTER.spriteScale, the physics circle, `visibleTopY`, and ArmedHunter's CARRY
# hand offsets. Worth it; the art is the point.
SCALE = 5
CROP_SIZE = FRAME_SIZE * SCALE
# Where the soles land. Low enough to leave headroom for the taller figure.
FEET_ROW = 48
# Fraction of the figure's height, measured up from the soles, that counts as
# "feet" for the registration centroid.
FEET_BAND = 0.18


def keyed(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """RGBA float array plus the body mask, green keyed out and despilled."""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float64)
    other = np.maximum(rgb[..., 0], rgb[..., 2])
    greenness = rgb[..., 1] - other

    alpha = 1.0 - np.clip((greenness - GREEN_LO) / (GREEN_HI - GREEN_LO), 0.0, 1.0)
    # Despill only where the pixel is greener than any of Romi's paint gets —
    # i.e. only where the background actually bled in. A blanket clamp would
    # drain real colour; see the Count's robe in build_count_sheets.py.
    out = rgb.copy()
    spilled = greenness > GREEN_LO
    out[..., 1] = np.where(spilled, np.minimum(rgb[..., 1], other), rgb[..., 1])
    return np.dstack([np.clip(out, 0, 255), alpha * 255.0]), alpha > 0.5


def feet(body: np.ndarray) -> tuple[float, float]:
    """Centre-x of the feet band and the sole row — the registration landmark."""
    ys, xs = np.nonzero(body)
    top, sole = int(ys.min()), int(ys.max())
    cut = sole - int((sole - top + 1) * FEET_BAND)
    band = body.copy()
    band[:cut, :] = False
    band_ys, band_xs = np.nonzero(band)
    return float(band_xs.mean()), float(band_ys.max())


def downscale(img: Image.Image, size: int) -> Image.Image:
    """Resize through premultiplied alpha so transparent black can't bleed in."""
    a = np.asarray(img).astype(np.float64) / 255.0
    premul = np.dstack([a[..., :3] * a[..., 3:4], a[..., 3:4]])
    small = (
        np.asarray(
            Image.fromarray((premul * 255).astype(np.uint8), "RGBA").resize(
                (size, size), Image.LANCZOS
            )
        ).astype(np.float64)
        / 255.0
    )
    alpha = np.clip(small[..., 3:4], 0.0, 1.0)
    rgb = np.divide(small[..., :3], alpha, out=np.zeros_like(small[..., :3]), where=alpha > 0)
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), alpha]) * 255).astype(np.uint8), "RGBA")


def build(source_dir: Path, out_path: Path) -> None:
    sheet = Image.new("RGBA", (FRAME_SIZE * 2, FRAME_SIZE * len(ROWS)), (0, 0, 0, 0))

    for row, (direction, stems, mirror) in enumerate(ROWS):
        keys = [keyed(source_dir / f"{stem}.jpeg") for stem in stems]
        marks = [feet(body) for _, body in keys]
        # One box for the whole pair, so the two frames of a direction cannot
        # drift against each other as he steps.
        centre_x = sum(m[0] for m in marks) / len(marks)
        sole_y = sum(m[1] for m in marks) / len(marks)
        left = round(centre_x) - CROP_SIZE // 2
        top = round(sole_y) - FEET_ROW * SCALE

        for column, (rgba, _) in enumerate(keys):
            img = Image.fromarray(rgba.astype(np.uint8), "RGBA")
            frame = downscale(img.crop((left, top, left + CROP_SIZE, top + CROP_SIZE)), FRAME_SIZE)
            if mirror:
                frame = frame.transpose(Image.FLIP_LEFT_RIGHT)
            sheet.paste(frame, (column * FRAME_SIZE, row * FRAME_SIZE))
        print(f"  {direction:5s} feet x={centre_x:6.1f} sole y={sole_y:6.1f}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    print(f"wrote {out_path} ({sheet.width}x{sheet.height}, 2 frames x {len(ROWS)} directions)")


def main() -> None:
    raw = Path(sys.argv[1] if len(sys.argv) > 1 else "public/assets/RAW")
    for folder, out_name in CHARACTERS.items():
        print(f"== {folder}")
        build(raw / folder, OUT_DIR / out_name)


if __name__ == "__main__":
    main()
