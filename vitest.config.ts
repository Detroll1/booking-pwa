import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
    },
  },
});
