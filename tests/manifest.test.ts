import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APPROVED_MODULES,
  APPROVED_SCOPES,
  baselineFindings,
  buildManifest,
  isParityCompatible,
  modelBaseline,
  renderYaml,
} from '../scripts/lib/manifest-model.mjs';

// Requirement literals are independent of the implementation. These are the
// authority for the tests; the committed baseline.json is the authority for check-manifests.
const EXPECTED_SCOPES = [
  'read:jira-work',
  'write:jira-work',
  'read:jira-user',
  'storage:app',
  'report:personal-data',
  'read:servicedesk-request',
];

const EXPECTED_MODULES = [
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
];

// PF-Q-3/PF-Q-4 (docs/platform-facts.md) are the Verified official Jira event
// identifiers. A comment edit is covered by `commented:issue`, not a separate
// `updated:comment` event; the link identifier has no hyphen.
const EXPECTED_TRIGGER_EVENTS = [
  'avi:jira:created:issue',
  'avi:jira:updated:issue',
  'avi:jira:commented:issue',
  'avi:jira:deleted:comment',
  'avi:jira:created:issuelink',
];

// Only owner decisions belong here. D-011 is an orchestrator-recorded technical
// implementation, not an owner ruling (docs/08-decisions.md).
const EXPECTED_APPROVAL = ['N-03(a)', 'N-08', 'Arch-3.2', 'D-008', 'D-009'];
const EXPECTED_EVIDENCE = ['PF-RUN-1'];

type Baseline = {
  scopes: string[];
  modules: string[];
  approval: string[];
  evidence: string[];
};

const baseline = JSON.parse(
  readFileSync(new URL('../manifests/baseline.json', import.meta.url), 'utf8'),
) as Baseline;

function candidate(overrides: Partial<Baseline> = {}): Baseline {
  return {
    scopes: [...baseline.scopes],
    modules: [...baseline.modules],
    approval: [...baseline.approval],
    evidence: [...baseline.evidence],
    ...overrides,
  };
}

describe('P1.B1 approved manifest baseline (N-03(a), N-08, D-008, D-009)', () => {
  it('keeps exactly the six N-03 scopes', () => {
    expect([...APPROVED_SCOPES]).toEqual(EXPECTED_SCOPES);
  });

  it('declares the approved Core modules and excludes deferred ones', () => {
    expect([...APPROVED_MODULES]).toEqual(EXPECTED_MODULES);
    for (const excluded of [
      'jira:issueGlance',
      'jira:dashboardGadget',
      'rovo:agent',
      'jira:customField',
      'jira:customFieldType',
    ]) {
      expect(APPROVED_MODULES).not.toContain(excluded);
    }
  });

  it('builds a manifest with the locked runtime and approved property key', () => {
    const manifest = buildManifest({ appId: 'app-a' });
    expect(manifest.app.runtime.name).toBe('nodejs24.x');
    expect([...manifest.permissions.scopes]).toEqual(EXPECTED_SCOPES);
    const set = manifest.modules['jira:entityPropertySet']![0]!['properties'] as Array<
      Record<string, string>
    >;
    expect(set[0]!['propertyKey']).toBe('knewwhen.case');
  });

  it('uses the official llm and sql module shapes', () => {
    const modules = buildManifest({ appId: 'app-a' }).modules;
    expect(modules.llm![0]).toMatchObject({ key: 'knewwhen-llm', model: ['claude'] });
    expect(modules.sql![0]).toMatchObject({ key: 'knewwhen-main', engine: 'mysql' });
  });

  it('uses the official issue-panel icon and scheduled-trigger enum (PF-MAN-3)', () => {
    const modules = buildManifest({ appId: 'app-a' }).modules;
    expect(modules['jira:issuePanel']![0]).toMatchObject({
      icon: 'https://developer.atlassian.com/platform/forge/images/icons/issue-panel-icon.svg',
    });
    expect(modules.scheduledTrigger![0]).toMatchObject({
      key: 'knewwhen-daily',
      function: 'daily-reconcile',
      interval: 'day',
    });
  });

  it('subscribes only to Jira event identifiers that Atlassian emits (PF-Q-3, PF-Q-4)', () => {
    const trigger = buildManifest({ appId: 'app-a' }).modules.trigger![0]!;
    expect(trigger.events).toEqual(EXPECTED_TRIGGER_EVENTS);
    for (const invalid of [
      'avi:jira:created:comment',
      'avi:jira:updated:comment',
      'avi:jira:created:issue-link',
    ]) {
      expect(trigger.events).not.toContain(invalid);
    }
  });

  it('uses the official licensing.enabled shape and leaves App B unlicensed', () => {
    expect(buildManifest({ appId: 'app-a', includeLicensing: true }).app.licensing).toEqual({
      enabled: true,
    });
    expect(buildManifest({ appId: 'app-a' }).app.licensing).toBeUndefined();
    expect(buildManifest({ appId: 'app-b' }).app.licensing).toBeUndefined();
  });
});

