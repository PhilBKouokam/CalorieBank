import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const database = process.env.TEST_DATABASE_URL;
if (!database) throw new Error('Set TEST_DATABASE_URL to a dedicated localhost CalorieBank test database.');
const url = new URL(database);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !/^\/caloriebank_(?:test|rc_)[a-zA-Z0-9_]*$/.test(url.pathname)) {
  throw new Error('Release tests require a dedicated localhost caloriebank_test* or caloriebank_rc_* database.');
}
const root = resolve(__dirname, '../../../..');
for (const args of [
  ['run', 'db:generate'],
  ['exec', '--workspace', '@caloriebank/api', '--', 'prisma', 'validate'],
  ['run', 'db:deploy'],
  ['run', 'typecheck'],
  ['run', 'lint'],
  ['test', '--workspace', '@caloriebank/api'],
  ['run', 'api:build'],
]) {
  const result = spawnSync('npm', args, { cwd: root, env: { ...process.env, DATABASE_URL: database }, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const diff = spawnSync('git', ['diff', '--check'], { cwd: root, stdio: 'inherit' });
process.exit(diff.status ?? 1);
