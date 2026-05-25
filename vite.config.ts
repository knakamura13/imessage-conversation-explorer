import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  // better-sqlite3 has native bindings; don't try to pre-bundle.
  optimizeDeps: {
    exclude: ['better-sqlite3']
  },
  ssr: {
    noExternal: []
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 20_000
  }
});
