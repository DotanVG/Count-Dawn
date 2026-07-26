"""
Builds the Count's four spritesheets from Romi's hand-drawn vampire.

Romi's Count is not a sprite pack. It is a folder of 240x240 JPEGs on chroma
green: one pose facing the camera, one with his back turned, one facing left,
six frames of a left-facing run, three attack poses and a seven-frame death.
The pack it replaces had six sheets of 4x12 frames. So most of the work here is
deciding what stands in for what — the mapping is spelled out in FRAMES below,
and the honest summary is:

  * Facing LEFT is facing RIGHT mirrored, everywhere. Romi drew the side view
    once, facing RIGHT — nose, fangs and chin point right and the cape trails
    left behind him — exactly like the bat. Getting this backwards is the
    classic silent sprite bug: it looks fine standing still and is only obvious
    once you hold D and watch him run away from the direction he is facing.
  * Idle is two real drawings: the standing pose, and the calmest frame of the
    run cycle (move-4, whose silhouette is within a couple of pixels of the
    standing pose). It reads as a weight shift rather than as a float, which is
    all a two-frame idle has to do.
  * Running toward the camera alternates the front pose with a run frame, and
    then does it again with that run frame mirrored, so his legs swap. Running
    away is the back pose alternating with its own mirror, for the same reason.
    Neither is a real cycle; both read as one at 12fps.
  * The attack opens on the first pose and then beats between the second and
    third — the sequence Romi asked for — and the magic burst on top of it
    comes from the CraftPix pack's effects-only layer, which is all that is
    left of the vampire the Count replaces.
  * Death runs fall, fall, down. The burning and ash frames after it are a
    SEPARATE animation (see 'sunburn'), because they are only true when the
    thing that killed him was the sunrise.

Every frame is cropped with the SAME box, so nothing shifts between animations
and he falls where he stood, and the box is 320px downscaled 5:1 to the
project's 64x64 character frame — an exact integer ratio, so the pixel grid
survives the resize.

Usage:  python tools/build_count_sheets.py <count-dawn-new-player-vampire-character>
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

OUT_DIR = Path("public/assets/characters/vampire")

# Alpha ramp over greenness (g - max(r, b)). The background sits at ~239 and
# the JPEG rings all the way down to ~60 around every edge.
#
# GREEN_LO cannot be the small number the bat and the Priest use. The Count's
# ROBE IS GREEN — a dark forest green that measures 10-30 greenness, sitting
# right where a tighter key would start dissolving it, and where a naive
# despill would clamp it to near-black. A greenness histogram over all of
# Romi's frames is unambiguous: paint stops at ~59, the background starts at
# ~230, and the counts in between are two orders of magnitude lower. So the
# ramp lives in the gap, and nothing at or below GREEN_LO is touched at all.
GREEN_LO, GREEN_HI = 60, 200

SOURCE_SIZE = 240
FRAME_SIZE = 64
SCALE = 5
CROP_SIZE = FRAME_SIZE * SCALE  # 320

# One box for every frame of every animation, sized so the Count sits inside
# the 64px frame with a margin rather than filling it corner to corner, and
# placed on the centre of everything he is ever drawn doing.
CROP_LEFT = -43
CROP_TOP = -40

DEATH = "count-dawn-death-animation"

# (source stem, mirror?) per frame, per direction. `None` is a deliberately
# empty frame: a row that holds fewer real frames than the sheet is wide, which
# animations.ts is told about through `shortRows` so the Count cannot blink out
# of existence on the padding.
Frame = tuple[str, bool] | None

FRAMES: dict[str, dict[str, list[Frame]]] = {
    "idle": {
        # Standing pose, then the run's calmest frame — a shift of weight. Only
        # the back view has nothing to pair with, so it shifts against its own
        # mirror instead.
        "down": [("count-dawn-down-1", False), ("count-dawn-move-4", False)],
        "up": [("count-dawn-up-1", False), ("count-dawn-up-1", True)],
        "left": [("count-dawn-side-1", True), ("count-dawn-move-4", True)],
        "right": [("count-dawn-side-1", False), ("count-dawn-move-4", False)],
    },
    "run": {
        # The front pose against a run frame, twice. NOTHING here is mirrored:
        # move-4 faces right, so its mirror faces LEFT, and a left-facing frame
        # inside the row used for running toward the camera reads as the Count
        # snapping sideways for one frame every stride. The repeat is not
        # padding — a short row is slowed to the full row's cycle length, so
        # four entries is what keeps his stride in time with the side view.
        "down": [
            ("count-dawn-down-1", False),
            ("count-dawn-move-4", False),
            ("count-dawn-down-1", False),
            ("count-dawn-move-4", False),
            None,
            None,
        ],
        # The back pose against its own mirror, twice. Mirroring is safe here
        # where it is not on the `down` row: a back view flipped is still a back
        # view, so it reads as his legs swapping rather than as him turning.
        # Two entries would say the same thing, but a two-frame row gets slowed
        # to the six-frame row's cycle length and he would waddle away at 4fps.
        "up": [
            ("count-dawn-up-1", False),
            ("count-dawn-up-1", True),
            ("count-dawn-up-1", False),
            ("count-dawn-up-1", True),
            None,
            None,
        ],
        # Drawn running right, so LEFT is the mirrored row.
        "left": [(f"count-dawn-move-{i}", True) for i in range(1, 7)],
        "right": [(f"count-dawn-move-{i}", False) for i in range(1, 7)],
    },
    "attack": {
        # Front-on poses, so the mirror only decides which way the cape flares.
        # Kept on the same rule as the run so the two never disagree.
        "down": [("count-dawn-attack-" + n, False) for n in "123231"],
        "up": [("count-dawn-attack-" + n, False) for n in "123231"],
        "left": [("count-dawn-attack-" + n, True) for n in "123231"],
        "right": [("count-dawn-attack-" + n, False) for n in "123231"],
    },
    "death": {
        # 0-2 the fall, 3-4 burning, 5-6 ash. The game plays 0-2 for a death by
        # hunters and the whole strip for a death by sunrise.
        "down": [(n, False) for n in (
            f"{DEATH}/fall-down-1",
            f"{DEATH}/fall-down-2",
            f"{DEATH}/fall-down-3-laying-dead",
            f"{DEATH}/dead-burning-1-alternating",
            f"{DEATH}/dead-burning-2-alternating",
            f"{DEATH}/dead-ashes-1-post-burn-alternating",
            f"{DEATH}/dead-ashes-2-post-burn-alternating",
        )],
    },
}
# He lies facing left, so three of the four directions are the drawing as-is.
FRAMES["death"]["up"] = FRAMES["death"]["down"]
FRAMES["death"]["left"] = FRAMES["death"]["down"]
FRAMES["death"]["right"] = [(name, True) for name, _ in FRAMES["death"]["down"]]

# Must match VAMPIRE_ROWS in src/utils/animations.ts.
ROW_ORDER = ["down", "up", "left", "right"]

OUT_NAMES = {
    "idle": "vampire_idle.png",
    "run": "vampire_run.png",
    "attack": "vampire_attack.png",
    "death": "vampire_death.png",
}


def keyed(path: Path) -> Image.Image:
    """The drawing with its green background keyed out and despilled."""
    img = Image.open(path).convert("RGB")
    if img.width != SOURCE_SIZE:
        # count-dawn-up-1 arrived at 720px; 720/3 is exact, so no grid is lost.
        img = img.resize((SOURCE_SIZE, SOURCE_SIZE), Image.LANCZOS)

    rgb = np.asarray(img).astype(np.float64)
    other = np.maximum(rgb[..., 0], rgb[..., 2])
    greenness = rgb[..., 1] - other
    alpha = 1.0 - np.clip((greenness - GREEN_LO) / (GREEN_HI - GREEN_LO), 0.0, 1.0)

    # Despill, applied ONLY where the pixel is greener than any of Romi's paint
    # ever gets — i.e. only where the background actually bled in. Clamping the
    # green channel everywhere (which is what the bat's script does, safely,
    # because the bat is black) would drain his green robe to charcoal.
    out = rgb.copy()
    spilled = greenness > GREEN_LO
    out[..., 1] = np.where(spilled, np.minimum(rgb[..., 1], other), rgb[..., 1])
    return Image.fromarray(
        np.dstack([np.clip(out, 0, 255), alpha * 255.0]).astype(np.uint8), "RGBA"
    )


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


def build_frame(source: Image.Image, mirror: bool) -> Image.Image:
    cropped = source.crop((CROP_LEFT, CROP_TOP, CROP_LEFT + CROP_SIZE, CROP_TOP + CROP_SIZE))
    frame = downscale(cropped, FRAME_SIZE)
    return frame.transpose(Image.FLIP_LEFT_RIGHT) if mirror else frame


def main() -> None:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    cache: dict[str, Image.Image] = {}

    def source(stem: str) -> Image.Image:
        if stem not in cache:
            cache[stem] = keyed(src / f"{stem}.jpeg")
        return cache[stem]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for action, rows in FRAMES.items():
        columns = max(len(frames) for frames in rows.values())
        sheet = Image.new("RGBA", (FRAME_SIZE * columns, FRAME_SIZE * len(ROW_ORDER)), (0, 0, 0, 0))

        for row, direction in enumerate(ROW_ORDER):
            for column, spec in enumerate(rows[direction]):
                if spec is None:
                    continue
                stem, mirror = spec
                sheet.paste(build_frame(source(stem), mirror), (column * FRAME_SIZE, row * FRAME_SIZE))

        out = OUT_DIR / OUT_NAMES[action]
        sheet.save(out)
        print(f"wrote {out} ({sheet.width}x{sheet.height}, {columns} frames x 4 directions)")


if __name__ == "__main__":
    main()
