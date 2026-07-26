# RAW source art

Romi's original drawings, exactly as she delivered them — the inputs the
`tools/build_*.py` scripts turn into the spritesheets the game actually loads.

**Nothing in here is loaded at runtime.** It ships with the build because it is
small (a few hundred KB all in) and because a hand-drawn game should carry its
own sources: if a sheet ever needs rebuilding, retiming, recropping or
re-keying, the material is right here rather than in somebody's Downloads
folder.

| Folder | Built by | Into |
| ------ | -------- | ---- |
| `priest/` | `tools/build_priest_sheet.py` | `characters/humans/priest.png` |

Each script takes the folder as its only argument, e.g.:

```bash
python tools/build_priest_sheet.py public/assets/RAW/priest
```

The scripts are idempotent — running one again over the same sources rewrites
the identical sheet.
