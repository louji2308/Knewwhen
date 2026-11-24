import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)) + sep + '..';
const src = join(root, 'src');
// Side-effect imports have no `from`/`require(`; backticks cover dynamic imports.
const forbiddenForgeImport =
  /(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"`]@forge(?:[/][^'"`]*)?['"`]/;
const sourceFile = /\.[cm]?tsx?$/;
const failures = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    const rel = relative(root, full);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!sourceFile.test(entry.name)) continue;

    // Tests and oracles must never be in the deployed bundle, adapters included.
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
      failures.push(`${rel} found under src/; tests must live in tests/`);
    }
    if (/oracle/i.test(rel)) {
      failures.push(`${rel} matches oracle naming; the oracle must not be in src/`);
    }

    if (rel.startsWith(`adapters${sep}`)) continue; // adapters are the only runtime bridge
    if (forbiddenForgeImport.test(readFileSync(full, 'utf8'))) {
      failures.push(`${rel} imports @forge/* outside adapters`);
    }
  }
}

walk(src);

if (existsSync(join(src, 'oracle'))) {
  failures.push('src/oracle/ directory exists; the oracle must not be in the deployed bundle');
}

if (failures.length > 0) {
  console.error('IMPORT BOUNDARY CHECK: FAIL');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  'IMPORT BOUNDARY CHECK: PASS (no @forge/* outside adapters; no tests or oracle under src/)',
);
