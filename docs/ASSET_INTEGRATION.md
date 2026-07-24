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
  audio/         music + sfx (ogg preferred, mp3 fallback)
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

The original main-title theme by **Ouzana** is loaded from `public/assets/audio/`. Gameplay SFX and additional level music are planned.

Load files in `PreloadScene` under the `AUDIO` keys:

```ts
this.load.audio(AUDIO.playerAttack, 'assets/audio/player-attack.ogg');
```

`AudioSystem.play()` is already called at every hook point (attack, hurt, hunter death, pickup, boss appear, final seconds, dawn, victory, defeat) and is a silent no-op for unloaded keys — sounds start working the moment they are loaded.

## Crediting asset creators

For every third-party asset added, record in `README.md` (Credits section): asset name, creator, source URL, and license. Do this in the same commit that adds the asset.
