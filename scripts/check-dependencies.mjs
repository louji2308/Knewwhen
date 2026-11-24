import { readFileSync } from 'node:fs';

// Tools 4-5: zero third-party code at runtime; dev tools are a closed list.
const APPROVED_DEV_DEPENDENCIES = new Set([
  '@types/node',
  'eslint',
  'fast-check',
  'prettier',
  'typescript',
  'typescript-eslint',
  'vitest',
]);

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const failures = [];

const runtime = Object.keys(manifest.dependencies ?? {});
if (runtime.length > 0) {
  failures.push(`runtime dependencies must be empty (I-10), found: ${runtime.join(', ')}`);
}

for (const [name, version] of Object.entries(manifest.devDependencies ?? {})) {
  if (!APPROVED_DEV_DEPENDENCIES.has(name)) {
    failures.push(`unapproved dev dependency: ${name}`);
  }
  const exact = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
  if (typeof version !== 'string' || !exact.test(version)) {
    failures.push(`dev dependency ${name} is not pinned exactly: ${String(version)}`);
  }
}

if (failures.length > 0) {
  console.error('DEPENDENCY CHECK: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `DEPENDENCY CHECK: PASS (0 runtime, ${Object.keys(manifest.devDependencies).length} approved dev dependencies)`,
);
