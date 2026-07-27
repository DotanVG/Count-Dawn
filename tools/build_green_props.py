"""
Builds the props Romi drew on chroma green rather than on black.

Two groups, and they are kept apart on purpose because "one common crop box"
means different things for each:

  * **The gold cross** (`RAW/weapons/gold-cross.jpeg`) is a single prop. It gets
    its own box, cropped to its own paint, so it fills its frame — it is thrown
    like a shuriken by the huntress Captain and it also stands in the middle of
    the Priest's ward, and both want every pixel they can get.

  * **The blood set** (`RAW/blood/*.jpeg`) shares ONE box across all eleven
    drawings, so a spot stays smaller than a splatter and a splatter stays
    smaller than the gore. They are one family and the sizes Romi drew them at
    relative to each other are information; cropping each to its own bounds
    would throw that away and make every mark the same size.

Both use the same chroma window as everything else of hers — an alpha ramp over
greenness with the despill limited to pixels greener than any of the paint (see
docs/ASSET_INTEGRATION.md). The blood is a flat red on green, which is about as
easy a key as exists, but the thresholds are the measured ones regardless.

Usage:  python tools/build_green_props.py [public/assets/RAW]
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

CROSS_OUT = Path("public/assets/environment/weapons/gold_cross.png")
BLOOD_OUT_DIR = Path("public/assets/environment/blood")

# Source stem -> output name. The stems already say what each drawing is for;
# these keep that meaning and drop the numbering that did not.
BLOOD = {
    "droplet-main": "droplet.png",
    "drop": "spot_1.png",
    "drop-plus": "spot_2.png",
    "splatter-1": "splatter_1.png",
    "splatter-1-alt": "splatter_2.png",
    "splatter-2": "splatter_3.png",
    "splatter-3": "splatter_4.png",
    "lines": "streak.png",
    "dotted": "spray.png",
    "gore-main": "gore_1.png",
    "gore-alt": "gore_2.png",
}

GREEN_LO, GREEN_HI = 60, 200
FRAME_SIZE = 64

# How far green is allowed to run ahead of the channel that caps it before the
# despill pulls it back. Per group, because the margin in each palette differs by
# an order of magnitude: Romi's blood keeps green within ~3 of blue, so it needs
# a little slack for JPEG noise, while the cross's gold sits ~72 below its red and
# any pixel at all above it is contamination.
DESPILL_TOL = {"blue": 14, "red": 0}


def keyed(path: Path, cap: str) -> np.ndarray:
    """
    RGBA float array with the green keyed out and despilled.

    `cap` names the channel green is not allowed to exceed, and it has to be
    chosen from the palette rather than defaulted, because the usual
    `min(g, max(r, b))` rule is blind to exactly the case these props hit.

    Blood is red on green. Its edge pixels are a red/green BLEND, which comes
    out yellow — and yellow has a high red channel, so `g - max(r, b)` reads it
    as paint and leaves it fully opaque. That olive rim around every splatter is
    what that looks like. Measured, Romi's blood has `g` within a couple of
    points of `b` everywhere, highlights included, so capping green at BLUE is
    lossless on the paint and turns every blend pixel back into red.

    The gold cross cannot use that rule — gold's green legitimately sits ~72
    above its blue and capping would turn it scarlet. But gold's green never
    exceeds its RED, so that is its cap.
    """
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float64)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # Alpha is measured on the ORIGINAL greenness, before any despill: the
    # despill drags the background's own green down, so doing it first would
    # leave the background opaque.
    greenness = g - np.maximum(r, b)
    alpha = 1.0 - np.clip((greenness - GREEN_LO) / (GREEN_HI - GREEN_LO), 0.0, 1.0)

    ceiling = (b if cap == "blue" else r) + DESPILL_TOL[cap]
    out = rgb.copy()
    out[..., 1] = np.minimum(g, np.maximum(ceiling, 0.0))
    return np.dstack([np.clip(out, 0, 255), alpha * 255.0])


def content_box(frames: list[np.ndarray], pad: int = 4) -> tuple[int, int, int]:
    """Square box (left, top, size) around every frame's paint, centred on it."""
    painted = np.zeros(frames[0].shape[:2], dtype=bool)
    for frame in frames:
        painted |= frame[..., 3] > 16
    ys, xs = np.nonzero(painted)
    left, right = int(xs.min()) - pad, int(xs.max()) + pad
    top, bottom = int(ys.min()) - pad, int(ys.max()) + pad
    size = max(right - left, bottom - top)
    cx, cy = (left + right) / 2, (top + bottom) / 2
    return round(cx - size / 2), round(cy - size / 2), size


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


def write(rgba: np.ndarray, box: tuple[int, int, int], out: Path) -> None:
    img = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")
    left, top, size = box
    cropped = img.crop((left, top, left + size, top + size))
    out.parent.mkdir(parents=True, exist_ok=True)
    downscale(cropped, FRAME_SIZE).save(out)
    print(f"wrote {out} ({FRAME_SIZE}x{FRAME_SIZE})")


def main() -> None:
    raw = Path(sys.argv[1] if len(sys.argv) > 1 else "public/assets/RAW")

    cross = keyed(raw / "weapons" / "gold-cross.jpeg", cap="red")
    write(cross, content_box([cross]), CROSS_OUT)

    blood = {stem: keyed(raw / "blood" / f"{stem}.jpeg", cap="blue") for stem in BLOOD}
    shared = content_box(list(blood.values()))
    print(f"blood share one box: left={shared[0]} top={shared[1]} size={shared[2]}")
    for stem, out_name in BLOOD.items():
        write(blood[stem], shared, BLOOD_OUT_DIR / out_name)


if __name__ == "__main__":
    main()
