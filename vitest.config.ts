import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Component tests (.tsx) opt into jsdom with a `@vitest-environment jsdom` docblock.
    include: ['packages/*/{src,test}/**/*.test.{ts,tsx}', 'apps/*/src/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      reporter: ['text', 'html'],
      thresholds: {
        // AGENTS.md section 9: the finance engine stays above 95% coverage.
        'packages/finance-engine/src/**': {
          lines: 95,
          functions: 95,
          branches: 95,
          statements: 95,
        },
      },
    },
  },
});
