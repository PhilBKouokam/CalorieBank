import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { privateAccountingSnapshotPath } from '../src/scripts/accounting-snapshot-path';

let area: string;
let root: string;
let outside: string;
beforeEach(() => {
  area = realpathSync(mkdtempSync(join(tmpdir(), 'caloriebank-snapshot-path-')));
  root = join(area, 'checkout');
  outside = join(area, 'private');
  mkdirSync(join(root, 'apps', 'api'), { recursive: true });
  mkdirSync(join(root, 'docs'));
  mkdirSync(outside);
});
afterEach(() => rmSync(area, { recursive: true, force: true }));

describe('private accounting snapshot output path — synthetic filesystem only', () => {
  it.each([undefined, '', 'relative.json'])('rejects missing or relative output %s', (output) => {
    expect(() => privateAccountingSnapshotPath(output, root)).toThrow('new absolute private evidence path');
  });

  it('rejects repository-root, normal and dot-dot-prefixed children independently of cwd', () => {
    for (const target of [root, join(root, 'docs', 'snapshot.json'), join(root, '..snapshot.json')]) {
      expect(() => privateAccountingSnapshotPath(target, root)).toThrow();
    }
    // Actual source default anchor, even though test runner cwd is the API workspace.
    expect(() => privateAccountingSnapshotPath(resolve(__dirname, '../..snapshot-never-created.json'))).toThrow();
  });

  it('allows an absent sibling target without confusing a shared checkout prefix', () => {
    const sibling = `${root}-private`;
    mkdirSync(sibling);
    const target = join(sibling, 'snapshot.json');
    expect(privateAccountingSnapshotPath(target, root)).toBe(target);
    expect(() => lstatSync(target)).toThrow();
  });

  it('rejects traversal segments instead of changing their symlink semantics', () => {
    expect(() => privateAccountingSnapshotPath(`${outside}/../checkout/docs/snapshot.json`, root)).toThrow();
  });

  it('rejects existing-parent symlink aliases into the checkout', () => {
    symlinkSync(join(root, 'docs'), join(outside, 'alias'), 'dir');
    expect(() => privateAccountingSnapshotPath(join(outside, 'alias', 'new.json'), root)).toThrow();
  });

  it('rejects nonexistent nested parents, including beneath a checkout alias', () => {
    symlinkSync(root, join(outside, 'alias'), 'dir');
    expect(() => privateAccountingSnapshotPath(join(outside, 'missing', 'new.json'), root)).toThrow();
    expect(() => privateAccountingSnapshotPath(join(outside, 'alias', 'missing', 'new.json'), root)).toThrow();
  });

  it('rejects checkout spelling even when a parent link points outside', () => {
    symlinkSync(outside, join(root, 'out'), 'dir');
    expect(() => privateAccountingSnapshotPath(join(root, 'out', 'new.json'), root)).toThrow();
  });

  it('canonicalizes permitted outside-parent aliases and repository aliases', () => {
    symlinkSync(outside, join(area, 'private-alias'), 'dir');
    symlinkSync(root, join(area, 'repo-alias'), 'dir');
    expect(privateAccountingSnapshotPath(join(area, 'private-alias', 'new.json'), root))
      .toBe(join(outside, 'new.json'));
    expect(() => privateAccountingSnapshotPath(join(root, 'docs', 'new.json'), join(area, 'repo-alias'))).toThrow();
  });

  it('rejects existing files and both valid and dangling output symlinks', () => {
    writeFileSync(join(outside, 'existing.json'), 'synthetic');
    symlinkSync(join(outside, 'existing.json'), join(outside, 'link.json'));
    symlinkSync(join(outside, 'absent.json'), join(outside, 'dangling.json'));
    for (const name of ['existing.json', 'link.json', 'dangling.json']) {
      expect(() => privateAccountingSnapshotPath(join(outside, name), root)).toThrow();
    }
    expect(readFileSync(join(outside, 'existing.json'), 'utf8')).toBe('synthetic');
  });

  it('preserves exclusive owner-only creation and refuses a file appearing after validation', () => {
    const target = privateAccountingSnapshotPath(join(outside, 'new.json'), root);
    writeFileSync(target, 'synthetic evidence', { flag: 'wx', mode: 0o600 });
    expect(lstatSync(target).mode & 0o777).toBe(0o600);
    expect(() => writeFileSync(target, 'replacement', { flag: 'wx', mode: 0o600 })).toThrow();
    expect(readFileSync(target, 'utf8')).toBe('synthetic evidence');
  });
});