describe('P1.B1 App A / App B parity (N-08)', () => {
  it('accepts manifests that differ only in app.id', () => {
    const a = buildManifest({ appId: 'app-a' });
    const b = buildManifest({ appId: 'app-b' });
    expect(isParityCompatible(a, b)).toBe(true);
  });

  it('accepts the permitted App A licensing declaration', () => {
    const a = buildManifest({ appId: 'app-a', includeLicensing: true });
    const b = buildManifest({ appId: 'app-b' });
    expect(isParityCompatible(a, b)).toBe(true);
  });

  it('rejects licensing on App B, which is permitted only for App A (F3)', () => {
    const a = buildManifest({ appId: 'app-a', includeLicensing: true });
    const b = buildManifest({ appId: 'app-b', includeLicensing: true });
    expect(isParityCompatible(a, b)).toBe(false);
  });

  it('rejects an injected scope difference', () => {
    const a = buildManifest({ appId: 'app-a' });
    const b = buildManifest({ appId: 'app-b' });
    b.permissions.scopes.push('admin:jira-work');
    expect(isParityCompatible(a, b)).toBe(false);
  });

  it('rejects an injected module difference', () => {
    const a = buildManifest({ appId: 'app-a' });
    const b = buildManifest({ appId: 'app-b' });
    b.modules['jira:issueGlance'] = [{ key: 'nudge' } as Record<string, string>];
    expect(isParityCompatible(a, b)).toBe(false);
  });
});

describe('P1.B1 independent baseline guard (N-03(a))', () => {
  it('reads a committed artifact, never a value derived from the model under test (F1/F4)', () => {
    expect(baseline.scopes).toEqual(EXPECTED_SCOPES);
    expect(baseline.modules).toEqual(EXPECTED_MODULES);
    expect(baseline.approval).toEqual(EXPECTED_APPROVAL);
    expect(baseline.evidence).toEqual(EXPECTED_EVIDENCE);
    expect(modelBaseline()).toEqual({
      scopes: baseline.scopes,
      modules: baseline.modules,
      approval: baseline.approval,
      evidence: baseline.evidence,
    });
    expect(baselineFindings(modelBaseline(), baseline)).toEqual([]);
  });

  it('fails when the model constants drift from the committed baseline (F1)', () => {
    expect(
      baselineFindings(candidate({ scopes: [...APPROVED_SCOPES, 'admin:jira-work'] }), baseline),
    ).toContain('SCOPE_CHANGE');
  });

  it('fails when a module is removed', () => {
    expect(
      baselineFindings(
        candidate({ modules: APPROVED_MODULES.filter((m) => m !== 'sql') }),
        baseline,
      ),
    ).toContain('MODULE_CHANGE');
  });

  it('fails when the approval marker changes', () => {
    expect(baselineFindings(candidate({ approval: ['made-up-approval'] }), baseline)).toContain(
      'APPROVAL_MARKER_CHANGE',
    );
  });

  it('fails when a platform fact is added to the approval list', () => {
    expect(baselineFindings(candidate({ evidence: [] }), baseline)).toContain('EVIDENCE_CHANGE');
  });

  it('fails when the committed baseline is missing', () => {
    expect(baselineFindings(candidate(), undefined as unknown as Baseline)).toContain(
      'BASELINE_MISSING',
    );
  });
});

describe('P1.B1 YAML rendering', () => {
  it('renders both apps and differs only by the app id line', () => {
    const a = renderYaml(buildManifest({ appId: 'app-a' }));
    const b = renderYaml(buildManifest({ appId: 'app-b' }));
    expect(a).toContain('"app-a"');
    expect(b).toContain('"app-b"');
    expect(a.replace('"app-a"', '<ID>')).toBe(b.replace('"app-b"', '<ID>'));
  });

  it('quotes strings containing a colon and uses no tabs', () => {
    const yaml = renderYaml({ app: { title: 'Decision support: not advice' } });
    expect(yaml).toContain('"Decision support: not advice"');
    expect(yaml).not.toContain('\t');
  });
});

describe('P1.B2 root manifest tie (RV-15, N-08)', () => {
  const root = readFileSync(new URL('../manifest.yml', import.meta.url), 'utf8');
  const appA = readFileSync(new URL('../manifests/app-a.yml', import.meta.url), 'utf8');
  const appB = readFileSync(new URL('../manifests/app-b.yml', import.meta.url), 'utf8');

  it('is byte-for-byte one of the two rendered approval templates', () => {
    expect([appA, appB]).toContain(root);
  });

  it('never introduces a third app id', () => {
    const ids = [appA, appB].map((yaml) => yaml.match(/ari:cloud:ecosystem::app\/[0-9a-f-]+/)?.[0]);
    expect(ids.every((id) => typeof id === 'string')).toBe(true);
    expect(root).toContain(ids.find((id) => root.includes(id ?? '\u0000')) ?? '\u0000');
  });
});
