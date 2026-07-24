# Count Dawn 🧛🌅

A reverse horde survival game for the **"Countdown"** game jam theme.

**Count Dawn** is a vampire who must hunt waves of human hunters, collect enough blood, defeat the Hunter Captain, and return to his coffin before sunrise. The countdown to dawn is always ticking — and always on screen.

> ⚠️ **Asset status:** all current graphics are simple runtime-generated placeholder shapes (Phaser Graphics). No audio ships yet. Real licensed top-down art and audio will replace them soon — see [docs/ASSET_INTEGRATION.md](docs/ASSET_INTEGRATION.md).

## Current prototype scope

- One castle arena, one night, one complete playable loop
- Hunters spawn at the arena edges and chase the vampire
- Melee arc attack aimed with the mouse
- Defeated hunters drop blood pickups that fill the Blood Meter
- The Hunter Captain (boss) appears 30 seconds before sunrise
- Fill the Blood Meter **and** defeat the Captain to activate the coffin
- Reach the coffin before the timer hits zero to win
- Dawn or death means defeat; instant restart with **R**

Details in [docs/GAME_LOOP.md](docs/GAME_LOOP.md).

## Controls

| Action  | Input                    |
| ------- | ------------------------ |
| Move    | WASD / Arrow keys        |
| Aim     | Mouse                    |
| Attack  | Left click / Space       |
| Pause   | Esc / P                  |
| Restart | R (on end screens)       |

Touch controls are not implemented yet; the input layer ([src/systems/InputController.ts](src/systems/InputController.ts)) is built so a virtual joystick can slot in later.

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

## Deployment

`npm run build` produces a fully static `dist/` — deployable to Vercel as-is and to itch.io as a zipped HTML5 game. Steps in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Credits

- **Dotan** — _(role TBD)_
- **Romi** — _(role TBD)_
- **Noam** — _(role TBD)_
- **Abed** — _(role TBD)_

Current graphics are generated placeholders; third-party asset credits will be added here when real assets are integrated.
