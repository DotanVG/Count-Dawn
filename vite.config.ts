import { defineConfig } from 'vite';

// Relative base so the static build works on Vercel and itch.io
// (itch serves the zip from a random subpath).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
    port: 5173,
  },
});
