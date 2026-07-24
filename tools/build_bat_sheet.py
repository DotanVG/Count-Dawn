"""
Builds public/assets/characters/bat/bat_fly.png from Romi's two bat frames.

The source frames arrive as 240x240 JPEGs: dark-purple wing strokes plus gold
eyes and white fangs, painted on a solid black background. JPEG has no alpha
and the black is background (not a silhouette — there is no membrane fill), so
this script:

  1. keys the black out by luminance, with a ramp across the JPEG ringing band
     that hugs every stroke (ringing tops out ~20, the strokes sit ~56),
  2. brightens ONLY the wing strokes so they read against the castle floor —
     the raw #38213A is all but invisible on the dark tiles. Hue is preserved;
     eyes and fangs are already bright and are left exactly as painted,
  3. crops both frames to a common box registered on the EYES, so the head
     stays put and only the wings move across the flap,
  4. downscales to the project's 64x64 character frame and lays the two frames
     out horizontally into a 128x64 sheet.

Usage:  python tools/build_bat_sheet.py <folder-with-bat1.jpeg-bat2.jpeg>
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

FRAMES = ["bat1.jpeg", "bat2.jpeg"]
OUT = Path("public/assets/characters/bat/bat_fly.png")

# Alpha ramp over luminance. Below LO is background/ringing, above HI is paint.
ALPHA_LO, ALPHA_HI = 22, 40
# A pixel this bright is an eye or a fang — already readable, never boosted.
HIGHLIGHT_LUM = 100
# Multiplier on the wing strokes. #38213A -> ~#925694, the same purple the dash
# trail already uses, at a value that survives the dark floor.
STROKE_BOOST = 2.6

# Crop box registered on the eyes: (dx, dy) from the eye centroid to the box
# centre, then the box size. Sized from the union of both frames' bounding
# boxes so no wing tip is ever clipped, with a little breathing room.
CROP_OFFSET = (-20, 4)
CROP_SIZE = 160
FRAME_SIZE = 64


def eye_centroid(rgb: np.ndarray) -> tuple[float, float]:
    """Centre of the gold/white face pixels — the one landmark in both frames."""
    ys, xs = np.nonzero(rgb.max(axis=2) >= HIGHLIGHT_LUM)
    return float(xs.mean()), float(ys.mean())


def to_rgba(path: Path) -> Image.Image:
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float64)
    lum = rgb.max(axis=2)

    alpha = np.clip((lum - ALPHA_LO) / (ALPHA_HI - ALPHA_LO), 0.0, 1.0)
    boost = np.where(lum[..., None] >= HIGHLIGHT_LUM, 1.0, STROKE_BOOST)
    out = np.dstack([np.clip(rgb * boost, 0, 255), alpha * 255])

    img = Image.fromarray(out.astype(np.uint8), "RGBA")
    cx, cy = eye_centroid(rgb)
    left = round(cx + CROP_OFFSET[0] - CROP_SIZE / 2)
    top = round(cy + CROP_OFFSET[1] - CROP_SIZE / 2)
    cropped = img.crop((left, top, left + CROP_SIZE, top + CROP_SIZE))
    return downscale(cropped, FRAME_SIZE)


def downscale(img: Image.Image, size: int) -> Image.Image:
    """Resize through premultiplied alpha so transparent black can't bleed in."""
    a = np.asarray(img).astype(np.float64) / 255.0
    premul = np.dstack([a[..., :3] * a[..., 3:4], a[..., 3:4]])
    small = np.asarray(
        Image.fromarray((premul * 255).astype(np.uint8), "RGBA").resize(
            (size, size), Image.LANCZOS
        )
    ).astype(np.float64) / 255.0
    alpha = np.clip(small[..., 3:4], 0.0, 1.0)
    rgb = np.divide(small[..., :3], alpha, out=np.zeros_like(small[..., :3]), where=alpha > 0)
    return Image.fromarray(
        (np.dstack([np.clip(rgb, 0, 1), alpha]) * 255).astype(np.uint8), "RGBA"
    )


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    frames = [to_rgba(src / name) for name in FRAMES]

    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for i, frame in enumerate(frames):
        sheet.paste(frame, (i * FRAME_SIZE, 0))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT)
    print(f"wrote {OUT} ({sheet.width}x{sheet.height}, {len(frames)} frames)")


if __name__ == "__main__":
    main()
