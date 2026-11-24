import { spawnSync } from 'node:child_process';
import { dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + sep + '..' + sep + '..';

function git(args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}

// ACDMR includes deletions; --no-renames makes a move appear as D + A, so both paths are checked.
const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACDMR', '--no-renames'])
  .stdout.split(/\r?\n/)
  .filter(Boolean);

// Locked files (AGENTS 7.2, Tools 8). Approval must be an explicit decision id.
const locked = staged.filter(
  (path) =>
    path.startsWith('docs/Project/') ||
    path.startsWith('rules/') ||
    ['docs/02-spec.md', 'docs/03-domain-rules.md', 'docs/05-stack-and-constraints.md'].includes(
      path,
    ),
);
const approval = process.env.KW_APPROVAL_TAG ?? '';

if (locked.length > 0 && !/^D-\d+$/.test(approval)) {
  console.error('PRE-COMMIT: BLOCKED - locked files staged without an approval tag.');
  for (const path of locked) console.error(`  ${path}`);
  console.error(
    'Set KW_APPROVAL_TAG=D-<decision id> only when the owner has approved that change.',
  );
  process.exit(1);
}

console.log('PRE-COMMIT: locked-file guard passed; running npm run check...');
const check = spawnSync('npm', ['run', 'check'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  stdio: 'inherit',
  env: { ...process.env, KW_HOOK_RUN: '1' },
});
if (check.status !== 0) {
  console.error('PRE-COMMIT: BLOCKED - npm run check failed.');
  process.exit(check.status ?? 1);
}
console.log('PRE-COMMIT: PASS');
