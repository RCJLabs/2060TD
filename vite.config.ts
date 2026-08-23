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
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        /**
         * Phaser in its own chunk. Measured: the engine is 1.48MB of a 1.75MB
         * bundle and the game itself is 269KB, so splitting SCENES off the
         * critical path would buy about 3% — not worth the load-order risk.
         * Splitting the engine off buys something real instead: its hash does
         * not change between releases, so a returning player re-downloads the
         * 82KB app chunk rather than 422KB of gzip.
         *
         * SINGLE_FILE builds skip it: the artifact is one inlined <script>,
         * and two ES modules that import each other cannot be inlined as one.
         */
        manualChunks: process.env['SINGLE_FILE']
          ? undefined
          : (id: string): string | undefined => (id.includes('node_modules') ? 'vendor' : undefined),
      },
    },
  },
});
