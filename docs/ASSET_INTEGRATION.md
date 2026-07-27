# Asset Integration

How art gets into Count Dawn: the pipeline that turns Romi's drawings into the
sheets the game loads, and the rules for adding anything new.

## The shipped pipeline

Every hand-drawn asset in the game is built offline from a source drawing that
ships beside it under [`public/assets/RAW/`](../public/assets/RAW/README.md).
Nothing in `RAW/` is loaded at runtime; it is there so no sheet is ever orphaned
from the art it came from.

| Source | Script | Output |
| --- | --- | --- |
| `RAW/count/` | `tools/build_count_sheets.py` | `characters/vampire/vampire_{idle,run,bite,attack,death}.png` |
| `RAW/{pilgrim,huntress,farmer}/` | `tools/build_hunter_sheets.py` | `characters/humans/{pilgrim,huntress,farmer}.png` |
| `RAW/priest/` | `tools/build_priest_sheet.py` | `characters/humans/priest.png` |
| `RAW/weapons/` (black key) | `tools/build_weapon_props.py` | `environment/weapons/{wooden_spike,pitchfork,torch_*}.png` |
| `RAW/weapons/gold-cross.jpeg`, `RAW/blood/` (green key) | `tools/build_green_props.py` | `environment/weapons/gold_cross.png`, `environment/blood/*.png` |
| `RAW/bat/` | `tools/build_bat_sheet.py` | `characters/bat/bat_fly.png` |

Each takes its folder as the only argument and is idempotent. The mapping from
loose drawings to animation frames — which pose stands in for what, and why — is
written out at the top of each script; `build_count_sheets.py` is the one worth
reading first, because the Count had the least art to work with.

Two decisions that generalise:

- **Register on a landmark, not a bounding box.** The Priest's stake swings
  clear across his frame between poses, so a bbox crop slid him around the floor
  while he walked. His crops are registered on his boots. The bat's are
  registered on its eyes so only the wings move.
- **Facing is a contract, not a guess.** Romi draws side views facing RIGHT, so
  LEFT is the mirrored row. Getting this backwards looks fine standing still and
  is only obvious once you hold a direction key and watch the character run away
  from the way it faces.

## Ground rules

- **Check the license before adding any asset.** Only include assets whose license permits use in this game, and record the required attribution below.
- **No AI-generated art or audio.** Do not add it, ever.
- Keep all asset files under `public/assets/`.
- Register every key in [`src/utils/assetKeys.ts`](../src/utils/assetKeys.ts) — gameplay code only refers to keys, never paths.

## Expected folders

```
public/assets/
  characters/
    vampire/     player spritesheets
    humans/      hunter + captain spritesheets
  environment/
    castle/      tilemap / background images
  ui/            HUD frames, icons
  audio/music/   music tracks (ogg first, mp3 fallback, same key)
  audio/sfx/     sound effects (same pairing)
```

## How placeholder replacement works

`PreloadScene.create()` generates a placeholder texture for each key in
`TEXTURES` — **but skips any key that already exists** (see
`placeholderTextures.ts`). So to replace a placeholder you only add a `load`
call in `PreloadScene` under the same key; nothing else changes, and assets can
be replaced one at a time.

The particle dot is the last placeholder still in use. The blood droplet's
generator is still there but is dead code in practice: Romi's droplet loads over
that key, and the generated one only survives as a fallback if the blood assets
ever go missing.

### Adding a spritesheet

```ts
import { TEXTURES } from '../utils/assetKeys';

this.load.spritesheet(TEXTURES.someone, 'assets/characters/someone.png', {
  frameWidth: 64,
  frameHeight: 64,
});
```

Do **not** assume a particular frame size anywhere else — frame dimensions
belong to the load call only.

### Chroma-keying hand-drawn art

Romi's art arrives as JPEGs on a chroma background, and every `tools/build_*.py`
script keys it out the same way: an alpha ramp over "greenness"
(`g - max(r, b)`), plus a despill that clamps the green channel where the
background bled into an edge.

**Measure the ramp against the actual drawing before picking its thresholds**,
with a greenness histogram over every frame. The bat could use a tight ramp
because the bat is black. The Count could not: his robe is dark green, sitting
at 10-30 greenness, and the bat's thresholds dissolved it and then drained what
survived to charcoal. His script keys in the empty gap between where the paint
stops (~59) and where the background starts (~230), and despills **only** the
pixels greener than any of the paint ever gets.

The rule that matters: keying may change transparency; it may never change a
colour the artist chose.

### Castle background / tilemap

- **Static image:** load an image and add it in `GameScene.createArena()` in place of the floor/wall rectangles.
- **Tilemap:** load a Tiled JSON + tileset in `PreloadScene`, build it in `createArena()`, and replace `physics.world.setBounds` with a collision layer if walls become tile-based.

### Held props (weapons, the carried garlic)

