# Pixel Perfect Rendering Experiment

This document records the audit and decisions for `experiment/pixel-perfect-render`.
It is deliberately an experiment, not a recommendation to merge without playtesting the
letterboxing trade-off on the project's real deployment targets.

## Executive summary

The main technical defect was not texture filtering. It was the final CSS scale chosen by
`Phaser.Scale.FIT`. The game rendered to a fixed 1280x720 canvas, then commonly displayed that
canvas at ratios such as 1.5x. Nearest-neighbour sampling keeps edges hard at those ratios, but it
cannot make every source pixel the same size: some source pixels occupy one display column and
others occupy two.

The experiment replaces `FIT` with a small controller built on `Phaser.Scale.NONE` and
`ScaleManager.setZoom`. At or above 1280x720 it chooses only positive integer scales. When a mobile
viewport is smaller than the internal render, no positive integer scale can fit; the controller
uses an exact reciprocal divisor that produces whole CSS dimensions. This is a documented mobile
compromise, not true integer upscaling.

No gameplay, physics, camera zoom, object scale, texture, or art asset was changed.

## Phaser 4 API investigation

The installed dependency is Phaser 4.2.1.

- `pixelArt: true` already disables antialiasing, enables `roundPixels`, and makes texture sources
  use nearest-neighbour filtering. This matches the Phaser
  [Core configuration documentation](https://docs.phaser.io/api-documentation/constant/core).
- Phaser exposes `Phaser.Scale.MAX_ZOOM`, `ScaleManager.setMaxZoom`, and `ScaleManager.setSnap`.
  They are useful primitives, but not a complete policy for this game. In the installed 4.2.1
  source, maximum zoom never goes below 1, so it cannot keep the 1280x720 game usable on a smaller
  mobile viewport. It also must be recomputed after parent changes. `setSnap` snaps display
  dimensions, but does not robustly express “select only an integer multiple of both base
  dimensions” for every aspect-ratio path. See the Phaser
  [Scale Manager API](https://docs.phaser.io/api-documentation/class/scale-scalemanager).
- `FIT` preserves aspect ratio and maximizes coverage, but its purpose is to consume the available
  parent area. It is therefore allowed to produce arbitrary CSS scales. That behavior is correct
  for a general responsive game and incorrect for strict integer upscaling.
- `NONE` leaves the scale policy to the application. `setZoom` still updates the canvas CSS size,
  centering, canvas bounds, and pointer-coordinate transform, so it is cleaner than directly
  mutating canvas styles and recreating Phaser's input math.
- Phaser documents nearest as the correct per-texture filter for pixel art. No project code enables
  `LINEAR` or `smoothPixelArt`; see the Phaser
  [Texture API](https://docs.phaser.io/api-documentation/class/textures-texture).

## Before: rendering audit

| Area | Previous state | Finding |
| --- | --- | --- |
| Internal resolution | 1280x720 | Stable and shared by world, cameras, and HUD. |
| Scale mode | `Phaser.Scale.FIT`, centered both axes | Preserved 16:9 but commonly selected fractional CSS scales. |
| Renderer | `Phaser.AUTO` | WebGL is preferred; Canvas remains a compatibility fallback. Forcing WebGL would reduce compatibility without improving scale selection. |
| Pixel flags | `pixelArt: true`, `roundPixels: true` | Correct. `pixelArt` already implies nearest filtering, no antialiasing, and rounded textured rendering. |
| Camera | Main camera at zoom 1 and scroll 0; no follow/interpolation | The world is exactly one fixed screen. Camera shake is the only movement. Phaser rounds shake offsets when `roundPixels` is enabled. |
| Tilemap | 16px source tiles at exactly 4x | Already ideal. Castle walls, floor, and windows align to the 64px world grid. |
| Resize | Phaser Scale Manager listeners plus explicit refreshes from orientation/fullscreen helpers | Correct for `FIT`, but refresh retained the fractional fit policy. |
| Fullscreen | Fullscreen API targets `#game-root`; refresh on transition and window resize | Structurally correct and retained. The new controller observes the same parent and fullscreen events. |
| Textures | Spritesheets, images, JPEG menu art, generated particle texture | No linear filter opt-in was found. Phaser creates their texture sources with nearest filtering because `pixelArt` disables antialiasing. |
| Runtime textures | 8x8 particle texture and missing-asset fallback generated with `Graphics.generateTexture` | Created after the renderer config is active, so they inherit nearest filtering as well. |
| UI | HUD is in the game scene at fixed screen coordinates; touch controls use scroll factor 0; HTML fullscreen/orientation layers sit outside the canvas | A second camera would not avoid final canvas scaling and would add object-ignore bookkeeping. The current single fixed camera also intentionally lets shake affect the HUD. |
| Render pipeline | Phaser 4 WebGL render nodes through `AUTO`; no custom pipeline, shader, bloom, or blur | Additive blend modes and Graphics effects are present, but there is no post-processing blur to remove. The optional red-blind mode is one CSS color transform, not a smoothing filter. |

### Why players could reasonably say it was not pixel perfect

1. **Fractional final-canvas scaling.** A measured 1918x1078 browser viewport displayed the
   1280x720 canvas at approximately 1917.15x1078.4 (about 1.498x). This was the largest global
   source of uneven pixels.
2. **Fractional sprite scales.** Nearest filtering makes them sharp, but not uniformly pixel-sized.
   The Count is 2.3x, normal humans are 1.6x, and the gameplay bat is 0.69x.
3. **Animated fractional scales and rotations.** Garlic lobs, weapon swings, spinning crosses,
   particles, afterimages, sun/star fades, UI pulses, blood decals, and Ultimate effects animate
   through non-integer transforms. Rotation cannot keep an axis-aligned pixel grid by definition.
4. **Vector and text content.** HUD text uses browser-rasterized Trebuchet, while sky bodies,
   lightning, targeting rings, bars, and many particles use Phaser Graphics. `roundPixels` applies
   to texture-based Game Objects, not every Graphics vertex. These elements can be crisp without
   looking like a single-resolution pixel font or sprite sheet.
5. **Source-art constraints.** Most gameplay sprites are genuine 64px pixel sheets, but the menu
   covers and original source pipeline include JPEG assets. Nearest filtering cannot undo JPEG
   artifacts or turn antialiased source pixels into authored pixel clusters.
6. **Small viewports and browser composition.** A 1280x720 render physically cannot fit a smaller
   CSS viewport at a positive integer scale. Browser zoom, device-pixel ratio, accessibility zoom,
   and OS composition can also affect the final physical-pixel mapping outside Phaser's control.

## Implemented scale policy

`selectPixelScale` chooses the largest scale that fits the parent:

- At or above the internal size: `floor(min(parentWidth / 1280, parentHeight / 720))`.
- Below the internal size: the largest reciprocal divisor that divides both internal dimensions,
  producing whole CSS width and height (normally 1/2 on landscape phones).
- The canvas remains centered, with the existing night-sky background providing letterboxing.
- A `ResizeObserver` plus resize, orientation, and fullscreen listeners recompute the policy only
  when the parent changes. It does not run per frame.
- Phaser's own `setZoom` and `refresh` continue to own pointer-coordinate conversion.
- Canvas data attributes expose the active decision for debugging:
  `data-pixel-scale`, `data-pixel-scale-mode`, and (when applicable)
  `data-pixel-downscale-divisor`.

### Measured comparison

| Viewport | Before (`FIT`) | After | Result |
| --- | --- | --- | --- |
| 1918x1078 | ~1917.15x1078.4, ~1.498x | 1280x720 at 1x, centered at (318, 179) | Uniform 1x source pixels; substantial letterboxing. |
| 2560x1440 | 2560x1440 at 2x | 2560x1440 at 2x | Same full-screen coverage; explicitly verified as the 2x path. |
| 844x390 | ~693.33x390 at ~0.542x | 640x360 at exactly 1/2, centered at (102, 15) | Regular 2-to-1 downsample; slightly more letterboxing. |
| 568x320 | ~568x319.5 at ~0.444x | 320x180 at exactly 1/4 | Much smaller but regular downsample; this is the harshest usability trade-off. |

## Sprite scale audit and decision

Sprite scales were intentionally left unchanged. An integer texture scale would be cleaner, but
there is no equivalent integer for the current authored proportions. Changing these values would
change apparent reach/readability and, for Arcade sprites, risks changing the visual relationship
to carefully tuned bodies and hitboxes.

| Object/effect | Current render scale | Decision |
| --- | ---: | --- |
| Player | 2.3 | Keep. 2x is about 13% smaller; 3x is about 30% larger. Neither preserves the Count's intended dominance. |
| Hunters / armed hunters / garlic throwers | 1.6 | Keep. 1x is far too small and 2x is 25% larger. |
| Captain | 2.25 | Keep. It is intentionally between regular humans and the Count. |
| Priest | 2.05 | Keep. Integer alternatives materially change boss size. |
| Gameplay bat / Bat Dash / Ultimate swarm | 0.69 (`2.3 * 0.3`) | Keep. The same shared constant correctly prevents dash and swarm bats drifting apart. 1x would be ~45% larger. |
| Thrown garlic | 0.2 to 0.3 during the lob | Keep. The base 0.2 is already an exact 1/5 downscale of 192px art; the animated bulge is intentional. |
| Held garlic | 0.12 | Keep. Re-authoring a dedicated small held texture is the technically correct future fix; changing scale alone is not. |
| Thrown gold cross | 0.5 | Keep. It is already an exact reciprocal scale. Rotation necessarily leaves the axis-aligned grid. |
| Spike / pitchfork / torch | hunter scale multiplied by 0.34 / 0.63 / 0.4 | Keep. These values encode different weapon lengths and grip geometry; rounding them changes combat readability. |
| Blood drops | 0.36 | Keep. It compensates for a 45px painted droplet inside a 64px frame. |
| Coffin | 0.55 | Keep. Its static body is manually aligned to the current visual scale. |
| Castle torches | 1.6 | Keep. Changing them alone would mismatch the authored wall layout. |

A future art pass could bake dedicated 1x display-resolution sheets for the Count, humans, bat,
held props, and HUD icons. That would preserve apparent sizes without runtime fractional transforms,
but it requires art review and asset-specific hitbox validation; it is not a safe rendering-setting
experiment.

## Camera and pixel-camera review

- There is no camera follow, pan, interpolation, or runtime zoom to fix.
- The camera remains at zoom 1 with a 1280x720 viewport and scroll origin 0,0.
- Physics objects move at floating-point world coordinates, but `roundPixels` rounds textured
  rendering without snapping their physics state. Snapping the actual positions would introduce
  movement judder and change collisions, so it was correctly avoided.
- Phaser 4.2.1 rounds camera-shake offsets when the camera has `roundPixels` enabled. Custom shake
  rounding would duplicate existing behavior.
- Graphics-based lightning and rings intentionally use floating-point geometry. Quantizing their
  simulation would visibly change their shape without fixing final canvas scale.

## Texture and effect review

- Player, enemies, bosses, castle tiles, torches, windows, weapons, blood, bat, and afterimage
  textures all pass through the global nearest-filter configuration.
- The sky is drawn with Graphics and color steps. It does not sample a linearly filtered texture.
- Particles use the generated 8x8 hard-edged dot with nearest filtering. Their animated fractional
  scale is part of their fade, not evidence of a linear texture filter.
- Ultimate lightning, ward rings, target markers, flashes, and most glows are Graphics primitives or
  additive blends. No blur/bloom shader or post-processing pass exists.
- The Bat Dash afterimages copy the active texture, frame, flip, and scale. They do not introduce a
  separate filtering path.
- The large screen blood decals are nearest-filtered textures, but their arbitrary rotation and
  randomized scale intentionally trade grid alignment for organic variation.

No texture-filter code was added because `pixelArt: true` already enforces the correct setting for
loaded and generated textures. Adding a second blanket `setFilter(NEAREST)` loop would be redundant
and could silently override a future texture that intentionally opts into another filter.

## UI separation decision

The HUD remains in the game scene. Because the game world never scrolls and the camera stays at zoom
1, it already renders in the same stable 1280x720 coordinate space as a dedicated HUD camera would.
A second camera would still be composited into the same fractionally or integrally scaled canvas, so
it cannot fix final display sharpness. It would also require maintaining ignore lists for every world,
HUD, screen-flash, and menu object, and would change the intentional whole-screen shake behavior.

The fullscreen button, vampire cursor, audio editor, and rotate overlay remain DOM UI and naturally
render at browser resolution. Keeping those independent is preferable.

## Performance impact

- The internal render remains 1280x720, so renderer fill rate and scene complexity are unchanged.
- No shader, framebuffer, filter pass, bloom, blur, or additional camera was added.
- Scale computation runs only after resize/orientation/fullscreen/parent-size changes.
- Integer letterboxing can reduce browser compositing work compared with stretching to fill a larger
  non-integer area; the effect is small and not relied upon.

## Known limitations and drawbacks

1. 1920x1080 and similar displays now show the game at 1280x720 with large letterboxing instead of
   filling the screen at 1.5x. This is the necessary visual trade-off for strict integer upscaling.
2. Below 1280x720, true positive-integer scaling is mathematically impossible. Exact reciprocal
   downscaling keeps a regular sampling cadence and whole CSS dimensions, but discards detail and is
   not the same as integer upscaling.
3. Very small landscape viewports can step from 1/2 to 1/4, making the game substantially smaller.
   This needs real-device playtesting before any production decision.
4. Browser zoom, device-pixel ratio, accessibility scaling, iframe transforms, and OS compositor
   behavior are outside Phaser's canvas-scale contract. The controller guarantees the CSS canvas
   dimensions and Phaser zoom decision, not every final physical panel pixel.
5. Fractionally scaled/rotated sprites, anti-aliased text, Graphics primitives, JPEG-derived art,
   and animated effects remain. Fixing those completely requires an authored asset/UI pass, not a
   safe renderer-setting change.
