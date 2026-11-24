/**
 * P1.B1 — single source of truth for the two Forge manifests.
 *
 * N-03(a) fixes the six scopes. D-008/D-009 fix the module set. This file is a
 * technical implementation of those rulings, not a new product decision.
 * A scope or module change must be accompanied by an updated approval marker
 * in manifests/snapshot.json; scripts/check-manifests.mjs enforces that.
 */

export const APPROVED_SCOPES = Object.freeze([
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'storage:app',
  'report:personal-data',
  'read:servicedesk-request',
]);

export const APPROVED_MODULES = Object.freeze([
  'function',
  'trigger',
  'consumer',
  'scheduledTrigger',
  'jira:issuePanel',
  'jira:adminPage',
  'jira:issueContext',
  'jira:entityPropertySet',
  'llm',
  'sql',
]);

/** Owner decisions only. A platform fact is evidence, not an approval (review F6). */
export const APPROVAL_IDS = Object.freeze(['N-03(a)', 'N-08', 'Arch-3.2', 'D-008', 'D-009']);

/** Verified platform facts cited by the model; deliberately not approval markers. */
export const EVIDENCE_IDS = Object.freeze(['PF-RUN-1']);

/**
 * The baseline declared by the code. `manifests/baseline.json` is the independent
 * owner-controlled artifact this is checked against; the pre-commit hook locks both.
 */
export function modelBaseline() {
  return {
    scopes: [...APPROVED_SCOPES],
    modules: [...APPROVED_MODULES],
    approval: [...APPROVAL_IDS],
    evidence: [...EVIDENCE_IDS],
  };
}

const PROJECTION_VALUES = Object.freeze([
  { path: 'schemaVersion', type: 'number', searchAlias: 'knewwhenProjectionVersion' },
  { path: 'state', type: 'string', searchAlias: 'knewwhenCaseState' },
  { path: 'signalFlag', type: 'number', searchAlias: 'knewwhenSignalFlag' },
  { path: 'routingState', type: 'string', searchAlias: 'knewwhenRoutingState' },
  { path: 'decisionStatus', type: 'string', searchAlias: 'knewwhenDecisionStatus' },
  { path: 'decisionVersion', type: 'number', searchAlias: 'knewwhenDecisionVersion' },
  { path: 'deadlineStatus', type: 'string', searchAlias: 'knewwhenDeadlineStatus' },
  { path: 'awarenessDate', type: 'date', searchAlias: 'knewwhenAwarenessDate' },
  { path: 'ruleSetRef', type: 'string', searchAlias: 'knewwhenRuleSet' },
  { path: 'ruleSetStatus', type: 'string', searchAlias: 'knewwhenRuleSetStatus' },
  { path: 'dueDate', type: 'date', searchAlias: 'knewwhenDueDate' },
  { path: 'daysLeft', type: 'number', searchAlias: 'knewwhenDaysLeft' },
  { path: 'daysLeftAsOf', type: 'date', searchAlias: 'knewwhenDaysLeftAsOf' },
]);

const TRIGGER_EVENTS = Object.freeze([
  'avi:jira:created:issue',
  'avi:jira:updated:issue',
  'avi:jira:created:comment',
  'avi:jira:updated:comment',
  'avi:jira:deleted:comment',
  'avi:jira:created:issue-link',
]);

/**
 * Build the manifest object. App A and App B use the same builder; only
 * app.id (and the optional App A licensing declaration) may differ (N-08).
 */
export function buildManifest({ appId, includeLicensing = false } = {}) {
  if (typeof appId !== 'string' || appId.length === 0) {
    throw new Error('MANIFEST_APP_ID_REQUIRED');
  }

  const app = { id: appId, runtime: { name: 'nodejs24.x' } };
  // Official shape is `licensing.enabled: true` (manifest overview, fetched 24 Nov 2026).
  // App A carries this only if the listing requires it; App B must have no licensing block.
  if (includeLicensing) app.licensing = { enabled: true };

  return {
    app,
    permissions: { scopes: [...APPROVED_SCOPES] },
    modules: {
      'jira:issuePanel': [
        {
          key: 'knewwhen-case',
          resource: 'main',
          resolver: { function: 'resolver' },
          render: 'native',
          title: 'KnewWhen',
          description: 'Decision support for adverse-event reporting clocks.',
        },
      ],
      'jira:adminPage': [
        {
          key: 'knewwhen-admin',
          resource: 'main',
          resolver: { function: 'resolver' },
          render: 'native',
          title: 'KnewWhen settings',
          description: 'Configure projects, roles, rule sets and signal screening.',
        },
      ],
      'jira:issueContext': [
        {
          key: 'knewwhen-context',
          resource: 'main',
          resolver: { function: 'resolver' },
          render: 'native',
          title: 'KnewWhen signal',
          label: 'KnewWhen signal',
          description: 'Collapsible signal nudge on the issue view.',
        },
      ],
      'jira:entityPropertySet': [
        {
          key: 'knewwhen-projection',
          properties: [
            {
              propertyKey: 'knewwhen.case',
              entityType: 'issue',
              values: PROJECTION_VALUES.map((value) => ({ ...value })),
            },
          ],
        },
      ],
      function: [
        { key: 'resolver', handler: 'index.resolver' },
        { key: 'event-trigger', handler: 'index.trigger' },
        { key: 'scan-consumer', handler: 'index.scanConsumer' },
        { key: 'writeback-consumer', handler: 'index.writebackConsumer' },
        { key: 'daily-reconcile', handler: 'index.scheduled' },
      ],
      trigger: [
        {
          key: 'knewwhen-events',
          function: 'event-trigger',
          events: [...TRIGGER_EVENTS],
        },
      ],
      consumer: [
        { key: 'scan-queue', queue: 'knewwhen-scan', function: 'scan-consumer' },
        { key: 'writeback-queue', queue: 'knewwhen-writeback', function: 'writeback-consumer' },
      ],
      scheduledTrigger: [{ key: 'knewwhen-daily', function: 'daily-reconcile', interval: '24h' }],
      llm: [{ key: 'knewwhen-llm', model: ['claude'] }],
      sql: [{ key: 'knewwhen-main', engine: 'mysql' }],
    },
    resources: [{ key: 'main', path: 'src/frontend/index.jsx' }],
  };
}

function isScalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function yamlScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  throw new Error(`YAML_UNSUPPORTED_SCALAR:${typeof value}`);
}

function serializeMap(value, indent) {
  return Object.entries(value)
    .map(([key, child]) => {
      if (isScalar(child)) return `${indent}${key}: ${yamlScalar(child)}`;
      if (Array.isArray(child)) {
        if (child.length === 0) return `${indent}${key}: []`;
        return `${indent}${key}:\n${serializeArray(child, `${indent}  `)}`;
      }
      if (Object.keys(child).length === 0) return `${indent}${key}: {}`;
      return `${indent}${key}:\n${serializeMap(child, `${indent}  `)}`;
    })
    .join('\n');
}

function serializeArray(value, indent) {
  return value
    .map((item) => {
      if (isScalar(item)) return `${indent}- ${yamlScalar(item)}`;
      if (Array.isArray(item)) {
        if (item.length === 0) return `${indent}- []`;
        return `${indent}-\n${serializeArray(item, `${indent}  `)}`;
      }
      const entries = Object.entries(item);
      if (entries.length === 0) return `${indent}- {}`;
      const [firstKey, firstValue] = entries[0];
      let first;
      if (isScalar(firstValue)) {
        first = `${indent}- ${firstKey}: ${yamlScalar(firstValue)}`;
      } else if (Array.isArray(firstValue)) {
        first =
          firstValue.length === 0
            ? `${indent}- ${firstKey}: []`
            : `${indent}- ${firstKey}:\n${serializeArray(firstValue, `${indent}    `)}`;
      } else {
        first = `${indent}- ${firstKey}:\n${serializeMap(firstValue, `${indent}    `)}`;
      }
      const rest = entries.slice(1);
      return rest.length === 0
        ? first
        : `${first}\n${serializeMap(Object.fromEntries(rest), `${indent}  `)}`;
    })
    .join('\n');
}

/** Deterministic YAML for the restricted object shapes used by the manifest. */
export function renderYaml(value) {
  const body = isScalar(value)
    ? yamlScalar(value)
    : Array.isArray(value)
      ? serializeArray(value, '')
      : serializeMap(value, '');
  return `${body}\n`;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normaliseForParity(manifest, { stripLicensing }) {
  const copy = structuredClone(manifest);
  copy.app.id = '<APP_ID>';
  if (stripLicensing) delete copy.app.licensing;
  return stableStringify(copy);
}

/**
 * N-08: `a` is App A and `b` is App B. Only app.id and App A's optional
 * licensing declaration may differ; licensing on App B is a violation (F3).
 */
export function isParityCompatible(a, b) {
  return (
    normaliseForParity(a, { stripLicensing: true }) ===
    normaliseForParity(b, { stripLicensing: false })
  );
}

function sameList(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    expected.every((item, index) => actual[index] === item)
  );
}

/**
 * Findings that require a new owner approval. `approved` must be the independent
 * committed artifact (manifests/baseline.json), never the code constants themselves
 * (review F1). The pre-commit hook locks that artifact and the model.
 */
export function baselineFindings(candidate, approved) {
  if (!approved) return ['BASELINE_MISSING'];
  const findings = [];
  if (!sameList(candidate?.scopes, approved.scopes)) findings.push('SCOPE_CHANGE');
  if (!sameList(candidate?.modules, approved.modules)) findings.push('MODULE_CHANGE');
  if (!sameList(candidate?.approval, approved.approval)) findings.push('APPROVAL_MARKER_CHANGE');
  if (!sameList(candidate?.evidence, approved.evidence)) findings.push('EVIDENCE_CHANGE');
  return findings;
}
