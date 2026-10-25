import { lstatSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const PATH_ERROR = 'Use a new absolute private evidence path outside the checkout with an existing trusted parent directory.';

function contains(root: string, candidate: string) {
  const child = relative(root, candidate);
  return child === '' || (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child));
}

function requireAbsent(path: string) {
  try {
    // lstat also rejects dangling symlinks: no existing output may be replaced.
    lstatSync(path);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw new Error(PATH_ERROR);
  }
  throw new Error(PATH_ERROR);
}

/** Read-only path validation. src/scripts and dist/scripts have the same depth.
 * Return a canonical parent path so the write does not follow an input alias.
 * The operator must control that parent against concurrent directory replacement.
 */
export function privateAccountingSnapshotPath(
  output: string | undefined,
  repositoryRoot = resolve(__dirname, '../../../..'),
) {
  if (!output || !isAbsolute(output) || output.split(sep).includes('..')) throw new Error(PATH_ERROR);
  const lexicalRoot = resolve(repositoryRoot);
  const target = resolve(output);
  if (contains(lexicalRoot, target)) throw new Error(PATH_ERROR);

  try {
    const root = realpathSync(lexicalRoot);
    const parent = realpathSync(dirname(target));
    if (!statSync(parent).isDirectory() || contains(root, parent)) throw new Error(PATH_ERROR);
    const canonicalTarget = join(parent, basename(target));
    if (contains(root, canonicalTarget)) throw new Error(PATH_ERROR);
    requireAbsent(target);
    requireAbsent(canonicalTarget);
    return canonicalTarget;
  } catch {
    // Do not expose private filesystem paths in command output.
    throw new Error(PATH_ERROR);
  }
}
