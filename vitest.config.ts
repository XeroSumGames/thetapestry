import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Pure-helper tests don't need a DOM. If we ever add component
    // tests, switch to 'jsdom' for those via per-file overrides.
    environment: 'node',
    // Fail-fast on the first error in pre-commit context. Local
    // 'npm test' still runs the full suite via the script alias.
    reporters: ['default'],
  },
})
