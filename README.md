![Count Dawn](public/assets/ui/cover/cover_itch_ratio.jpeg)

# Count Dawn 🧛🌅

**GMTK Game Jam submission — theme: "Countdown".** A reverse horde survival game: you are the monster. Hunt the humans who came to kill you, drink enough of them to matter, put down whatever they sent to lead the mob, and be back in your coffin before the sun finishes rising.

[Play Count Dawn](https://count-dawn.vercel.app) | [Itch.io](https://dotanv.itch.io/count-dawn) | [Source](https://github.com/DotanVG/Count-Dawn)

Count Dawn runs in the browser with no account or install, on desktop and on mobile. The countdown to dawn is always ticking and always on screen.

## The Night

The castle great hall **is** the main menu. Press START and the coffin opens; the Count spirals out of it as a bat and lands in the middle of the floor.

Each night runs on one clock:

1. Hunters enter only through the side and lower walls, then come straight at you. The window wall is never a spawn route.
2. Kill them. Every corpse scatters bloodlets that fly to your Blood Meter.
3. Filling the meter summons that night's **boss lineup** at the far edge of the hall.
4. When the meter is full **and** every boss is dead, the coffin lights up.
5. Get inside before the timer hits zero.

Surviving does not end the run. The lid shuts, your blood drains into your health bar, the sun crosses the sky and sets, a new moon rises, and the Count flies back out for a harder night. **Dawn or death are the only ways a run actually ends** — and both show a full debrief of everything you did across every night.

### Wrath & the Ultimate

Blood you have no use for does not go to waste. Once your health is already full, every drop of overflow instead fills a third meter — **Wrath** — sitting between your health and blood bars. Mini-bosses are the main way it climbs: a Captain or the Priest floods the floor with far more blood than any regular hunter drops, and since a boss never even spawns until the blood meter is already full, every one of those drops is guaranteed overflow. Overnight healing works the same way: it spends that night's whole blood pool on real 1-blood-per-HP healing first — so a bad night's damage might not fully recover — and only spills whatever is left over into Wrath.

A full meter glows gold, circled by dark motes, and is ready to spend on the **Ultimate**: the Count rears up and unleashes a bolt of lightning that spreads across the whole hall and kills everything still standing in it — mini-bosses included — while a swarm of bats bursts out of dark magic and swirls the room and the hall dims for a few seconds.

## What Hunts You

| | |
| --- | --- |
| **Pilgrims and huntresses** | The basic hunters, and every one of them arrives armed. Which of the two faces walks in is cosmetic; the weapon is what changes the fight. |
| **Wooden spike** | Fast, close jabs. |
| **Pitchfork** | Stabs from outside arm's reach — the reason to keep moving. |
| **Burning torch** | Chops in an arc, trailing embers the whole time it is carried. |
| **Garlic farmers** | Never close. They paint a green crosshair that crawls from their feet onto you, lock, and lob a bulb at the spot. From night two on, one fewer than the night number. |
| **Pilgrim Captain** | Bigger, tougher, hits twice as hard, shrugs off knockback — swinging the same weapon his men carry. |
| **Garlic Captain** | A Captain with a bulb in each hand. |
| **Huntress Captain** | The only hunter with the gold crosses, and she throws them like shuriken: a fan of three that flies flat and keeps going. Dodged sideways, not backwards. |
| **The Priest** | Every fifth night, in place of the Captains. Carries a wooden stake, and every few seconds plants his feet and drives out a ward of holy light. |

A weapon buys **reach and cadence, never damage** — every regular hit costs 5 HP whatever swung it. Captains and the Priest hit for 10.

### Boss telegraphs

Bosses cannot be staggered out of a special. Hitting one mid-attack shoves it and nothing more, so every boss warns you first: a ring closes and brightens on its body — **gold** for the Priest's ward, **red** for a Captain's swing, **green** for a garlic volley. The answer is footwork, not damage.

The Priest's ward is the clearest case. The full circle is painted gold on the floor for most of a second before anything burns, then the light sweeps out as staggered rings while a giant golden cross rises out of the circle trailing sparks. Walk out while it is being drawn, or dash through the edge in bat form — the dash's invulnerability carries you clean.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | WASD / Arrow keys | Virtual joystick |
| Aim + Attack | Mouse + Left click | Tap toward the target |
| Strike nearest | — | ⚔ button |
| Bat dash | Shift | 🦇 button |
| Ultimate | Space, once Wrath is full | ⚡ button, once Wrath is full |
| Pause | Esc / P | ⏸ button |
| Skip opening intro | Hold Space for 2 seconds | Hold the flashing skip control for 2 seconds |
| Restart | R (on end screens) | Tap the button; the skippable opening plays again |

Every strike is one press, one hit — clicking, tapping the ⚔ button or tapping the playfield all land a single swing each time, with no holding a button down for a stream of free hits.

The Count faces the cursor — he is aiming, not steering, so you can back away from a crowd while still facing it.

The **bat dash** is a short invulnerable burst with after-images and a HUD charge strip. It is how you break out of a crowd, how you dodge a garlic lock, and how you cross a Priest's ward.

Mobile requires landscape; a rotate prompt appears in portrait. Gameplay and
SFX pause behind it while the current soundtrack continues quietly at the same
20% level used by the pause menu.

## Player-Facing Features

- Wordless **cold open** that teaches the loop: the Count comes home nearly dead through the middle window, the whole cast of what hunts him closes in from the sides and below, and he answers with the Ultimate itself — layered lightning, chain bolts, screen flashes, shake, particles and a bat swarm wiping the ring in one demonstrated cast — before drinking his fill and sleeping off a day. It can be paused, or skipped with a deliberate two-second hold.
- **Lightning title gag** on the menu — the cover rests on COUNT DAWN, a storm flash stutters it onto COUNT DOWN, and another knocks it back.
- **Seamless night cycle** with no screen in between: coffin, blood-to-health transfer, sunrise, a full day, and the next night's moon rising over the hall.
- Living sky behind the windows — night gradient, twinkling stars, a sun that rises into the middle window and fully sets into the right one, and a moon that carries a real lunar phase per night.
- Sunrise countdown framed in the centre window, with tick pops, a growing tremble, and a red panic mode with vignette and camera shake in the final ten seconds. The final five beats briefly double the timer, while 2 and 1 add half-second flashes.
- **Bat form** for the dash and both coffin flights, with a *poof* of smoke on every transformation.
- Mouse-aimed melee arc with a cooldown pip, hit flash, knockback and a magic burst on every landed strike.
- Blood overflow past the night's quota heals the Count instead of being thrown away — and once health is already full too, feeds the **Wrath** meter toward an Ultimate instead.
- **Ultimate**: hall-wide lightning that kills every enemy standing (mini-bosses included), a swarm of ~30 bats out of dark magic, and a few seconds of the hall dimming.
- Mini-bosses flood the floor with far more blood than a regular hunter on death, and a burst of several kills in quick succession — or any mini-boss — splatters big, semi-transparent blood across the screen itself.
- **End-of-run debrief** on any death: nights survived, total blood drained across the whole run, and full breakdowns of hunters drained and mini-bosses slain — each line with the thing it counts animated beside it.
- Pause overlay with General and Sound settings, fullscreen button, rotate-to-landscape gate, and device-aware menus and hint text. Pausing freezes active SFX and keeps the soundtrack in the background at 20% of the configured level.
- General settings include a whole-canvas red-friendly palette. Desktop also gets 50–200% cursor size and 25–200% cursor speed controls; cursor settings are not constructed on touch devices. Sound settings include Master, Music and SFX levels, independent channel mutes and reset controls.
- Mobile controls that visibly respond: every button flashes and pops on press, and the compact gothic joystick pulses gently until it is grabbed. Its invisible finger target is larger than the art without swallowing ordinary playfield attack taps.
- **In-game audio balance editor** (see below) for tuning every track and effect live.

## Audio Balance Editor

Append `?audioEditor=1` to the URL and press **F8**. A panel lists every music track and sound effect with a live volume slider, a master mute, preview controls, and a button that dumps the current values as a code block ready to paste into `src/data/audioBalance.ts`. The OS mouse pointer is restored only while this editor is open so the sliders can be dragged. Editor previews intentionally bypass pause-menu SFX suppression and music ducking.

Full details in [docs/AUDIO.md](docs/AUDIO.md).

## Tech Stack

- **Phaser 4** — rendering, Arcade physics, animation, tweens, audio.
- **TypeScript** (strict) and **Vite** for the build.
- **ESLint** and `node:test` for the pure game-rule tests.
- **Python + Pillow** for the offline sprite-sheet pipeline (`tools/`), not part of the runtime.
- Fully static output — no backend, no accounts, no network calls.

## Local Development

```bash
npm install
npm run dev
```

Open the printed localhost URL.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check only |
| `npm run lint` | ESLint over `src/` |
| `npm test` | Unit tests for the pure game rules |

Set `FAST_DEV_MODE = true` in [`src/data/balance.ts`](src/data/balance.ts) for a 25-second night — every balance number the game uses lives in that one file.

### Development tools

- **Audio Balance Editor:** use `?audioEditor=1`, then **F8**, to preview and tune every manifest audio asset. Copy Configuration produces values ready for `src/data/audioBalance.ts`; full operation and browser-storage details are in [docs/AUDIO.md](docs/AUDIO.md).
- **Fast nights:** `FAST_DEV_MODE` reduces the round clock to 25 seconds for loop, dawn and urgency testing.
- **Browser inspection:** development builds expose the Phaser instance as `window.game`; production builds do not.
- **QA sweep:** [docs/QA_CHECKLIST.md](docs/QA_CHECKLIST.md) covers desktop, mobile, menus, cutscenes, audio, deaths and multi-night regressions.
- **Sprite pipeline:** the scripts under `tools/` rebuild shipped sheets from committed source art. They are offline build tools and never ship to players.

### Optional knowledge graph

[Graphify](https://pypi.org/project/graphifyy/) is optional local development
tooling for narrowing architectural, debugging, cross-cutting, and multi-file
questions. It is not an npm dependency, never runs during install, development,
tests, builds, or deployment, and is not included in the game bundle.

The verified distribution is `graphifyy==0.9.30`; its executable and Python
module are both named `graphify`. Install it with uv (recommended, especially
on Windows), pipx, or an active virtual environment:

```bash
uv tool install "graphifyy==0.9.30"
# Alternatives:
pipx install "graphifyy==0.9.30"
python -m pip install "graphifyy==0.9.30"
```

The Node wrapper works from PowerShell and Bash:

| Command | Purpose |
| --- | --- |
| `npm run graph:build` | Full source-focused rebuild (`graphify extract . --force`, then `graphify cluster-only .` for the report/HTML); uses Claude CLI for docs when available, otherwise deterministic code-only AST extraction |
| `npm run graph:update` | Incrementally re-extract changed code with the local AST pipeline |
| `npm run graph:query -- "How does blood overflow become healing or Wrath?"` | Intentionally query with a bounded 1,600-token context budget |
| `npm run graph:query -- --dfs "Which systems participate in spawning and controlling bosses?"` | Intentional depth-first query |
| `npm run graph:path -- "InputController" "CombatSystem"` | Find a shortest graph path |
| `npm run graph:explain -- "AudioDirector"` | Explain a node and its immediate relationships |
| `npm run graph:status` | Check graph commit, source dirtiness, outputs, and recorded statistics without requiring Graphify |
| `npm run graph:check` | Validate the integration and run Graphify's `check-update` command |

Generated JSON, HTML, reports, manifests, and local run metadata stay in
`graphify-out/`, which is gitignored because it is machine- and checkout-local.
Claude Code and Codex are configured with a fast session-start reminder when a
graph exists; Symphony receives the same conditional-use policy from
`WORKFLOW.md`. None of them builds on startup, and each must verify graph
findings in current source. Use `npm run graph:status`; `may be stale` means
update or rebuild before relying on it.

### Rebuilding the sprite sheets

Romi's original drawings ship under [`public/assets/RAW/`](public/assets/RAW/README.md) so no sheet is ever orphaned from its source. The builders take their source folder as the only argument and are idempotent; the final no-argument helper cleans partial-alpha dither from the castle windows:

```bash
python tools/build_count_sheets.py public/assets/RAW/count
python tools/build_hunter_sheets.py public/assets/RAW
python tools/build_priest_sheet.py public/assets/RAW/priest
python tools/build_weapon_props.py public/assets/RAW/weapons
python tools/build_green_props.py public/assets/RAW
python tools/build_bat_sheet.py public/assets/RAW/bat
python tools/clean_window_dither.py
```

How the keying works and why each script does it differently is in [docs/ASSET_INTEGRATION.md](docs/ASSET_INTEGRATION.md).

## Repository Map

```
src/
  game/      bootstrap: main, Phaser config, constants, event names, cursor, fullscreen
  scenes/    Boot, Preload, Game (also the menu), Pause, GameOver, Victory
  entities/  Player, Hunter, ArmedHunter, GarlicThrower, HunterCaptain,
             GarlicCaptain, Priest, BossCharge, Garlic, BloodPickup, Coffin
  systems/   Input, Combat, Spawn, entrance/navigation, Countdown, GameFlow,
             AudioDirector, coldOpen
  ui/        HUD + urgency rules, BossHealthBar, TouchControls, MenuLightning,
             RunDebrief, AudioEditor
  data/      balance.ts — tunable game numbers; gameSettings; audio manifest/balance
  utils/     assetKeys, animations, direction, runtime placeholder textures
  types/     shared game types
public/assets/  shipped art and audio; RAW/ holds the source drawings
tools/     offline Python sprite-sheet builders
tests/     node:test unit tests for the pure rules
docs/      game loop, asset integration, audio, deployment
```

## Deployment

| Branch | Environment | URL |
| --- | --- | --- |
| `main` | Production | https://count-dawn.vercel.app |
| `staging` | Preview | https://count-dawn-git-staging-dotanvgs-projects.vercel.app |

Every push to any branch triggers a Vercel build; `main` deploys to Production and everything else gets a Preview. `npm run build` produces the static `dist/` that also works for itch.io — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Flow: feature branches → `staging` → `main`.

## Current Codebase Coverage

Shipped and implemented:

- Endless night loop with per-night scaling of blood quota, spawn rate, alive cap, thrower cap and boss lineup.
- Five hunter flavours, three boss flavours, boss telegraphs and uninterruptible boss specials.
- Wrath meter and Ultimate: hall-wide lightning kill, a bat swarm, and a screen darken, charged by blood the Count has no use for.
- Hand-drawn Count with idle/run/attack and two distinct death sequences, plus bat form.
- Cold open, seamless between-night cycle, victory outro, and both defeat endings with a full run debrief.
- Desktop and touch control paths, landscape gate, fullscreen, pauseable cinematics and hold-to-skip intro controls.
- Persistent, compact player settings for accessibility, cursor and audio; default General values remove their browser-storage entry instead of leaving unnecessary data behind.
- Original music and SFX with an OGG/MP3 pair per key, a music state machine, menu ducking/SFX suspension, and a live balance editor.
- Offline sprite pipeline with all source art committed alongside the built sheets.

Pending:

- The blood droplet is still a runtime-generated placeholder rather than drawn art.
- Several SFX keys are wired at every hook point but have no file yet (player hurt, hunter death, boss appearance, final seconds, dawn, victory, defeat) — they are silent no-ops until a file is added to the manifest.
- Summonable bat minions that pull hunter aggro: the sprite and animation ship, the summon does not.
- Boss phases — intentionally out of scope.

## Credits

**Dotan Veretzky** — design, programming, game architecture.

**Romi Elbom** — all original art: the Count, every hunter who walks into the hall (pilgrim, huntress, garlic farmer, Priest), the four hunter weapons (wooden spike, pitchfork, burning torch, gold cross), the blood, the bat, the coffin, the garlic, and the cover art in all its title variants.

**Noam Ouzana** — original soundtrack and sound design: the **Main Title** theme and the **Level Music** that plays through every night, plus the WOOSH of the Count's swing and the SLURP of him drinking.
[soundcloud.com/ouzana](https://soundcloud.com/ouzana)

**Abed Kadry** — design and playtesting.

### Third-party assets

Character and environment art from [CraftPix](https://craftpix.net) under the [CraftPix file license](https://craftpix.net/file-licenses/) (free packs, game use permitted):

- **Free Vampire 4-Direction Pixel Character Sprite Pack** — the effects-only magic layer, all that remains in use now that the Count is Romi's. It is the burst on a landed strike and the spell he throws as he swings.
  [craftpix.net](https://craftpix.net/freebies/free-vampire-4-direction-pixel-character-sprite-pack/)
- **Free 2D Top-Down Pixel Dungeon Asset Pack** — castle tiles and torch flames.
  [craftpix.net](https://craftpix.net/freebies/free-2d-top-down-pixel-dungeon-asset-pack/)

Every human in the hall is Romi's now — the pilgrim, the huntress, the garlic
farmer and the Priest — so the CraftPix character pack that used to dress them
is no longer used at all. Only its effects-only magic layer and the dungeon
tileset remain.

**No AI-generated art or audio is used anywhere in this project.**

## More Docs

- [Game loop](docs/GAME_LOOP.md) — rules, boss lineups, the ward, endings.
- [Asset integration](docs/ASSET_INTEGRATION.md) — the sprite pipeline and how the chroma keys work.
- [Audio](docs/AUDIO.md) — encoding workflow, the music state flow, the balance editor.
- [Deployment](docs/DEPLOYMENT.md) — Vercel, static hosts, itch.io packaging.
