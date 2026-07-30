# Visual polish architecture

The gameplay presentation layer is owned by
`src/systems/PresentationSystem.ts`. `GameScene` reports resolved gameplay
events to it; the system never decides damage, rewards, spawning, or round
progression.

Presentation tuning and quality profiles live in `src/data/polish.ts`.
This keeps camera, hit-stop, particle, atmosphere, mobile, and reduced-motion
values out of entity and scene code.

## Quality profiles

The default is `high`. A profiling override can be supplied in the URL:

- `?polish=high`
- `?polish=reduced`
- `?polish=minimal`

Touch-first devices automatically reduce particle and bat counts, cap
simultaneous lightning bolts, disable ambient dust, and avoid WebGL filters
and hit stop. The operating system's `prefers-reduced-motion` preference
reduces flashes, zoom, camera shake, HUD repetition, and particle counts while
keeping static color and meter feedback.

## Ultimate rules

Wrath activation state is isolated in `src/systems/ultimateState.ts`.
Activation consumes a full meter exactly once and cannot be queued while a
sequence is active. Blood earned during the presentation is retained; if it
refills Wrath, the ready prompt remains suppressed until the active sequence
finishes and a fresh input is required.

`POLISH.ultimate.killsBosses` is `true`. This preserves the existing Count Dawn
rule that Wrath kills every living enemy currently in the hall, including
Captains and Priests. Every strike still uses `GameScene.onHunterKilled`, so
corpses, blood, statistics, boss health bars, boss progression, and coffin
activation use the canonical death path. A single-fire identity gate prevents
duplicate callbacks.

`POLISH.ultimate.activationInvulnerability` is `false`. The player is not
input-locked or made invulnerable during anticipation because the existing
ability did neither; changing that would alter combat rules and balance.

## Phaser filter policy

The installed Phaser 4.2 renderer exposes WebGL Filters (the Phaser 4 name for
the former FX API), including Glow, Color Matrix, Blur, Pixelate, Shadow, and
Vignette. A short internal Glow is used on the player during Wrath anticipation
only on high-quality desktop WebGL.

Persistent full-screen Bloom and Blur are intentionally not used. Phaser 4.2
does not expose the requested Bloom or Shine helper APIs used by older Phaser
examples, and full-screen filter stacks would add cost without improving
combat readability. Overlays, additive geometry, pooled particles, and tweens
provide the fallback presentation in Canvas, mobile, reduced, and minimal
profiles.

## Audio

Existing AudioDirector cues remain connected to attacks, player damage, enemy
deaths, blood collection, bats, bosses, the final countdown, dawn, victory,
and defeat. There is no dedicated Ultimate-ready or lightning-strike asset in
the repository, so no unrelated sound was repurposed.

TODO: add dedicated Ultimate-ready, activation, and lightning-strike cues if
authored audio assets are supplied in a future pass.

## Lifecycle

Scene shutdown cancels the active Wrath wave, delayed presentation callbacks,
chain-lightning playback, tracked bat visuals, hit stop, camera zoom/shake,
particles, filter controllers, input listeners, and HUD pulse timers. Pause
uses the existing scene clock, so temporary effects freeze and resume with
gameplay rather than continuing behind the overlay.
