import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    // Integration tests share one local Postgres, so they must not race each other.
    // Unit tests are pure and fast, so the cost of one fork for everything is small.
    pool: 'forks',
    // One test file at a time: they share one local Postgres and one truncate between
    // tests, so two files running at once would delete each other's fixtures.
    fileParallelism: false,
    maxForks: 1,
    minForks: 1,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ['./vitest.setup.ts'],
  },
});
