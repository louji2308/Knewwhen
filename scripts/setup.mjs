import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + sep + '..';
const source = join(root, 'scripts', 'hooks', 'pre-commit');
const deniedActions = ['edit', 'shell', 'subagent'];
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
let hookInstalled = false;
try {
  copyFileSync(source, destination);
  chmodSync(destination, 0o755);
  hookInstalled =
    existsSync(destination) && readFileSync(destination, 'utf8').includes('pre-commit.mjs');
} catch (error) {
  console.error(`SETUP: FAIL - pre-commit hook: ${errorMessage(error)}`);
}
console.log(
  `SETUP: ${hookInstalled ? 'PASS' : 'FAIL'} - pre-commit hook installed at ${destination}`,
);

// The ECC-generated .opencode/ directory is ignored, so KnewWhen's read-only
// agents are kept in tracked source and copied here on every setup (P1.A5).
const agentsSource = join(root, 'agents', 'opencode');
const agentsDir = join(root, '.opencode', 'agents');
let agentsInstalled = true;
for (const name of ['reviewer.md', 'judge.md']) {
  const from = join(agentsSource, name);
  const to = join(agentsDir, name);
  if (!existsSync(from)) {
    console.error(`SETUP: FAIL - missing tracked agent source: ${name}`);
    agentsInstalled = false;
    continue;
  }
  try {
    mkdirSync(agentsDir, { recursive: true });
    copyFileSync(from, to);
    const content = readFileSync(to, 'utf8');
    const denials = new Map();
    for (const match of content.matchAll(/-\s*action:\s*([a-z]+)\b[\s\S]*?effect:\s*([a-z]+)\b/g)) {
      denials.set(match[1], match[2]);
    }
    const valid =
      /^mode:\s*subagent\s*$/m.test(content) &&
      deniedActions.every((action) => denials.get(action) === 'deny');
    agentsInstalled = agentsInstalled && valid;
    console.log(`SETUP: ${valid ? 'PASS' : 'FAIL'} - read-only agent installed at ${name}`);
  } catch (error) {
    console.error(`SETUP: FAIL - ${name}: ${errorMessage(error)}`);
    agentsInstalled = false;
  }
}

process.exit(hookInstalled && agentsInstalled ? 0 : 1);

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
