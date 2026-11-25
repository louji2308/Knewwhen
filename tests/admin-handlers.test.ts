import { describe, expect, it } from 'vitest';
import { createAdminDispatcher } from '../src/handlers/admin-dispatch';
import type { GateContext, Role } from '../src/contracts/authorisation';
import type { AuditEvent } from '../src/handlers/authorisation';
import {
  DEFAULT_ADMIN_SETTINGS,
  type AdminSettings,
  type AdminSettingsStore,
} from '../src/services/admin-settings';

const context: GateContext = { accountId: 'admin-account', canBrowseResource: true };
const safe: AdminSettings = {
  ...DEFAULT_ADMIN_SETTINGS,
  watchedProjects: ['KW'],
  reviewerRoles: ['group-reviewer'],
  qualifiedRoles: ['group-qp'],
  routingLabel: 'Knewwhen signal',
  writeBackEnabled: true,
  commentVisibility: 'GROUP',
  commentVisibilityRef: 'group-quality',
  visibilityChosen: true,
  aiEnabled: true,
  perIssueCap: 5,
  perSiteCap: 100,
  productIdentity: { kind: 'LABEL_PREFIX', value: 'product-' },
  ruleSetVersion: 'rules-unreviewed-v1',
  ruleSetStatus: 'UNREVIEWED',
};

function store(initial: AdminSettings | null = null): AdminSettingsStore & {
  writes: readonly AdminSettings[];
} {
  let current = initial;
  const writes: AdminSettings[] = [];
  return {
    writes,
    async get() {
      return current;
    },
    async set(next) {
      current = next;
      writes.push(next);
    },
  };
}

function dispatcher(
  settingsStore: AdminSettingsStore | undefined,
  roles: readonly Role[],
  events: AuditEvent[] = [],
  options: {
    health?: () => Promise<unknown>;
    loadSample?: (projectKey: string, accountId: string) => Promise<unknown>;
    failAudit?: boolean;
  } = {},
) {
  return createAdminDispatcher({
    ...(settingsStore === undefined ? {} : { settingsStore }),
    ...(options.health === undefined ? {} : { health: options.health }),
    ...(options.loadSample === undefined ? {} : { loadSample: options.loadSample }),
    resolveRoles: async () => roles,
    recordAudit: async (event) => {
      if (options.failAudit === true) throw new Error('AUDIT_UNAVAILABLE');
      events.push(event);
    },
  });
}

describe('P10.A1/A2 admin resolver gate (C-10.5, AGENTS §13.3)', () => {
  it('returns NOT_FOUND when no settings port is injected', async () => {
    const result = await dispatcher(undefined, ['SITE_ADMIN'])(
      'ADMIN_SETTINGS',
      { action: 'GET_SETTINGS' },
      context,
    );
    expect(result.code).toBe('NOT_FOUND');
    expect(result.data).toBeNull();
  });

  it('denies a non-admin and audits the denial with codes only', async () => {
    const events: AuditEvent[] = [];
    const result = await dispatcher(store(), ['REVIEWER'], events)(
      'ADMIN_SETTINGS',
      { action: 'GET_SETTINGS' },
      context,
    );
    expect(result.code).toBe('NOT_PERMITTED');
    // A denial carries no granted role: never imply the viewer holds one.
    expect(result.roleHint).toBe('UNKNOWN');
    expect(events.some((event) => event.actionCode === 'ADMIN_SETTINGS')).toBe(true);
    const denial = events.find((event) => event.actionCode === 'ADMIN_SETTINGS');
    expect(denial?.actorAccountId).toBe(context.accountId);
    expect(
      JSON.stringify({ actionCode: denial?.actionCode, errorCode: denial?.errorCode }),
    ).not.toContain('admin-account');
  });

  it('reads and saves only through the injected store', async () => {
    const settingsStore = store();
    const read = await dispatcher(settingsStore, ['SITE_ADMIN'])(
      'ADMIN_SETTINGS',
      { action: 'GET_SETTINGS' },
      context,
    );
    expect(read.code).toBe('OK');
    expect(read.data).toMatchObject({
      watchedProjects: [],
      aiEnabled: false,
      productIdentity: '',
      caps: { ceiling: expect.any(Number) },
    });

    const saved = await dispatcher(settingsStore, ['SITE_ADMIN'])(
      'ADMIN_SETTINGS',
      { action: 'SAVE_SETTINGS', settings: safe },
      context,
    );
    expect(saved.code).toBe('OK');
    expect(settingsStore.writes).toHaveLength(1);
    expect(saved.data).toMatchObject({
      routingLabel: 'Knewwhen signal',
      productIdentity: 'LABEL_PREFIX:product-',
    });
  });

  it('attributes a settings change to the authoritative gate context, not the payload', async () => {
    const settingsStore = store();
    const events: AuditEvent[] = [];
    const result = await dispatcher(settingsStore, ['SITE_ADMIN'], events)(
      'ADMIN_SETTINGS',
      { action: 'SAVE_SETTINGS', settings: safe },
      context,
    );
    expect(result.code).toBe('OK');
    expect(events).toHaveLength(1);
    expect(events[0]!.actionCode).toBe('SETTINGS_CHANGED');
    expect(events[0]!.actorAccountId).toBe(context.accountId);
    const codes = { actionCode: events[0]!.actionCode, errorCode: events[0]!.errorCode };
    expect(JSON.stringify(codes)).not.toContain(context.accountId);
  });

  it('rejects an unsafe save without writing', async () => {
    const settingsStore = store();
    const result = await dispatcher(settingsStore, ['SITE_ADMIN'])(
      'ADMIN_SETTINGS',
      { action: 'SAVE_SETTINGS', settings: { ...safe, perIssueCap: -1 } },
      context,
    );
    expect(result.code).toBe('INVALID_REQUEST');
    expect(settingsStore.writes).toHaveLength(0);
  });

  it('does not copy arbitrary fields from the payload into settings', async () => {
    const settingsStore = store();
    const result = await dispatcher(settingsStore, ['SITE_ADMIN'])(
      'ADMIN_SETTINGS',
      { action: 'SAVE_SETTINGS', settings: { ...safe, role: 'SITE_ADMIN' } },
      context,
    );
    expect(result.code).toBe('INVALID_REQUEST');
    expect(settingsStore.writes).toHaveLength(0);
  });

  it('does not persist a change when the audit sink fails', async () => {
    const settingsStore = store();
    const result = await dispatcher(settingsStore, ['SITE_ADMIN'], [], { failAudit: true })(
      'ADMIN_SETTINGS',
      { action: 'SAVE_SETTINGS', settings: safe },
      context,
    );
    expect(result.code).toBe('DEPENDENCY_FAILED');
    expect(settingsStore.writes).toHaveLength(0);
  });
});

