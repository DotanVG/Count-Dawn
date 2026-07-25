"""
Builds public/assets/characters/humans/priest.png from Romi's six priest frames.

The sources are 240x240 JPEGs on chroma green: a stout old priest in a navy
cassock with a white collar, a gold cross and a big wooden stake, drawn two
frames per direction — down (facing us), up (back turned) and side (facing
LEFT, mirrored in the sheet for right). JPEG has no alpha, so this script:

  1. keys the green out by greenness (g - max(r, b)), with a ramp across the
     JPEG ringing band that hugs every edge,
  2. despills the green the JPEG bled into the edge pixels, by clamping the
     green channel to the other two wherever it runs ahead of them. Every
     painted colour is otherwise passed through UNTOUCHED,
  3. registers each DIRECTION on the priest's BOOTS rather than on his
     bounding box. His stake swings right across the frame between the two
     frames of a pair, so a bbox crop would slide him around the floor while
     he "walks"; his boots barely move. Romi also drew the back-turned pair
     about 11px left of the other four, which registering on the boots
     silently corrects,
  4. downscales 4:1 from a 256px box to the project's 64x64 character frame —
     an exact integer ratio, so the pixel grid survives the resize.

The result is a 2x4 sheet (2 frames per row) in the row order the game's
PRIEST_ROWS expects: down, up, left, right.

Usage:  python tools/build_priest_sheet.py <folder-with-the-jpegs>
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path("public/assets/characters/humans/priest.png")

# Row order must match PRIEST_ROWS in src/utils/animations.ts. "right" is the
# left-facing pair mirrored — Romi drew the side view facing left only.
ROWS: list[tuple[str, list[str], bool]] = [
    ("down", ["priest-down-1.jpeg", "priest-down-2.jpeg"], False),
    ("up", ["priest-up-1.jpeg", "priest-up-2.jpeg"], False),
    ("left", ["priest-side-1.jpeg", "priest-side-2.jpeg"], False),
    ("right", ["priest-side-1.jpeg", "priest-side-2.jpeg"], True),
]

# Alpha ramp over greenness (g - max(r, b)). The background sits at ~239 and
# the paint at <= 0; everything between is JPEG ringing along the edges.
GREEN_LO, GREEN_HI = 10, 60
# His boots are the darkest thing he wears — the registration landmark.
BOOT_MAX_LUM = 60

FRAME_SIZE = 64
CROP_SIZE = 256
SCALE = CROP_SIZE // FRAME_SIZE
# Where the soles land in the output frame. Low enough that he stands on his
# own feet rather than hovering, high enough to leave the sheet a margin.
FEET_ROW = 52


def keyed(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """RGBA float array plus the body mask, with the green keyed and despilled."""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float64)
    other = np.maximum(rgb[..., 0], rgb[..., 2])
    greenness = rgb[..., 1] - other

    alpha = 1.0 - np.clip((greenness - GREEN_LO) / (GREEN_HI - GREEN_LO), 0.0, 1.0)
    # Despill: the only colour change. Everything else is Romi's paint as-is.
    out = rgb.copy()
    out[..., 1] = np.minimum(rgb[..., 1], other)
    return np.dstack([np.clip(out, 0, 255), alpha * 255.0]), greenness < GREEN_LO


def boots(rgba: np.ndarray, body: np.ndarray) -> tuple[float, float]:
    """Centre-x and sole-y of the darkest pixels he wears — his boots."""
    ys, xs = np.nonzero(body & (rgba[..., :3].max(axis=2) <= BOOT_MAX_LUM))
    return float(xs.mean()), float(ys.max())


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


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    sheet = Image.new("RGBA", (FRAME_SIZE * 2, FRAME_SIZE * len(ROWS)), (0, 0, 0, 0))

    for row, (name, files, mirror) in enumerate(ROWS):
        keys = [keyed(src / f) for f in files]
        marks = [boots(rgba, body) for rgba, body in keys]
        # One box for the whole pair, so the two frames of a direction cannot
        # drift against each other.
        centre_x = sum(m[0] for m in marks) / len(marks)
        sole_y = sum(m[1] for m in marks) / len(marks)
        left = round(centre_x) - CROP_SIZE // 2
        top = round(sole_y) - FEET_ROW * SCALE

        for column, (rgba, _) in enumerate(keys):
            img = Image.fromarray(rgba.astype(np.uint8), "RGBA")
            cropped = img.crop((left, top, left + CROP_SIZE, top + CROP_SIZE))
            frame = downscale(cropped, FRAME_SIZE)
            if mirror:
                frame = frame.transpose(Image.FLIP_LEFT_RIGHT)
            sheet.paste(frame, (column * FRAME_SIZE, row * FRAME_SIZE))
        print(f"row {row} ({name}): boots x={centre_x:.1f} sole y={sole_y:.1f}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f"wrote {OUT} ({sheet.width}x{sheet.height}, 2 frames x {len(ROWS)} directions)")


if __name__ == "__main__":
    main()
