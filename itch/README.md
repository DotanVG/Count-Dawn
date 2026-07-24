# Itch.io Upload Notes

Zip the **contents** of this `itch/` directory (`index.html` + `COUNT_DAWN.jpeg`), not the directory itself, and upload the zip to the itch.io project. The page shows the cover art and a PLAY button, then loads the live Vercel build in a nested fullscreen iframe.

## Upload settings

- Project type: **HTML**
- Kind of project: **Playable in browser** — without this itch shows a download card instead of the embed, and nobody ever reaches the game
- Entry file: `index.html`
- Viewport dimensions: **1280 x 720**
- ✅ **Mobile friendly** (with "orientation: landscape") — this is the switch that actually makes the page responsive on phones. Left off, itch hands mobile browsers a fixed 1280-wide embed scaled to a postage stamp, and no amount of CSS in `index.html` can undo that
- ✅ **Fullscreen button** — itch only puts `allowfullscreen` on its own iframe when this is enabled, and without it the nested game frame can never go fullscreen either
- Use `COUNT_DAWN.jpeg` as the itch.io project cover image too

## How the warp works

`index.html` → nested `<iframe>` → `https://count-dawn.vercel.app/?embed=1`.

Three things have to line up for that to load, so check all three if the embed comes up blank:

1. `vercel.json` must list the itch hosts in `frame-ancestors` (`itch.io`, `*.itch.io`, `html-classic.itch.zone`, `html.itch.zone`) and must **not** send `X-Frame-Options`, which has no "allow this specific host" form and would veto the frame regardless.
2. The itch embed must be marked playable in the browser (above).
3. The Vercel deploy has to be live — the page falls back to an "open in a new tab" link after 12s if the frame never loads, so a blank embed means the fallback timer has not fired yet.

Fullscreen is requested on click but is never required: browsers that refuse it (iOS Safari has no element fullscreen) still launch the game windowed.

## Alternative (no iframe)

Zip the contents of `dist/` after `npm run build` and upload that instead — `index.html` must be at the ZIP root. This drops the nested frame entirely, at the cost of having to re-upload for every change.
