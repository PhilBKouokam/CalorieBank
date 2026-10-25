'use strict';

// Match the release gate: never let default Prisma clients use the app database.
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const database = process.env.TEST_DATABASE_URL;
let url;
try { url = database ? new URL(database) : null; } catch { url = null; }
if (!url || !['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || !/^\/caloriebank_(?:test|rc_)[a-zA-Z0-9_]*$/.test(url.pathname)
    || url.search || url.hash) {
  console.error('Set TEST_DATABASE_URL to a dedicated localhost caloriebank_test* or caloriebank_rc_* PostgreSQL database. No tests were started.');
  process.exit(1);
}
const result = spawnSync('npm', ['--workspaces', '--if-present', 'run', 'test', ...process.argv.slice(2)], {
  cwd: resolve(__dirname, '..'),
  env: { ...process.env, DATABASE_URL: database },
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
