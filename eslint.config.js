import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'dist-single/', 'node_modules/', 'scripts/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The service worker runs in a ServiceWorkerGlobalScope, not a window:
    // `self`, `caches`, `fetch` and `Response` are all globals there and none
    // of them exist in the browser config above. Declared here rather than
    // with file-level directives so the file reads as ordinary code.
    files: ['public/sw.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
      },
    },
  },
);
