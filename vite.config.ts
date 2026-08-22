import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so builds work from any static host (GitHub Pages, file://, itch.io zip).
  base: './',
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
});
