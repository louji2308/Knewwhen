import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const importProbe = "import { probe } from '@forge/api';\nexport { probe };\n";

function runImportCheck() {
  return spawnSync(process.execPath, ['scripts/check-imports.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
}

describe('P1.A3 / P1.B2 import-boundary guard (N-06, AGENTS 12.4)', () => {
  it('allows an official Forge import inside src/adapters', () => {
    const path = join(root, 'src', 'adapters', '__probe__.ts');
    try {
      writeFileSync(path, importProbe, 'utf8');
      const result = runImportCheck();
      expect(result.status).toBe(0);
    } finally {
      rmSync(path, { force: true });
    }
  });

  it('rejects the same import outside src/adapters', () => {
    const dir = join(root, 'src', 'core');
    const path = join(dir, '__probe__.ts');
    const createdDir = !existsSync(dir);
    try {
      if (createdDir) mkdirSync(dir, { recursive: true });
      writeFileSync(path, importProbe, 'utf8');
      const result = runImportCheck();
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('imports @forge/* outside adapters');
    } finally {
      rmSync(path, { force: true });
      if (createdDir) rmSync(dir, { recursive: true, force: true });
    }
  });
});