Not everything a character carries is a spritesheet. Romi's three hunter
weapons load as plain **images** and are pinned to a hunter's fist every frame
by [`ArmedHunter`](../src/entities/ArmedHunter.ts), which also animates the
swing — because none of her characters has an attack sheet at all. When adding
another prop of that kind:

- put the source drawing through a `tools/build_*.py` script (see
  `build_weapon_props.py`) so the background is keyed to alpha and the output
  lands on the project's 64px frame,
- load it with `this.load.image(...)`, not `spritesheet`,
- give it an origin at its **grip**, not its centre, so rotating it swings the
  weapon rather than spinning it about its middle,
- keep the numbers (scale, reach, cadence) in `balance.ts`; the entity should
  only own where the hand is and how the swing is drawn,
- put WHERE the hand is on the character, not the direction: `HunterLook.handY`
  exists because Romi draws the huntress carrying her arms about five texture
  rows lower than the pilgrim, and a weapon has to hang off the hand that is
  actually painted rather than off an average of everybody's.

### Characters with only a couple of frames

Every human in the game is two frames per direction, full stop — pilgrim,
huntress, farmer and Priest alike — and every animation the `Hunter` base class
asks for is built from that same pair at a different rate and frame order. See
`TWO_FRAME_ACTIONS` and `registerTwoFrame` in
[`animations.ts`](../src/utils/animations.ts). Follow that shape for anything new
rather than padding a sheet out with duplicates: it keeps the fact that there are
two poses visible in one place instead of hidden inside a sheet.

There is no body attack animation anywhere in that set, which is why a Captain's
wind-up tell hangs off `playSwing` rather than off `ANIMATION_START`, and why a
corpse falls by tween instead of by animation. Two frames cannot sell falling
over; rotating them can.

Hand-drawn characters also rarely sit in the frame the way a bought pack did.
Where the old CraftPix men filled rows 22-43 of the 64px frame, Romi's hunters
run 17-48 and the Priest almost the whole height. Four things are measured off
that geometry and have to move together whenever it changes:

1. `spriteScale` (a LOWER number than the pack used, for sprites that render
   bigger),
2. the physics circle — size it to keep the same ON-SCREEN radius, because the
   hitbox is how often a hunter's body touches the Count and that should not
   change just because the art did,
3. `visibleTopY`, or health bars float,
4. `ArmedHunter`'s `CARRY` offsets, or the weapons stop landing in the hands.

`tools/build_hunter_sheets.py` documents the one time this was deliberately
traded the other way: the hunters were first built into the exact rows the bought
pack filled, so that nothing else had to move at all — and it threw away so much
of the drawing that the huntress had no face. Fidelity won; the four numbers were
re-tuned.

## Registering animations

Animation keys are centralized in `ANIMS` (`assetKeys.ts`). Create them once, after loading, e.g. in `PreloadScene.create()`:

```ts
this.anims.create({
  key: ANIMS.torch,
  frames: this.anims.generateFrameNumbers(TEXTURES.fire, { start: 0, end: 5 }),
  frameRate: 10,
  repeat: -1,
});
```

Directional character animations do not go in `ANIMS` — they are generated per
character/action/direction by `animKey()` and registered in bulk by
`createCharacterAnimations()`. `ANIMS` is for the one-off, non-directional ones
(the torch flame, the bat flap, the magic bursts). Either way, keep names out of
inline strings.

## Physics bodies vs. sprite dimensions

Physics sizing is set explicitly (e.g. `Player` calls `setCircle(15, 16, 23)`), independent of the texture. When a sprite's visual size changes, re-tune the body with `setCircle`/`setSize`/`setOffset` in the entity constructor — do not let gameplay hitboxes silently inherit new art dimensions.

## Audio

Audio has its own guide: **[docs/AUDIO.md](AUDIO.md)** — source WAV workflow, OGG/MP3 encoding, the music state flow and the in-game balance editor. The short version:

Sounds are not loaded by hand. Add a key to `AUDIO` in `assetKeys.ts`, then one entry to `AUDIO_MANIFEST` in [`src/data/audioManifest.ts`](../src/data/audioManifest.ts):

```ts
{
  key: AUDIO.playerHurt,
  label: 'Player Hurt',
  group: 'sfx',
  files: ['assets/audio/sfx/player-hurt.ogg', 'assets/audio/sfx/player-hurt.mp3'],
  defaultVolume: 0.8,
}
```

`PreloadScene` loads every manifest entry that has files, and the audio balance editor lists every entry whether it has files or not. `AudioDirector.playSfx()` is already called at every hook point (attack, hurt, hunter death, pickup, boss appear, final seconds, dawn, victory, defeat) and is a silent no-op for unloaded keys — sounds start working the moment a file is added to the manifest.

Never commit a WAV master, and never put one under `public/`.

## Crediting asset creators

For every third-party asset added, record in `README.md` (Credits section): asset name, creator, source URL, and license. Do this in the same commit that adds the asset.
