"""
Builds the armed-hunter weapon props from Romi's four weapon drawings.

The sources are 192x192 JPEGs painted on a BLACK background (unlike every
other drawing of hers, which arrive on chroma green) — a wooden spike, a
pitchfork and two frames of a burning torch. JPEG has no alpha, so this
script:

  1. keys the black out by luminance, with a ramp across the JPEG ringing
     band that haloes every edge. Nothing in the paint is anywhere near
     black — the darkest real pixel is a mid-brown — so the key is a clean
     split rather than a guess,
  2. leaves every painted colour EXACTLY as drawn. There is no despill to do
     on a black key, and recolouring Romi's art is never on the table,
  3. crops all four to ONE common box so the weapons keep their relative
     sizes and, for the two torch frames, so the flame flickers in place
     instead of the whole prop jittering,
  4. downscales 3:1 to 64x64 — an exact integer ratio, so the pixel grid
     survives the resize.

Each weapon is written as its own image rather than a sheet: they are held
props parented to a hunter's hand (see ArmedHunter), not animation frames,
and the two torch frames are separate files for the same reason.

Usage:  python tools/build_weapon_props.py <folder-with-the-jpegs>
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

# Source name -> output name under public/assets/environment/weapons/.
WEAPONS = {
    "WOODEN_SPIKE.jpeg": "wooden_spike.png",
    "PITCH_FORK.jpeg": "pitchfork.png",
    "TORCH1.jpeg": "torch_1.png",
    "TORCH2.jpeg": "torch_2.png",
}

OUT_DIR = Path("public/assets/environment/weapons")

# Alpha ramp over luminance. The background sits at 0 and the paint well above
# 40; everything between is JPEG ringing along the edges.
LUM_LO, LUM_HI = 8, 40
FRAME_SIZE = 64
SOURCE_SIZE = 192


def keyed(path: Path) -> np.ndarray:
    """RGBA float array with the black background keyed out."""
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float64)
    lum = rgb.max(axis=2)
    alpha = np.clip((lum - LUM_LO) / (LUM_HI - LUM_LO), 0.0, 1.0)
    return np.dstack([rgb, alpha * 255.0])


def content_box(frames: list[np.ndarray]) -> tuple[int, int, int, int]:
    """One box around every frame's paint, so all four stay in proportion."""
    painted = np.zeros(frames[0].shape[:2], dtype=bool)
    for frame in frames:
        painted |= frame[..., 3] > 8
    ys, xs = np.nonzero(painted)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


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
    frames = {name: keyed(src / name) for name in WEAPONS}

    # Centre the common content box inside a square canvas: the props are held
    # and swung by rotating the sprite about its grip, so the blade has to stay
    # on the canvas's vertical centre line or the swing wobbles off-axis.
    left, top, right, bottom = content_box(list(frames.values()))
    cx, cy = (left + right) / 2, (top + bottom) / 2
    span = max(right - left, bottom - top)
    # Round the box up to a whole number of output pixels so the 3:1 downscale
    # below stays an exact integer ratio.
    step = SOURCE_SIZE // FRAME_SIZE
    span = min(SOURCE_SIZE, ((span + 2 * step - 1) // step) * step)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, out_name in WEAPONS.items():
        img = Image.fromarray(np.clip(frames[name], 0, 255).astype(np.uint8), "RGBA")
        box = (round(cx - span / 2), round(cy - span / 2))
        cropped = img.crop((box[0], box[1], box[0] + span, box[1] + span))
        out = OUT_DIR / out_name
        downscale(cropped, FRAME_SIZE).save(out)
        print(f"wrote {out} ({FRAME_SIZE}x{FRAME_SIZE}) from {name}")


if __name__ == "__main__":
    main()
