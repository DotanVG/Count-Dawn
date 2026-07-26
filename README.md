# Count Dawn 🧛🌅

A reverse horde survival game for the **"Countdown"** game jam theme.

**Count Dawn** is a vampire who must hunt waves of human hunters, collect enough blood, defeat the Hunter Captain, and return to his coffin before sunrise. The countdown to dawn is always ticking — and always on screen.

- **Repository:** https://github.com/DotanVG/Count-Dawn
- **Production (main):** https://count-dawn.vercel.app
- **Staging (staging branch):** https://count-dawn-git-staging-dotanvgs-projects.vercel.app

> **Asset status:** **the Count is Romi's**, drawn by hand — as are the Priest, the hunter weapons, the coffin, garlic, bat and cover art. The hunters, garlic throwers and Captain use licensed free pixel-art packs from CraftPix (see Credits), as does the castle. Noam composed the original music (Main Title and Level Music) and the gameplay SFX. The blood droplet is still a runtime-generated placeholder. No AI-generated art or audio is used.

## Prototype state

The complete core loop is playable end to end:

- ✅ Castle great-hall built from a 16px dungeon tileset (4x scale): north wall with sky windows, animated torches
- ✅ Living sky behind the windows: night gradient with twinkling stars → pre-dawn purple → sunrise, with a pixel sun that physically rises into the windows
- ✅ The main menu **is** the level: cover art + typewriter tagline over the night hall; START opens the coffin and the Count spirals out across the room to land dead center
- ✅ **Lightning title gag** on the menu: Romi painted the cover three times, differing only in the title. It rests on COUNT **DAWN**, then a storm flash stutters it — through the variant with the letter physically *missing* — onto COUNT **DOWN**, the jam theme the title puns on, and a second strike knocks it back. Both holds are randomised (a long calm on the real title, a short beat on the punchline) and the flash whitens the whole hall, not just the poster
- ✅ Victory reverses the entrance — the Count spirals back into the coffin and his collected blood drains into his health bar with green/red particle streams
- ✅ Hunters drop +1 bloodlets that fly to the blood bar on pickup (red burst on arrival); hunters stop and swing their swords in melee range
- ✅ Mobile support: red virtual joystick, ⚔ auto-strike-nearest button (Space on desktop), tap-to-strike toward the tap, rotate-to-landscape gate, device-aware menus
- ✅ Sunrise countdown (60s for fast playtests) — big timer framed in the center window, tick pops, growing tremble, red panic mode + vignette + camera shakes in the last 10s
- ✅ **The Count is Romi's own drawing** — a hand-painted vampire in place of the bought pack, in all four directions: a two-pose idle that shifts his weight, a six-frame run, a rear-up-and-roar attack throwing a burst of magic down his aim, and two different deaths. A hunter's kill drops him where he stands; the sunrise catches fire, flickers through Romi's burning frames and leaves him as smoking ash before the screen changes
- ✅ Movement decides which way he is drawn; the cursor only decides where a strike goes. Hold D and he runs right with the mouse anywhere, and when he stops he keeps the direction he was travelling instead of snapping to the pointer — he turns into the aim at the moment he swings, and only then
- ✅ Sword-hunter enemies with death animations, all four directions
- ✅ Hunters spawn at arena edges and chase the vampire; every new night raises the blood target, increases the alive cap, and accelerates spawning
- ✅ Mouse-aimed melee arc attack with cooldown pip, hit flash and knockback — landed strikes shove the target back, flinch it, and cancel the swing it was winding up (the Captain resists most of it)
- ✅ Garlic throwers: unarmed hunters who walk in visibly carrying a garlic bulb, hold a standoff, paint a green glowing crosshair that crawls from their feet onto the Count, and lob the bulb at the spot it locks onto — dodgeable by moving or dashing. Capped at one per night number (1 on night 1, 2 on night 2…), so ranged pressure ramps while the rest of the growing spawn budget stays melee
- ✅ Armed hunters (Romi's art): unarmed men carrying a **wooden spike**, a **pitchfork** or a **burning torch**. The base pack has no attack sheet for them, so the prop is pinned to the fist — riding his walk cycle's bob so the join holds still — and the whole attack is animated on it. The spike and fork **stab**: the point comes to bear inside the first quarter of the strike and then holds while he drives it in. The torch **chops** in an arc, trailing embers, and goes on burning and flickering on the floor after its carrier drops it. A weapon buys reach and cadence, never damage: the fork jabs from outside sword range, the spike jabs fast and close. One new weapon joins the hall per night (spike night 1, pitchfork night 2, torch night 3)
- ✅ Flat damage economy: every regular hit — sword, garlic, spike, pitchfork or torch — costs 5 HP; the Hunter Captain hits for 10
- ✅ Bat dash (Shift / 🦇): a short invulnerable burst with after-images and a HUD charge strip — the escape from a crowd and the counter to a lock
- ✅ Bat form (Romi's art): the Count *poofs* into a bat for the dash and for both coffin flights, mirrored to whichever way he is travelling
- ✅ Dead hunters drop blood pickups; Night 1 targets 50 blood, increasing by 15 each new night
- ✅ Filling the round's Blood Meter immediately summons the Hunter Captain: entrance effect, dedicated health bar, heavier contact damage
- ✅ **The Priest** (Romi's art): every fifth night the blood meter summons him instead of the Captains — night 5 is him alone, night 10 him plus a Captain, night 15 him plus two. He carries a wooden stake, and every few seconds he plants his feet and drives out a **ward** of holy light: the full circle is painted gold on the floor first, so you can walk out of it, then the light sweeps out as staggered ripples in three shades while a giant golden cross rises out of the circle trailing sparks and lingers a beat after the rings die
- ✅ Every boss telegraphs, and no boss can be staggered out of its special. A ring closes and brightens on the Priest (gold), the Hunter Captain (red) and the garlic Captain (green) before each one commits; from that moment hitting them shoves them but does not stop the attack, where a regular hunter drops his swing the instant he is hit. The answer to a boss winding up is footwork — walk clear, or dash through the edge in bat form where the dash's own invulnerability carries you
- ✅ Coffin activates only when blood is full **and** the Captain is dead (pulsing glow, hint messages if approached early)
- ✅ Victory / dawn-defeat / death-defeat endings with run stats and instant restart (R)
- ✅ Pause overlay (Esc / P), main menu, fullscreen button
- ✅ Player: invulnerability window + damage flash, world-bounds clamping, frame-rate-independent movement
- ✅ Unit tests for the pure game rules (countdown single-fire guarantees, coffin activation rules, single end-of-run transition)
- ✅ Original main-title music
- ⬜ Gameplay SFX and additional level music
- ⬜ Real blood-pickup art
- ⬜ Summonable bat minions that pull hunter aggro — the sprite is in (see below), the summon is not
- ⬜ Boss phases — intentionally out of scope for now

Full loop details in [docs/GAME_LOOP.md](docs/GAME_LOOP.md).

## Controls

| Action         | Desktop            | Mobile                      |
| -------------- | ------------------ | --------------------------- |
| Move           | WASD / Arrow keys  | Virtual joystick            |
| Aim + Attack   | Mouse + Left click | Tap toward the target       |
| Strike nearest | Space (hold)       | ⚔ button (hold)             |
| Bat dash       | Shift              | 🦇 button                   |
| Pause          | Esc / P            | ⏸ button                    |
| Restart        | R (on end screens) | Tap the button              |

The bat dash is a short invulnerable burst in the direction you are moving (or aiming, when standing still), on a cooldown shown by the charge strip under the health bar. It is how you break out of a crowd and how you dodge a garlic thrower's lock.

Mobile requires landscape; a rotate prompt appears in portrait.

## Tech

Phaser 4 · TypeScript (strict) · Vite · Arcade Physics · ESLint · `node:test` — fully static build, no backend.

## Setup

```bash
npm install
npm run dev
```

Open the printed localhost URL.

## Scripts

| Command             | Purpose                                |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Vite dev server with HMR               |
| `npm run build`     | Typecheck + production build to `dist/`|
| `npm run preview`   | Serve the production build locally     |
| `npm run typecheck` | TypeScript check only                  |
| `npm run lint`      | ESLint over `src/`                     |
| `npm test`          | Unit tests for pure game rules         |

## Folder structure

```
src/
  game/      bootstrap: main, Phaser config, constants, event names, fullscreen
  scenes/    Boot, Preload, MainMenu, Game, Pause, GameOver, Victory
  entities/  Player, Hunter, HunterCaptain, BloodPickup, Coffin
  systems/   Input, Combat, Spawn, Countdown, GameFlow (rules), AudioDirector
  ui/        HUD (timer, health, blood, objective), BossHealthBar
  data/      balance.ts — every tunable number, incl. FAST_DEV_MODE
             audioManifest.ts / audioBalance.ts — every sound and its level
  utils/     assetKeys, runtime placeholder textures
  types/     shared game types
public/assets/  shipped assets; RAW/ holds Romi's source drawings (see its README)
tests/     node:test unit tests for CountdownSystem and GameFlowSystem
docs/      game loop, asset integration, audio, deployment
```

## Dev mode

Set `FAST_DEV_MODE = true` in [src/data/balance.ts](src/data/balance.ts) for a 25-second night. The Captain is always summoned by filling the Blood Meter, never by the timer.

## Branches & deployment

| Branch    | Vercel environment | URL                                                        |
| --------- | ------------------ | ---------------------------------------------------------- |
| `main`    | Production         | https://count-dawn.vercel.app                              |
| `staging` | Preview (Test)     | https://count-dawn-git-staging-dotanvgs-projects.vercel.app |

Every push to **any** branch triggers a Vercel build: `main` deploys to Production, everything else gets a Preview deployment (with `staging` keeping the stable test URL above). `npm run build` produces the static `dist/` that also works for itch.io — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Suggested flow: feature branches → `staging` (playtest on the test URL) → merge to `main` when a build is jam-ready.

## Credits

- **Dotan** — _(role TBD)_
- **Romi** — the Count, the Priest, the hunter weapons, the coffin, garlic and bat art; cover art (three title variants + the itch.io export)
- **Noam** — original music (Main Title, Level Music) and gameplay SFX (attack WOOSH, blood-drinking SLURP)
- **Abed** — _(role TBD)_

### Third-party assets

Character & environment art from [CraftPix](https://craftpix.net) under the [CraftPix file license](https://craftpix.net/file-licenses/) (free packs, game use permitted):

- **Free Vampire 4-Direction Pixel Character Sprite Pack** — the effects-only magic layer from Vampires1's attack sheet, all that remains in use now that the Count is Romi's; it is the burst on a landed strike and the spell he throws as he swings
- **Free Base 4-Direction Male Character Pixel Art** — hunters & Hunter Captain (sword variant, incl. swing attack); garlic throwers (unarmed variant)
- **Free 2D Top-Down Pixel Dungeon Asset Pack** — castle tiles & torch flames

Original art by **Romi**: **the Count himself**, the Priest, the three hunter weapons (wooden spike, pitchfork, burning torch), the cover art, the coffin (closed/half/open), garlic (thrown at the Count by the garlic throwers), and the bat (the Count's dash and coffin-flight form).

Her Count is not a sprite pack — it is a folder of 240x240 JPEGs on chroma green: one pose facing the camera, one with his back turned, one facing left, a six-frame left-facing run, three attack poses and a seven-frame death. `tools/build_count_sheets.py` turns those into the four sheets the game loads, and the mapping is written out in full at the top of that file. The short version: right is left mirrored; the idle is one drawing plus the same drawing a pixel lower; running toward or away from the camera alternates a pose with its own mirror so his legs swap; and the burning and ash frames are split into a separate `sunburn` animation, because they are only true when the thing that killed him was the sunrise.

The one thing that script does differently from the bat's: it barely despills. The Count's **robe is green** — a dark forest green measuring 10-30 greenness, right where a tight chroma key starts dissolving it and where a blanket despill clamps it to charcoal. A greenness histogram over all of Romi's frames shows paint stopping at ~59 and the background starting at ~230, so the key lives in that gap and nothing below it is touched at all.

The Priest arrived as six 240x240 JPEGs on chroma green — two frames each for down, up and the left-facing side view. `tools/build_priest_sheet.py` keys the green out, despills the JPEG fringe, and lays them out as the 2x4 sheet the game loads, mirroring the side pair for the right-facing row. Each direction is registered on his **boots** rather than on its bounding box: his stake swings clear across the frame between the two frames of a pair, so a bbox crop would slide him around the floor while he walks, and his boots barely move. It also silently corrects the back-turned pair, which Romi drew about 11px left of the other four.

The cover exists in three takes that differ only in the title — COUNT DAWN, COUNT DOWN, and COUNT D_WN with the letter absent — plus a 630x500 export for the itch.io page. The menu rests on DAWN and lets lightning cut to DOWN and back, striking *through* the letter-missing frame so the swap reads as one letter being knocked out and another landing (see [`src/ui/MenuLightning.ts`](src/ui/MenuLightning.ts)).

Her original drawings all ship under [`public/assets/RAW/`](public/assets/RAW/README.md) — not loaded at runtime, but kept with the game so any sheet can be rebuilt from source without going hunting for it.

Romi's bat arrived as two 240x240 JPEG frames painted on black. `tools/build_bat_sheet.py` turns them into the shipped `assets/characters/bat/bat_fly.png` — keying the background out to alpha, lifting the wing strokes so they read against the castle floor, registering both frames on the eyes so only the wings move, and laying them out as a 2-frame 64x64 sheet. Re-run it if the source frames are ever repainted.

The weapons arrived the same way — 192x192 JPEGs on black, one drawing each for the spike and the pitchfork, two for the torch's flame. `tools/build_weapon_props.py` keys the black out, crops all four to one common box so they keep their relative sizes and the torch flickers in place, and writes 64x64 PNGs to `assets/environment/weapons/`. The painted colours are passed through untouched.

Original music and sound effects by **Noam**: the Main Title theme, the Level Music that plays through every night, the WOOSH of the Count's swing, and the SLURP of him drinking as collected blood lands on the meter. Each ships as an OGG with an MP3 fallback under one Phaser key; the WAV masters stay out of the repo. See [docs/AUDIO.md](docs/AUDIO.md) for the workflow, the music state flow and the in-game audio balance editor.

The blood droplet is a runtime-generated placeholder. Summonable bat minions are still planned; they will reuse `TEXTURES.bat` / `ANIMS.batFly`, already shipping for the dash and the coffin flights. No AI-generated art or audio.
