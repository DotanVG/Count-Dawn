# Game Loop

## Core loop

1. From the menu (the castle hall itself), START makes the vampire fly in through the center window; the sunrise countdown begins (60s, or 25s with `FAST_DEV_MODE`).
2. Human hunters spawn at random arena-edge positions and pursue the player. Night 1 starts at ~1.25s between spawns with max 18 alive; later nights spawn faster and allow more hunters.
3. The player kites and kills hunters with a mouse-aimed melee arc, and escapes crowds with the bat dash (see below).
4. Each dead hunter drops five bloodlets worth 1 blood each. Night 1 targets 50 blood; each later night requires 15 more.
5. The instant the player fills that round's Blood Meter, the **Hunter Captain** spawns at the arena edge farthest from the player. Captain entrance never depends on remaining time.
6. When the Blood Meter is full **and** the Captain is dead, the coffin activates (pulsing glow).
7. Enter the active coffin before the timer reaches zero.

## Victory condition

Overlap the **activated** coffin before dawn. Both requirements must be met first:

- Blood Meter full (50 on Night 1, +15 per later night)
- Hunter Captain defeated

## Defeat conditions

- **Dawn** — the countdown reaches zero outside the coffin.
- **Death** — player health reaches zero.

The two look different, because Romi drew them differently. A death by hunters
plays `vampire-death`: the three-frame fall, and he stays down. Dawn plays
`vampire-sunburn` instead — the same fall, then his burning frames beaten
against each other, then the ash frames, with embers pouring off him the whole
way. Nothing is tinted on top of either; the fire in the dawn ending is the
fire she painted.

Either way the end screen shows the cause, blood collected, and time survived, with instant restart (**R** or button).

## Boss entrance

`GameFlowSystem` emits one boss-spawn request when collected blood first reaches the current round's target. `CountdownSystem` only owns dawn, timer ticks, and the final warning; it has no Captain timing logic.

## Bat dash

Shift on desktop, the bat button on mobile. The Count *poofs* into a bat and bursts `DASH.speed` units/sec in the direction he is moving (or the direction he is aiming, when standing still) for `DASH.durationMs`. He is invulnerable for slightly longer than the burst itself, so a clean dodge reads as clean.

- It is the escape hatch from a crowd of hunters and the counter to a garlic thrower's lock.
- `DASH.cooldownMs` between dashes, shown as the charge strip under the health bar.
- All values live in `DASH` / `BAT` in `src/data/balance.ts`.

## Blood system

- `HUNTER.bloodDroplets` (5) per regular hunter, each worth `BLOOD.dropletValue` (1); the boss drops nothing.
- Pickups persist until collected and never expire.
- Blood collected once the meter is already full is not wasted: the meter stays pinned at its target and the surplus flies on to the health bar, healing `BLOOD.overflowHealPerBlood` HP per unit.
- `GameFlowSystem` owns the meter, coffin activation, and the single end-of-run transition.
- `bloodTargetForNight()` raises the requirement by `BLOOD.targetIncreasePerNight` each round.

## Round pressure

`hunterPressureForNight()` increases `maxAlive` by 2 and reduces the spawn interval by 75ms each new night, down to a 650ms floor. All values remain tunable in `src/data/balance.ts`.

## Out of scope (for this prototype)

Procedural maps, multiple levels, permanent progression, upgrades, inventory, advanced enemy AI or full pathfinding, multiple enemy types beyond hunter + boss, and boss phases.

Extension points exist for: touch input (`InputController`), audio (`AudioDirector` + the manifest in `data/audioManifest.ts` — see `docs/AUDIO.md`), real sprites (`docs/ASSET_INTEGRATION.md`).
