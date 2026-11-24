import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + sep + '..';
const source = join(root, 'scripts', 'hooks', 'pre-commit');
const gitPath = spawnSync('git', ['rev-parse', '--git-path', 'hooks'], {
  cwd: root,
  encoding: 'utf8',
});
const hooksDir = gitPath.stdout.trim();
if (gitPath.status !== 0 || !hooksDir) {
  console.error('SETUP: FAIL - cannot locate the Git hooks directory');
  process.exit(1);
}

mkdirSync(hooksDir, { recursive: true });
const destination = join(hooksDir, 'pre-commit');
copyFileSync(source, destination);
chmodSync(destination, 0o755);

const installed =
  existsSync(destination) && readFileSync(destination, 'utf8').includes('pre-commit.mjs');
console.log(`SETUP: ${installed ? 'PASS' : 'FAIL'} - pre-commit hook installed at ${destination}`);
process.exit(installed ? 0 : 1);
