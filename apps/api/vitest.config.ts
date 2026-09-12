import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: [{ find: /^@\/lib\/native-health$/, replacement: resolve(__dirname, '../mobile/lib/native-health/index.ios.ts') }, { find: /^@\//, replacement: `${resolve(__dirname, '../mobile')}/` }] },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
