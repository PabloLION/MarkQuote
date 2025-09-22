import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    server: {
      deps: {
        inline: ['vitest-chrome'],
      },
    },
  },
});
