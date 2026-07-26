# Count Dawn 🧛🌅

A reverse horde survival game for the **"Countdown"** game jam theme.

**Count Dawn** is a vampire who must hunt waves of human hunters, collect enough blood, defeat the Hunter Captain, and return to his coffin before sunrise. The countdown to dawn is always ticking — and always on screen.

- **Repository:** https://github.com/DotanVG/Count-Dawn
- **Production (main):** https://count-dawn.vercel.app
- **Staging (staging branch):** https://count-dawn-git-staging-dotanvgs-projects.vercel.app

> **Asset status:** the vampire, hunters, garlic throwers, Captain and castle use licensed free pixel-art packs from CraftPix (see Credits). Romi created the coffin, garlic, bat, hunter weapons and cover art. Noam composed the original music (Main Title and Level Music) and the gameplay SFX. The blood droplet is still a runtime-generated placeholder. No AI-generated art or audio is used.

## Prototype state

The complete core loop is playable end to end:

- ✅ Castle great-hall built from a 16px dungeon tileset (4x scale): north wall with sky windows, animated torches
- ✅ Living sky behind the windows: night gradient with twinkling stars → pre-dawn purple → sunrise, with a pixel sun that physically rises into the windows
- ✅ The main menu **is** the level: cover art + typewriter tagline over the night hall; START opens the coffin and the Count spirals out across the room to land dead center
- ✅ Victory reverses the entrance — the Count spirals back into the coffin and his collected blood drains into his health bar with green/red particle streams
- ✅ Hunters drop +1 bloodlets that fly to the blood bar on pickup (red burst on arrival); hunters stop and swing their swords in melee range
- ✅ Mobile support: red virtual joystick, ⚔ auto-strike-nearest button (Space on desktop), tap-to-strike toward the tap, rotate-to-landscape gate, device-aware menus
- ✅ Sunrise countdown (60s for fast playtests) — big timer framed in the center window, tick pops, growing tremble, red panic mode + vignette + camera shakes in the last 10s
- ✅ Fully animated 4-direction vampire (idle/run/attack/hurt/death) and sword-hunter enemies with death animations
- ✅ Hunters spawn at arena edges and chase the vampire; every new night raises the blood target, increases the alive cap, and accelerates spawning
- ✅ Mouse-aimed melee arc attack with cooldown pip, hit flash and knockback — landed strikes shove the target back, flinch it, and cancel the swing it was winding up (the Captain resists most of it)
- ✅ Garlic throwers: unarmed hunters who walk in visibly carrying a garlic bulb, hold a standoff, paint a green glowing crosshair that crawls from their feet onto the Count, and lob the bulb at the spot it locks onto — dodgeable by moving or dashing. Capped at one per night number (1 on night 1, 2 on night 2…), so ranged pressure ramps while the rest of the growing spawn budget stays melee
- ✅ Armed hunters (Romi's art): unarmed men carrying a **wooden spike**, a **pitchfork** or a **burning torch**. The base pack has no attack sheet for them, so the prop is pinned to the fist — riding his walk cycle's bob so the join holds still — and the whole attack is animated on it. The spike and fork **stab**: the point comes to bear inside the first quarter of the strike and then holds while he drives it in. The torch **chops** in an arc, trailing embers, and goes on burning and flickering on the floor after its carrier drops it. A weapon buys reach and cadence, never damage: the fork jabs from outside sword range, the spike jabs fast and close. One new weapon joins the hall per night (spike night 1, pitchfork night 2, torch night 3)
- ✅ Flat damage economy: every regular hit — sword, garlic, spike, pitchfork or torch — costs 5 HP; the Hunter Captain hits for 10
- ✅ Bat dash (Shift / 🦇): a short invulnerable burst with after-images and a HUD charge strip — the escape from a crowd and the counter to a lock
- ✅ Bat form (Romi's art): the Count *poofs* into a bat for the dash and for both coffin flights, mirrored to whichever way he is travelling
- ✅ Dead hunters drop blood pickups; Night 1 targets 50 blood, increasing by 15 each new night
- ✅ Filling the round's Blood Meter immediately summons the Hunter Captain: entrance effect, dedicated health bar, heavier contact damage
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
public/assets/  real assets go here (empty for now)
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
- **Romi** — coffin, garlic and bat art; cover art
- **Noam** — original music (Main Title, Level Music) and gameplay SFX (attack WOOSH, blood-drinking SLURP)
- **Abed** — _(role TBD)_

### Third-party assets

Character & environment art from [CraftPix](https://craftpix.net) under the [CraftPix file license](https://craftpix.net/file-licenses/) (free packs, game use permitted):

- **Free Vampire 4-Direction Pixel Character Sprite Pack** — the Count (Vampires1)
- **Free Base 4-Direction Male Character Pixel Art** — hunters & Hunter Captain (sword variant, incl. swing attack); garlic throwers (unarmed variant)
- **Free 2D Top-Down Pixel Dungeon Asset Pack** — castle tiles & torch flames

Original art by **Romi**: the cover art, coffin (closed/half/open), garlic (thrown at the Count by the garlic throwers), the bat (the Count's dash and coffin-flight form), and the three hunter weapons (wooden spike, pitchfork, burning torch).

Romi's bat arrived as two 240x240 JPEG frames painted on black. `tools/build_bat_sheet.py` turns them into the shipped `assets/characters/bat/bat_fly.png` — keying the background out to alpha, lifting the wing strokes so they read against the castle floor, registering both frames on the eyes so only the wings move, and laying them out as a 2-frame 64x64 sheet. Re-run it if the source frames are ever repainted.

The weapons arrived the same way — 192x192 JPEGs on black, one drawing each for the spike and the pitchfork, two for the torch's flame. `tools/build_weapon_props.py` keys the black out, crops all four to one common box so they keep their relative sizes and the torch flickers in place, and writes 64x64 PNGs to `assets/environment/weapons/`. The painted colours are passed through untouched.

Original music and sound effects by **Noam**: the Main Title theme, the Level Music that plays through every night, the WOOSH of the Count's swing, and the SLURP of him drinking as collected blood lands on the meter. Each ships as an OGG with an MP3 fallback under one Phaser key; the WAV masters stay out of the repo. See [docs/AUDIO.md](docs/AUDIO.md) for the workflow, the music state flow and the in-game audio balance editor.

The blood droplet is a runtime-generated placeholder. Summonable bat minions are still planned; they will reuse `TEXTURES.bat` / `ANIMS.batFly`, already shipping for the dash and the coffin flights. No AI-generated art or audio.
