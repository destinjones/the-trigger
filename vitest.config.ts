import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['index/**/*.test.ts', 'sources/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
});
