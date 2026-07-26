# Game Loop

## Core loop

1. From the menu (the castle hall itself), START makes the vampire fly in through the center window; the sunrise countdown begins (60s, or 25s with `FAST_DEV_MODE`).
2. Human hunters spawn at random arena-edge positions and pursue the player. Night 1 starts at ~1.25s between spawns with max 18 alive; later nights spawn faster and allow more hunters.
3. The player kites and kills hunters with a mouse-aimed melee arc, and escapes crowds with the bat dash (see below).
4. Each dead hunter drops five bloodlets worth 1 blood each. Night 1 targets 50 blood; each later night requires 15 more.
5. The instant the player fills that round's Blood Meter, that night's **boss lineup** spawns at the arena edges farthest from the player. Boss entrance never depends on remaining time.
6. When the Blood Meter is full **and** every boss is dead, the coffin activates (pulsing glow).
7. Enter the active coffin before the timer reaches zero.

## Victory condition

Overlap the **activated** coffin before dawn. Both requirements must be met first:

- Blood Meter full (50 on Night 1, +15 per later night)
- Every boss in the night's lineup defeated

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

Who answers that request is `bossLineupForNight` (`data/balance.ts`). Ordinary nights send Hunter Captains, one more every fifth night, each with an even chance of carrying garlic instead of a sword. **Every fifth night sends the Priest instead**: he takes both the step up the night was going to make and the slot it would have added, so night 5 is the Priest alone where two Captains would have stood, night 10 is the Priest plus one Captain, night 15 the Priest plus two. The lineup never exceeds the Captain count it replaces — a Priest night is a new fight, not a bigger one.

### The Priest's ward

Every `PRIEST.wardIntervalMs` the Priest plants his feet, raises the cross and paints the full circle of the ward gold on the floor around himself. After `wardWindupMs` the light sweeps outward to `wardRadius`, burning the Count for `wardDamage` the moment the expanding edge passes him — once per ward, so standing inside the circle after it has gone by is safe.

Only the leading ring is the attack. `wardRipples` more follow it in paler golds, each launched `wardRippleDelayMs` after the last, and a golden cross grows out of the circle to `crossOvershoot` of its radius trailing sparks, holding `crossLingerMs` after the rings have gone. None of that has a hitbox; it exists so the ward lands like something dropped in water and leaves the shape of what burned him as the last thing on screen.

Two answers: walk out of the circle while it is still being painted, or dash through the edge (the dash's own invulnerability window carries him clean, exactly as it does through a garlic bulb). Damage is **not** an answer — see below.

### Boss telegraphs, and committed attacks

Every boss wears the same tell before it commits, drawn by `BossCharge`: a ring that closes inward onto its body and brightens as the wind-up runs out, colour-coded per threat — gold for the Priest's ward, red for a Hunter Captain's swing, green for a garlic Captain's volley.

From the moment that ring appears the attack is **committed** (`Hunter.isCommitted`). Hitting the boss still shoves it, and the Priest's whole ward slides with him because every part of it is anchored on his body, but nothing cancels. A regular hunter is the opposite: a landed strike knocks him back, flinches him and drops the swing he was winding up.

That split is the point. Against hunters, damage is crowd control; against bosses it never is, so the telegraph has to be loud enough that footwork can be the answer instead.

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

## End of a run

Dawn and death are the only ways a run truly ends, and both show the same
debrief (`src/ui/RunDebrief.ts`): nights survived, total blood drained across
the whole run, and breakdowns of hunters drained and mini-bosses slain, each
line with an animated icon of the thing it counts.

Those totals live in `RunStats`, held by `GameScene` and reset only in
`create()` — surviving a night adds to them rather than clearing them, which is
what makes "blood collected since the very beginning" mean what it says.

**Reaching the end screen never depends on an animation finishing.** The dawn
ending listens for the sunburn's `ANIMATION_COMPLETE` but also arms a fallback
timer, and whichever fires first wins. An earlier version relied on the event
alone, and a death landing inside a dash let the dash's queued shape-restore
play over the sunburn — the animation never completed, the event never fired,
and the run hung with the music still going.

## Out of scope

Procedural maps, multiple levels, permanent progression, upgrades, inventory,
full pathfinding, and boss phases.
