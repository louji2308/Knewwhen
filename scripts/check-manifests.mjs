import { readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  baselineFindings,
  buildManifest,
  isParityCompatible,
  modelBaseline,
  renderYaml,
} from './lib/manifest-model.mjs';

const root = dirname(fileURLToPath(import.meta.url)) + sep + '..';
const dir = join(root, 'manifests');
const read = (name) => readFileSync(join(dir, name), 'utf8');
const findings = [];

const config = JSON.parse(read('app-config.json'));
const a = buildManifest({
  appId: config.appA?.id,
  includeLicensing: config.appA?.includeLicensing === true,
});
const b = buildManifest({ appId: config.appB?.id });

if (!isParityCompatible(a, b)) findings.push('PARITY_FAIL: apps differ beyond app.id/licensing');
if (read('app-a.yml') !== renderYaml(a)) findings.push('APP_A_YAML_OUT_OF_DATE');
if (read('app-b.yml') !== renderYaml(b)) findings.push('APP_B_YAML_OUT_OF_DATE');

// Compare the code model against the independent, hook-locked artifact. Editing
// only the constants can no longer pass with an unchanged approval marker (F1).
const approvedBaseline = JSON.parse(read('baseline.json'));
for (const finding of baselineFindings(modelBaseline(), approvedBaseline)) {
  findings.push(`${finding}: an owner decision id and a baseline.json update are required`);
}

if (findings.length > 0) {
  console.error('MANIFEST CHECK: FAIL');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log('MANIFEST CHECK: PASS (2 apps, 6 scopes, 10 modules, independent baseline intact)');
