import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + sep + '..';
const seed = process.env.KW_TEST_SEED ?? '20261124';
const steps = [
  'check:deps',
  'check:imports',
  'check:types',
  'check:lint',
  'check:format',
  'check:tests',
];

function run(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, KW_TEST_SEED: seed },
  });
}

const sha = run('git', ['rev-parse', 'HEAD']).stdout.trim() || 'unavailable';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const lines = [
  'KnewWhen - npm run check evidence (N-06, C-12.5)',
  `Date: ${new Date().toISOString()}`,
  `Node: ${process.version} · npm: ${process.env.npm_config_user_agent ?? 'unknown'}`,
  `Git HEAD: ${sha}`,
  `Test seed: ${seed}`,
  '',
];

let failed = false;
for (const step of steps) {
  console.log(`> npm run ${step}`);
  const result = run('npm', ['run', step]);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trimEnd();
  lines.push(`--- npm run ${step} (exit ${result.status ?? 'unknown'}) ---`, output, '');
  console.log(output);
  if (result.status !== 0) failed = true;
}

if (existsSync(join(root, 'manifest.yml'))) {
  console.log('> forge lint');
  const result = run('forge', ['lint']);
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trimEnd();
  lines.push(`--- forge lint (exit ${result.status ?? 'unknown'}) ---`, output, '');
  console.log(output);
  if (result.status !== 0) failed = true;
} else {
  lines.push('--- forge lint: SKIP (no manifest.yml yet; P1.B1 owns the manifest) ---', '');
  console.log('forge lint: SKIP (no manifest.yml yet)');
}

// A pre-commit run is a gate, not an evidence step; an explicit `npm run check` writes proof.
if (process.env.KW_HOOK_RUN === '1') {
  console.log('Evidence: SKIP (pre-commit gate)');
} else {
  const evidenceDir = join(root, 'evidence', 'P1');
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = join(evidenceDir, `check-${stamp}.txt`);
  writeFileSync(evidencePath, `${lines.join('\n')}\nRESULT: ${failed ? 'FAIL' : 'PASS'}\n`, 'utf8');
  console.log(`Evidence: ${relative(root, evidencePath)}`);
}
console.log(`RESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);

function relative(from, to) {
  return to.replace(`${from}${sep}`, '').replace(`${from}/`, '');
}
