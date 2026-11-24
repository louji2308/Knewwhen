import { readFileSync } from 'node:fs';

// Tools 2-5 and I-10: only official @forge/* packages at runtime, plus React as
// the declared dependency of @forge/react. Everything else is dev-only.
const APPROVED_RUNTIME_DEPENDENCIES = new Set([
  '@forge/bridge',
  '@forge/react',
  '@forge/resolver',
  '@forge/sql',
  'react',
]);
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

for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
  if (!APPROVED_RUNTIME_DEPENDENCIES.has(name)) {
    failures.push(`unapproved runtime dependency: ${name}`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version))) {
    failures.push(`runtime dependency ${name} is not pinned exactly: ${String(version)}`);
  }
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
  `DEPENDENCY CHECK: PASS (${Object.keys(manifest.dependencies ?? {}).length} approved runtime, ${Object.keys(manifest.devDependencies).length} approved dev dependencies)`,
);
