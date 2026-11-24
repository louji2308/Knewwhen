import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * P1.B2 / RV-15: the deployed root manifest is always a byte-for-byte copy of
 * one rendered, owner-approved template. This exists so App A and App B can be
 * deployed from the same commit without editing scopes or modules by hand.
 */
const root = dirname(fileURLToPath(import.meta.url)) + sep + '..';
const target = process.argv[2] ?? 'app-a';

if (target !== 'app-a' && target !== 'app-b') {
  console.error('ROOT_MANIFEST_TARGET_INVALID: use app-a or app-b');
  process.exit(1);
}

const source = `${root}${sep}manifests${sep}${target}.yml`;
const destination = `${root}${sep}manifest.yml`;
writeFileSync(destination, readFileSync(source, 'utf8'), 'utf8');
console.log(`ROOT_MANIFEST_TARGET: ${target}`);
