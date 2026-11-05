import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: [{find:'@caloriebank/domain',replacement:resolve(__dirname,'../../packages/domain/src/index.ts')},{find:'@caloriebank/schemas',replacement:resolve(__dirname,'../../packages/schemas/src/index.ts')},{ find: /^@\/lib\/native-health$/, replacement: resolve(__dirname, '../mobile/lib/native-health/index.ios.ts') }, { find: /^@\//, replacement: `${resolve(__dirname, '../mobile')}/` }] },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
  },
});
