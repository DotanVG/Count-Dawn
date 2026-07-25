# Asset Integration

How to replace the runtime-generated placeholder shapes with real assets.

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

`BootScene` generates a placeholder texture for each key in `TEXTURES` — **but skips any key that already exists** (see `placeholderTextures.ts`). So to replace a placeholder you only add a `load` call in `PreloadScene` under the same key; nothing else changes. You can replace assets one at a time.

### Replacing the vampire

In `PreloadScene.preload()` (add the method):

```ts
import { TEXTURES } from '../utils/assetKeys';

this.load.spritesheet(TEXTURES.vampire, 'assets/characters/vampire/vampire.png', {
  frameWidth: /* your sheet's frame width */,
  frameHeight: /* your sheet's frame height */,
});
```

Do **not** assume a particular frame size anywhere else — frame dimensions belong to the load call only.

### Replacing hunters and the captain

Same pattern with `TEXTURES.hunter` and `TEXTURES.boss` under `assets/characters/humans/`.

### Castle background / tilemap

- **Static image:** load an image and add it in `GameScene.createArena()` in place of the floor/wall rectangles.
- **Tilemap:** load a Tiled JSON + tileset in `PreloadScene`, build it in `createArena()`, and replace `physics.world.setBounds` with a collision layer if walls become tile-based.

### Held props (weapons, the carried garlic)

Not everything a character carries is a spritesheet. Romi's three hunter
weapons load as plain **images** and are pinned to a hunter's fist every frame
by [`ArmedHunter`](../src/entities/ArmedHunter.ts), which also animates the
swing — because the unarmed pack those hunters wear ships no attack sheet at
all. When adding another prop of that kind:

- put the source drawing through a `tools/build_*.py` script (see
  `build_weapon_props.py`) so the background is keyed to alpha and the output
  lands on the project's 64px frame,
- load it with `this.load.image(...)`, not `spritesheet`,
- give it an origin at its **grip**, not its centre, so rotating it swings the
  weapon rather than spinning it about its middle,
- keep the numbers (scale, reach, cadence) in `balance.ts`; the entity should
  only own where the hand is and how the swing is drawn.

## Registering animations

Animation keys are centralized in `ANIMS` (`assetKeys.ts`). Create them once, after loading, e.g. in `PreloadScene.create()`:

```ts
this.anims.create({
  key: ANIMS.vampireWalk,
  frames: this.anims.generateFrameNumbers(TEXTURES.vampire, { start: 0, end: 5 }),
  frameRate: 10,
  repeat: -1,
});
```

Then play them from the entity (e.g. in `Player.move()` when velocity is non-zero). Keep new animation names in `ANIMS`, not inline strings.

## Physics bodies vs. sprite dimensions

Physics sizing is set explicitly (e.g. `Player` calls `setCircle(20, 4, 4)`), independent of the texture. When a sprite's visual size changes, re-tune the body with `setCircle`/`setSize`/`setOffset` in the entity constructor — do not let gameplay hitboxes silently inherit new art dimensions.

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
