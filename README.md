# Count Dawn 🧛🌅

A reverse horde survival game for the **"Countdown"** game jam theme.

**Count Dawn** is a vampire who must hunt waves of human hunters, collect enough blood, defeat the Hunter Captain, and return to his coffin before sunrise. The countdown to dawn is always ticking — and always on screen.

- **Repository:** https://github.com/DotanVG/Count-Dawn
- **Production (main):** https://count-dawn.vercel.app
- **Staging (staging branch):** https://count-dawn-git-staging-dotanvgs-projects.vercel.app

> **Asset status:** the vampire, hunters, Captain and castle now use licensed free pixel-art packs from CraftPix (see Credits). The blood droplet and coffin are still runtime-generated placeholders. No audio ships yet — the hook points are ready ([docs/ASSET_INTEGRATION.md](docs/ASSET_INTEGRATION.md)). No AI-generated art or audio is used.

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
- ✅ Hunters spawn at arena edges every ~1.25s (max 18 alive) and chase the vampire
- ✅ Mouse-aimed melee arc attack with cooldown pip and hit flash
- ✅ Dead hunters drop blood pickups; Blood Meter targets 100
- ✅ Hunter Captain boss at T−30s: entrance effect, dedicated health bar, heavier contact damage
- ✅ Coffin activates only when blood is full **and** the Captain is dead (pulsing glow, hint messages if approached early)
- ✅ Victory / dawn-defeat / death-defeat endings with run stats and instant restart (R)
- ✅ Pause overlay (Esc / P), main menu, fullscreen button
- ✅ Player: invulnerability window + damage flash, world-bounds clamping, frame-rate-independent movement
- ✅ Unit tests for the pure game rules (countdown single-fire guarantees, coffin activation rules, single end-of-run transition)
- ⬜ Audio (integration points ready)
- ⬜ Real coffin / blood-pickup art
- ⬜ Touch controls (input layer prepared, see below)
- ⬜ Dash, extra enemy types, boss phases — intentionally out of scope for now

Full loop details in [docs/GAME_LOOP.md](docs/GAME_LOOP.md).

## Controls

| Action         | Desktop            | Mobile                      |
| -------------- | ------------------ | --------------------------- |
| Move           | WASD / Arrow keys  | Virtual joystick            |
| Aim + Attack   | Mouse + Left click | Tap toward the target       |
| Strike nearest | Space (hold)       | ⚔ button (hold)             |
| Pause          | Esc / P            | ⏸ button                    |
| Restart        | R (on end screens) | Tap the button              |

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
  systems/   Input, Combat, Spawn, Countdown, GameFlow (rules), Audio
  ui/        HUD (timer, health, blood, objective), BossHealthBar
  data/      balance.ts — every tunable number, incl. FAST_DEV_MODE
  utils/     assetKeys, runtime placeholder textures
  types/     shared game types
public/assets/  real assets go here (empty for now)
tests/     node:test unit tests for CountdownSystem and GameFlowSystem
docs/      game loop, asset integration, deployment
```

## Dev mode

Set `FAST_DEV_MODE = true` in [src/data/balance.ts](src/data/balance.ts) for a 30-second night with an early boss — handy for testing the full loop quickly.

## Branches & deployment

| Branch    | Vercel environment | URL                                                        |
| --------- | ------------------ | ---------------------------------------------------------- |
| `main`    | Production         | https://count-dawn.vercel.app                              |
| `staging` | Preview (Test)     | https://count-dawn-git-staging-dotanvgs-projects.vercel.app |

Every push to **any** branch triggers a Vercel build: `main` deploys to Production, everything else gets a Preview deployment (with `staging` keeping the stable test URL above). `npm run build` produces the static `dist/` that also works for itch.io — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Suggested flow: feature branches → `staging` (playtest on the test URL) → merge to `main` when a build is jam-ready.

## Credits

- **Dotan** — _(role TBD)_
- **Romi** — _(role TBD)_
- **Noam** — _(role TBD)_
- **Abed** — _(role TBD)_

### Third-party assets

All from [CraftPix](https://craftpix.net) under the [CraftPix file license](https://craftpix.net/file-licenses/) (free packs, game use permitted):

- **Free Vampire 4-Direction Pixel Character Sprite Pack** — the Count (Vampires1)
- **Free Base 4-Direction Male Character Pixel Art** — hunters & Hunter Captain (sword variant)
- **Free 2D Top-Down Pixel Dungeon Asset Pack** — castle tiles & torch flames

The coffin and blood droplet are runtime-generated placeholders. No AI-generated art or audio.
