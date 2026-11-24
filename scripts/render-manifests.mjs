import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, renderYaml } from './lib/manifest-model.mjs';

const root = dirname(fileURLToPath(import.meta.url)) + sep + '..';
const dir = join(root, 'manifests');
const configPath = join(dir, 'app-config.json');

const config = JSON.parse(readFileSync(configPath, 'utf8'));
if (!config.appA?.id || !config.appB?.id) throw new Error('MANIFEST_CONFIG_IDS_REQUIRED');

const a = buildManifest({
  appId: config.appA.id,
  includeLicensing: config.appA.includeLicensing === true,
});
const b = buildManifest({ appId: config.appB.id });

// baseline.json is deliberately NOT generated: it is the independent,
// owner-controlled artifact that the model and both manifests are checked against.
const files = [
  ['app-a.yml', renderYaml(a)],
  ['app-b.yml', renderYaml(b)],
];

const checkOnly = process.argv.includes('--check');
mkdirSync(dir, { recursive: true });
let failed = false;
for (const [name, content] of files) {
  const path = join(dir, name);
  if (checkOnly) {
    const actual = readFileSync(path, 'utf8');
    if (actual !== content) {
      console.error(`MANIFEST_OUT_OF_DATE: ${name} — run npm run render:manifests`);
      failed = true;
    }
  } else {
    writeFileSync(path, content, 'utf8');
    console.log(`Rendered manifests/${name}`);
  }
}
process.exit(failed ? 1 : 0);
