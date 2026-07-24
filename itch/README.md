# Itch.io Upload Notes

Zip the contents of this `itch/` directory (index.html + COUNT_DAWN.jpeg), not the directory itself, and upload the zip to the itch.io project. The page shows the cover art and a PLAY button, then loads the live Vercel build in a fullscreen iframe.

- Project type: HTML
- Viewport dimensions: 1280 x 720
- Check "This file will be played in the browser"
- Enable "Fullscreen button" so itch.io grants fullscreen permission to the nested game frame
- Entry file: `index.html`
- Use `COUNT_DAWN.jpeg` as the itch.io project cover image too

Alternative (no iframe): zip the contents of `dist/` after `npm run build` and upload that instead — `index.html` must be at the ZIP root.
