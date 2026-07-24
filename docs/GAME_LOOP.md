# Game Loop

## Core loop

1. From the menu (the castle hall itself), START makes the vampire fly in through the center window; the sunrise countdown begins (60s, or 25s with `FAST_DEV_MODE`).
2. Human hunters spawn at random arena-edge positions and pursue the player. Night 1 starts at ~1.25s between spawns with max 18 alive; later nights spawn faster and allow more hunters.
3. The player kites and kills hunters with a mouse-aimed melee arc.
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

Either way the end screen shows the cause, blood collected, and time survived, with instant restart (**R** or button).

## Boss entrance

`GameFlowSystem` emits one boss-spawn request when collected blood first reaches the current round's target. `CountdownSystem` only owns dawn, timer ticks, and the final warning; it has no Captain timing logic.

## Blood system

- `HUNTER.bloodDroplets` (5) per regular hunter, each worth `BLOOD.dropletValue` (1); the boss drops nothing.
- Pickups persist until collected and never expire.
- `GameFlowSystem` owns the meter, coffin activation, and the single end-of-run transition.
- `bloodTargetForNight()` raises the requirement by `BLOOD.targetIncreasePerNight` each round.

## Round pressure

`hunterPressureForNight()` increases `maxAlive` by 2 and reduces the spawn interval by 75ms each new night, down to a 650ms floor. All values remain tunable in `src/data/balance.ts`.

## Out of scope (for this prototype)

Procedural maps, multiple levels, permanent progression, upgrades, inventory, dialogue, cutscenes, advanced enemy AI or full pathfinding, multiple enemy types beyond hunter + boss, boss phases, and dash.

Extension points exist for: touch input (`InputController`), audio (`AudioSystem` + keys in `assetKeys.ts`), real sprites (`docs/ASSET_INTEGRATION.md`).
