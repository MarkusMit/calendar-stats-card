import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          pool: 'threads',
        },
      },
      {
        test: {
          name: 'component',
          include: ['tests/component/**/*.test.ts'],
          environment: 'happy-dom',
          pool: 'forks',
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**'],
    },
  },
});
