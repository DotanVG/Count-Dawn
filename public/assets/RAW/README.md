# RAW source art

Romi's original drawings, exactly as she delivered them — the inputs the
`tools/build_*.py` scripts turn into the assets the game actually loads.

**Nothing in here is loaded at runtime.** It ships with the build because it is
small (well under a megabyte all in) and because a hand-drawn game should carry
its own sources: if something ever needs rebuilding, retiming, recropping or
re-keying, the material is right here rather than in somebody's Downloads
folder.

| Folder | Built by | Into |
| ------ | -------- | ---- |
| `bat/` | `tools/build_bat_sheet.py` | `characters/bat/bat_fly.png` |
| `cover/` | — (used as delivered) | `ui/cover/*.jpeg` |
| `props/` | — (keyed by hand) | `environment/props/*.png` |

Each build script takes its folder as the only argument, e.g.:

```bash
python tools/build_bat_sheet.py public/assets/RAW/bat
```

The scripts are idempotent — running one again over the same sources rewrites
the identical output.

## The cover art

Four files, and the difference between them is only the title:

- **`Count Dawn - Cover art with Credits.jpeg`** — COUNT **DAWN**. The game's
  real name, and what the main menu rests on.
- **`… title variant with o - COUNT DOWN.jpeg`** — COUNT **DOWN**, the jam
  theme the title is a pun on. The menu flashes to this and back.
- **`… title variant with missing AorO - COUNT D_WN.jpeg`** — the letter
  physically absent. The menu never rests here; it is the frame the lightning
  strikes *through*, so a swap reads as one letter being knocked out and
  another landing (see `src/ui/MenuLightning.ts`).
- **`COUNT_DAWN_COVER_ART_ITCH_RATIO.jpeg`** — the 630x500 export used for the
  itch.io store page. Not loaded by the game.
