import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so builds work from any static host (GitHub Pages, file://, itch.io zip).
  base: './',
  server: {
    port: 5173,
    strictPort: false,
  },
  // One chunk. Until v1.49 Phaser went in a second one, whose hash held
  // between releases so a returning player fetched only the game again; the
  // game has no runtime dependencies now, and the whole of it is smaller than
  // that saving was.
  build: {
    target: 'es2022',
  },
});
