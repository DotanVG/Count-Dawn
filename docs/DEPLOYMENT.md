# Deployment

`npm run build` produces a fully static site in `dist/` (relative asset paths, no backend). That folder is the deployable artifact everywhere.

## Vercel

1. Push the repo to GitHub and import it in Vercel, **or** run `vercel` from the project root.
2. Framework preset: **Vite**. Build command `npm run build`, output directory `dist` (auto-detected).
3. `vercel.json` adds security headers and allows the game to be iframed by itch.io.

Every push to the default branch redeploys automatically.

## Any static host

Upload the contents of `dist/` (Netlify, GitHub Pages, S3, …). The build uses `base: './'`, so it works from any subpath.

## itch.io (HTML5)

1. `npm run build`
2. Zip the **contents** of `dist/` — `index.html` must be at the **root of the ZIP**, not inside a `dist/` folder.
   ```powershell
   Compress-Archive -Path dist\* -DestinationPath count-dawn-itch.zip -Force
   ```
3. On itch.io: create/edit the project → Kind of project: **HTML** → upload the ZIP → check **"This file will be played in the browser"**.
4. Embed options: viewport **1280 × 720**, enable fullscreen button. Mobile-friendly can stay off until touch controls exist.
