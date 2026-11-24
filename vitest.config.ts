import { defineConfig } from 'vitest/config';

const seed = Number(process.env.KW_TEST_SEED ?? '20261124');

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    sequence: { seed },
    reporters: ['default'],
  },
});
