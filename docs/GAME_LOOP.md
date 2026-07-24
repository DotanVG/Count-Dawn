# Game Loop

## Core loop

1. The night starts: the vampire wakes next to his coffin, the sunrise countdown begins (120s, or 30s with `FAST_DEV_MODE`).
2. Human hunters spawn at random arena-edge positions every ~1.25s (max 18 alive) and walk straight at the player.
3. The player kites and kills hunters with a mouse-aimed melee arc.
4. Each dead hunter drops a blood pickup worth 10 blood; the Blood Meter targets 100.
5. With 30 seconds remaining, the **Hunter Captain** spawns at the arena edge farthest from the player.
6. When the Blood Meter is full **and** the Captain is dead, the coffin activates (pulsing glow).
7. Enter the active coffin before the timer reaches zero.

## Victory condition

Overlap the **activated** coffin before dawn. Both requirements must be met first:

- Blood Meter full (100 blood)
- Hunter Captain defeated

## Defeat conditions

- **Dawn** — the countdown reaches zero outside the coffin.
- **Death** — player health reaches zero.

Either way the end screen shows the cause, blood collected, and time survived, with instant restart (**R** or button).

## Boss timing

`NIGHT.bossSpawnAtRemainingSeconds` in `src/data/balance.ts` (30s before sunrise; 20s in dev mode). The spawn request is emitted exactly once by `CountdownSystem`; `GameScene` guards against double-spawn.

## Blood system

- `HUNTER.bloodDrop` (10) per regular hunter; the boss drops nothing.
- Pickups persist until collected and never expire.
- `GameFlowSystem` owns the meter, coffin activation, and the single end-of-run transition.

## Out of scope (for this prototype)

Procedural maps, multiple levels/nights, permanent progression, upgrades, inventory, dialogue, cutscenes, advanced enemy AI or pathfinding, multiple enemy types beyond hunter + boss, boss phases, dash, touch controls, audio content, real art.

Extension points exist for: touch input (`InputController`), audio (`AudioSystem` + keys in `assetKeys.ts`), real sprites (`docs/ASSET_INTEGRATION.md`).
