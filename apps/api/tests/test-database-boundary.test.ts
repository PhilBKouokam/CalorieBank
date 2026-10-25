import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it.each([
  undefined,
  'not-a-url',
  'postgresql://localhost/caloriebank',
  'postgresql://database.example/caloriebank_test',
  'postgresql://localhost/caloriebank_test?host=database.example',
  'https://localhost/caloriebank_test',
])('rejects unsafe test database configuration before starting tests: %s', database => {
  const env = { ...process.env };
  if (database === undefined) delete env.TEST_DATABASE_URL;
  else env.TEST_DATABASE_URL = database;
  const result = spawnSync(process.execPath, [resolve(__dirname, '../../../scripts/run-isolated-tests.cjs')], { env, encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('No tests were started.');
  expect(result.stdout).toBe('');
});
