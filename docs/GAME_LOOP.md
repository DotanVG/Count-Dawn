# Game Loop

## Core loop

1. From the menu (the castle hall itself), START plays the opening demonstration once, then the vampire rises from the coffin and the sunrise countdown begins (60s, or 25s with `FAST_DEV_MODE`). The opening can be paused or skipped by holding Space/the mobile skip control for two seconds.
2. Human hunters enter from the left, right and lower walls and pursue the player. The upper window wall is never a gameplay spawn route. Night 1 starts at ~1.25s between spawns with max 18 alive; later nights spawn faster and allow more hunters.
3. The player kites and kills hunters with a mouse-aimed melee arc, and escapes crowds with the bat dash (see below).
4. Each dead hunter drops five bloodlets worth 1 blood each. Night 1 targets 50 blood; each later night requires 15 more.
5. The instant the player fills that round's Blood Meter, that night's **boss lineup** enters from an allowed side/bottom route farthest from the player. Boss entrance never depends on remaining time.
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

Either way the end screen shows the cause, blood collected, and time survived.
Restart (**R** or button) begins a fresh run through the full opening
cinematic again; its two-second hold-to-skip remains available.

### Final countdown presentation

The countdown remains visible in the centre window for the whole playable
night. Its entrance fade and per-tick scale pulse are separate tweens so a
tick can never cancel the timer's visibility. At ten seconds the HUD enters
panic mode. Screen flashes land at 10, 5, 3, 2 and 1; 2 and 1 also get a
half-second follow-up. Each of the final five whole-second beats briefly grows
the timer to twice its normal size before it settles back.

## Boss entrance

`GameFlowSystem` emits one boss-spawn request when collected blood first reaches the current round's target. `CountdownSystem` only owns dawn, timer ticks, and the final warning; it has no Captain timing logic.

Who answers that request is `bossLineupForNight` (`data/balance.ts`). Ordinary nights send Captains, one more every fifth night. Which of Romi's hunters a Captain is grown from decides how it fights, exactly as her folder names promised: a **farmer** Captain throws garlic with a bulb in each hand, a **huntress** Captain throws gold crosses like shuriken, and anything else is a **pilgrim** Captain swinging the same weapon his men carry. Both ranged flavours are gated on the same alive-thrower cap the ordinary farmers share, so a night cannot stack ranged pressure past what that cap allows. **Every fifth night sends the Priest instead**: he takes both the step up the night was going to make and the slot it would have added, so night 5 is the Priest alone where two Captains would have stood, night 10 is the Priest plus one Captain, night 15 the Priest plus two. The lineup never exceeds the Captain count it replaces — a Priest night is a new fight, not a bigger one.

### The huntress Captain's crosses

She reuses the garlic thrower's entire state machine — hold a standoff, paint a
crosshair, lock, volley — because the shape of the threat is the same shape.
What differs is the projectile, and the difference matters: a bulb is lobbed at
the point the crosshair locked and splashes there whether or not it hit, so it is
beaten by backing off. A cross is thrown along the line the lock gave her and
keeps going (`GoldCross`), so it is beaten by stepping SIDEWAYS — and
`CROSS.perVolley` of them arrive in a fan, which is what stops standing still
from working.

A cross that leaves the hall is simply gone; nothing resolves where it was aimed.

### The Priest's ward

Every `PRIEST.wardIntervalMs` the Priest plants his feet, raises the cross and paints the full circle of the ward gold on the floor around himself. After `wardWindupMs` the light sweeps outward to `wardRadius`, burning the Count for `wardDamage` the moment the expanding edge passes him — once per ward, so standing inside the circle after it has gone by is safe.

Only the leading ring is the attack. `wardRipples` more follow it in paler golds, each launched `wardRippleDelayMs` after the last, and a golden cross grows out of the circle to `crossOvershoot` of its radius trailing sparks, holding `crossLingerMs` after the rings have gone. None of that has a hitbox; it exists so the ward lands like something dropped in water and leaves the shape of what burned him as the last thing on screen.

