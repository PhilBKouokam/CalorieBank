#!/usr/bin/env node
'use strict';

// Development tooling only. Never installs a runtime or changes shell defaults.
const { existsSync, readFileSync } = require('node:fs');
const { homedir } = require('node:os');
const { delimiter, dirname, join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const pinned = readFileSync(join(root, '.nvmrc'), 'utf8').trim().replace(/^v/, '');
if (!/^20\.\d+\.\d+$/.test(pinned)) {
  throw new Error('This runner requires an exact Node 20 version in .nvmrc.');
}
const args = process.argv.slice(2);
if (!args.length) {
  console.error('Usage: node scripts/with-node20.cjs <command> [arguments...]');
  process.exit(1);
}
if (process.version !== `v${pinned}`) {
  const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
  const candidates = [
    process.env.CALORIEBANK_NODE20,
    join(process.env.NVM_DIR || join(homedir(), '.nvm'), 'versions', 'node', `v${pinned}`, 'bin', nodeName),
    ...(process.env.NVM_HOME ? [join(process.env.NVM_HOME, `v${pinned}`, nodeName)] : []),
  ].filter(Boolean);
  const node = candidates.find(candidate => {
    if (!existsSync(candidate)) return false;
    const check = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    return check.status === 0 && check.stdout.trim() === `v${pinned}`;
  });
  if (!node) {
    console.error(`Node ${pinned} is required. Select it with nvm use, or set CALORIEBANK_NODE20 to its executable. No runtime was installed.`);
    process.exit(1);
  }
  const result = spawnSync(node, [__filename, ...args], { stdio: 'inherit', env: process.env });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
const result = spawnSync(args[0], args.slice(1), {
  stdio: 'inherit',
  env: { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH || ''}` },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