describe('P10.A2/A3 strict health and sample envelopes (C-10.8, C-08)', () => {
  const health = {
    windowDays: 7,
    scansByStatus: {
      QUEUED: 1,
      RUNNING: 0,
      DONE: 2,
      FAILED: 0,
      DEFERRED: 1,
    },
    scansByResult: { SIGNAL: 1, NO_SIGNAL: 1, SKIPPED: 0, UNKNOWN: 0 },
    stalledScans: 0,
    deferredCount: 1,
    evidenceStateCounts: {
      VALID: 1,
      RELOCATED: 0,
      MODIFIED: 0,
      UNAVAILABLE: 0,
      UNVERIFIABLE: 0,
    },
    writebackPending: 0,
    writebackFailed: 0,
    lastReconcilerAt: null,
    capsHit: 0,
    ruleSetVersion: 'UNKNOWN',
    ruleSetStatus: 'UNKNOWN',
    hashKeyStatus: 'UNKNOWN',
    ai: {
      issueCalls: 1,
      siteCalls: 2,
      perIssueCap: 5,
      perSiteCap: 100,
      breakerState: 'CLOSED',
    },
  };

  it('passes a complete counted health snapshot and rejects free text', async () => {
    const ok = await dispatcher(undefined, ['SITE_ADMIN'], [], { health: async () => health })(
      'ADMIN_SETTINGS',
      { action: 'GET_HEALTH' },
      context,
    );
    expect(ok.code).toBe('OK');
    expect(ok.data).toMatchObject({ windowDays: 7, ai: { breakerState: 'CLOSED' } });

    const bad = await dispatcher(undefined, ['SITE_ADMIN'], [], {
      health: async () => ({ ...health, note: 'raw record text' }),
    })('ADMIN_SETTINGS', { action: 'GET_HEALTH' }, context);
    expect(bad.code).toBe('DEPENDENCY_FAILED');
    expect(bad.data).toBeNull();
  });

  it('maps a sample result to counts and keys only', async () => {
    const result = await dispatcher(undefined, ['SITE_ADMIN'], [], {
      loadSample: async () => ({
        ok: true,
        createdCount: 7,
        totalCreatedCount: 7,
        csvRecordCount: 5,
        issueKeys: ['KW-1', 'KW-2'],
      }),
    })('ADMIN_SETTINGS', { action: 'LOAD_SAMPLE', projectKey: 'KW' }, context);
    expect(result.code).toBe('OK');
    expect(result.data).toMatchObject({
      projectKey: 'KW',
      sampleCount: 7,
      csvIssueCount: 7,
      csvRowCount: 5,
      complete: true,
    });
    expect(JSON.stringify(result)).not.toContain('app froze');
    expect(JSON.stringify(result)).not.toContain('admin-account');
  });

  it('shows a partial sample load honestly with retry counts', async () => {
    const result = await dispatcher(undefined, ['SITE_ADMIN'], [], {
      loadSample: async () => ({
        ok: false,
        code: 'PARTIAL_LOAD',
        createdCount: 2,
        totalCreatedCount: 2,
        remainingCount: 5,
        issueKeys: ['KW-1', 'KW-2'],
      }),
    })('ADMIN_SETTINGS', { action: 'LOAD_SAMPLE', projectKey: 'KW' }, context);
    expect(result.code).toBe('OK');
    expect(result.data).toMatchObject({
      sampleCount: 2,
      csvIssueCount: 2,
      complete: false,
    });
  });

  it('carries the second-load code to the UI without changing the envelope vocabulary', async () => {
    const result = await dispatcher(undefined, ['SITE_ADMIN'], [], {
      loadSample: async () => ({ ok: false, code: 'ALREADY_LOADED' }),
    })('ADMIN_SETTINGS', { action: 'LOAD_SAMPLE', projectKey: 'KW' }, context);
    expect(result.code).toBe('INVALID_REQUEST');
    expect(result.data).toMatchObject({ projectKey: 'KW', resultCode: 'ALREADY_LOADED' });
  });
});