Two answers: walk out of the circle while it is still being painted, or dash through the edge (the dash's own invulnerability window carries him clean, exactly as it does through a garlic bulb). Damage is **not** an answer — see below.

### Boss telegraphs, and committed attacks

Every boss wears the same tell before it commits, drawn by `BossCharge`: a ring that closes inward onto its body and brightens as the wind-up runs out, colour-coded per threat — red for a pilgrim Captain's swing, green for a garlic Captain's volley, and gold for both the Priest's ward and the huntress Captain's crosses. The two gold tells are deliberately the same colour: gold means holy in this game, and which of the two is coming is never in doubt, because one is a Priest standing in a painted circle and the other is a huntress at the far end of the hall.

From the moment that ring appears the attack is **committed** (`Hunter.isCommitted`). Hitting the boss still shoves it, and the Priest's whole ward slides with him because every part of it is anchored on his body, but nothing cancels. A regular hunter is the opposite: a landed strike knocks him back, flinches him and drops the swing he was winding up.

That split is the point. Against hunters, damage is crowd control; against bosses it never is, so the telegraph has to be loud enough that footwork can be the answer instead.

## Bat dash

Shift on desktop, the bat button on mobile. The Count *poofs* into a bat and bursts `DASH.speed` units/sec in the direction he is moving (or the direction he is aiming, when standing still) for `DASH.durationMs`. He is invulnerable for slightly longer than the burst itself, so a clean dodge reads as clean.

- It is the escape hatch from a crowd of hunters and the counter to a garlic thrower's lock.
- `DASH.cooldownMs` between dashes, shown as the charge strip under the health bar.
- All values live in `DASH` / `BAT` in `src/data/balance.ts`.

## Blood system

- `HUNTER.bloodDroplets` (5) per regular hunter, each worth `BLOOD.dropletValue` (1). A Captain drops `BOSS.bloodDroplets` (25) and the Priest `PRIEST.bloodDroplets` (30) — a mini-boss only ever dies after the meter is already full (bosses do not spawn before then), so every one of those droplets lands as overflow.
- Pickups persist until collected and never expire.
- Blood collected once the meter is already full is not wasted: the meter stays pinned at its target and the surplus flies on to the health bar, healing `BLOOD.overflowHealPerBlood` HP per unit — unless health is ALSO already full, in which case it fills the Wrath meter instead (see below).
- `GameFlowSystem` owns the meter, coffin activation, and the single end-of-run transition.
- `bloodTargetForNight()` raises the requirement by `BLOOD.targetIncreasePerNight` each round.

## Wrath and the Ultimate

A third meter, `WRATH` in `src/data/balance.ts`, sits between the health and blood bars. It only fills from blood the Count has no other use for, and always at `WRATH.bloodPerPoint` (2) blood spent per point gained — Wrath is meant to take several mini-boss kills to fill, not one:

- **Mid-round overflow while HP is already full** — `GameScene.hopBloodToHealth` normally flies overflow blood to the health bar and heals it; when health is already at `PLAYER.maxHealth` it flies to the Wrath bar instead and calls `gainWrath`.
- **Overnight leftovers** — `GameScene.computeOvernightTransfer` heals HP from that night's whole blood pool (`bloodTargetForNight`) at a real `BLOOD.overnightHealPerBlood` (1) rate — a genuine cost, not an unconditional top-off: if the pool is smaller than the HP actually missing, the Count wakes up still short of full. Whatever the pool has left over after healing keeps draining straight into Wrath in the same continuous transfer animation, not a separate step afterward. The result (`newHealth`, `wrathBlood`) is computed the moment the night's real numbers are known and stashed in `pendingHealthAfterSleep`, which `beginRoundSystems` applies via `Player.resetForNewRound(health)` once the day-cycle animation finishes.

Wrath persists across nights exactly like `RunStats` — reset only in `create()`, never between rounds. Its orbit communicates charge without pretending an empty bar is active: one mote appears per completed 10% step through 90%, then a full meter glows gold with twenty orbiting motes plus small sparkles flickering on the fill. It is spent all at once on the **Ultimate** (`GameScene.fireUltimate`, bound to Space on desktop — the bar itself prompts "WRATH READY — Press SPACE" — and a ⚡ button on mobile that only appears once charged):

1. The Count plays `Player.playSpecialAttackAnim` — the rear-up-and-roar pose Romi drew first, which the bite replaced as the regular attack — alone, for `summonMs` (500ms), so it reads as summoning something rather than the strike itself.
2. A hard screen flash fires as "the lightning arriving," then the hall darkens by `WRATH.screenDarkenAlpha` (~18%) for the rest of the Ultimate's duration — noticeably dimmer, nowhere near the pause menu's near-black.
3. `WRATH.batCount` (30) bats launch out of individual dark purple/black particle bursts and swirl the WHOLE hall — the swirl's x/y amplitudes match the arena's actual half-width/half-height rather than a circle bounded by the shorter dimension — each with a staggered, pitch/volume-varied flap sound (`AUDIO.batDashSound`'s `variance`). Rather than fading in place, each peels off toward one of the three wall windows (`WINDOW_X_CENTERS`, exported from `CastleMap`) and shrinks into it.
4. Together with the bats, lightning bolts strike every living hunter and boss in the hall and kill them outright through the same kill pipeline (`GameScene.onHunterKilled`) a melee kill already uses — corpses, blood, decals and stats all fire normally.

`WRATH.target` (100) is a first estimate derived from the game's own blood-quota curve, not measured run data — tune it once real totals are available.

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
