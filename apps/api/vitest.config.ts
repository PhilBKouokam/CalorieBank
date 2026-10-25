import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: [{ find: /^@\/lib\/native-health$/, replacement: resolve(__dirname, '../mobile/lib/native-health/index.ios.ts') }, { find: /^@\//, replacement: `${resolve(__dirname, '../mobile')}/` }] },
  test: {
    // A developer may pause new local OAuth while a callback is retired.
    // Individual tests explicitly opt into that state; local .env is not a fixture.
    env: { GOOGLE_HEALTH_LOCAL_AUTHORIZATION_PAUSED: '0' },
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
