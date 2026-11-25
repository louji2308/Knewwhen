import { describe, expect, it } from 'vitest';
import {
  ADMIN_CAP_CEILING,
  DEFAULT_ADMIN_SETTINGS,
  parseAdminSettings,
  readAdminSettings,
  saveAdminSettings,
  validateAdminSettings,
  type AdminSettings,
  type AdminSettingsStore,
} from '../src/services/admin-settings';
import type { AuditEvent } from '../src/handlers/authorisation';

const safe: AdminSettings = {
  ...DEFAULT_ADMIN_SETTINGS,
  watchedProjects: ['KW'],
  issueTypeExclusions: ['Bug'],
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

function memoryStore(initial: AdminSettings | null = null): AdminSettingsStore & {
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

describe('P10.A1 admin settings validation (C-10.1–5, AGENTS §5.5)', () => {
  it('starts AI-off, roles empty and write-back blocked', () => {
    expect(DEFAULT_ADMIN_SETTINGS.aiEnabled).toBe(false);
    expect(DEFAULT_ADMIN_SETTINGS.reviewerRoles).toHaveLength(0);
    expect(DEFAULT_ADMIN_SETTINGS.qualifiedRoles).toHaveLength(0);
    expect(DEFAULT_ADMIN_SETTINGS.routingLabel).toBe('');
    expect(DEFAULT_ADMIN_SETTINGS.writeBackEnabled).toBe(false);
    expect(DEFAULT_ADMIN_SETTINGS.commentVisibility).toBe('NONE');
    expect(validateAdminSettings(DEFAULT_ADMIN_SETTINGS).ok).toBe(false);
  });

  it('accepts a safe configured state', () => {
    expect(validateAdminSettings(safe).ok).toBe(true);
  });

  it('rejects overlong or control-bearing identity and version labels (C-10.1, I-6)', () => {
    expect(
      parseAdminSettings({
        ...safe,
        productIdentity: { kind: 'LABEL_PREFIX', value: 'x'.repeat(129) },
      }),
    ).toBeNull();
    expect(
      parseAdminSettings({
        ...safe,
        productIdentity: { kind: 'LABEL_PREFIX', value: 'product-\u0007' },
      }),
    ).toBeNull();
    expect(parseAdminSettings({ ...safe, ruleSetVersion: 'v'.repeat(65) })).toBeNull();
    expect(parseAdminSettings({ ...safe, ruleSetVersion: 'rule\nset' })).toBeNull();
  });

  it('re-parses stored settings so an oversized value cannot be saved back truncated', async () => {
    const stored = memoryStore({
      ...safe,
      productIdentity: { kind: 'LABEL_PREFIX', value: 'x'.repeat(129) },
    });
    await expect(readAdminSettings(stored)).resolves.toEqual(DEFAULT_ADMIN_SETTINGS);

    const versionStore = memoryStore({ ...safe, ruleSetVersion: 'v'.repeat(65) });
    await expect(readAdminSettings(versionStore)).resolves.toEqual(DEFAULT_ADMIN_SETTINGS);
  });

  it('rejects caps above the code ceiling and non-positive caps', () => {
    const above = validateAdminSettings({
      ...safe,
      perSiteCap: ADMIN_CAP_CEILING + 1,
    });
    expect(above.ok).toBe(false);
    if (!above.ok) expect(above.code).toBe('CAP_ABOVE_CEILING');

    const negative = validateAdminSettings({ ...safe, perIssueCap: 0 });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.code).toBe('INVALID_CAP');
  });

  it('rejects write-back without a visibility choice before the general mismatch (C-10.4)', () => {
    const noVisibility = validateAdminSettings({
      ...safe,
      commentVisibility: 'NONE',
      commentVisibilityRef: null,
      visibilityChosen: false,
    });
    expect(noVisibility.ok).toBe(false);
    if (!noVisibility.ok) expect(noVisibility.code).toBe('WRITE_BACK_NO_VISIBILITY');

    const inconsistent = validateAdminSettings({ ...safe, visibilityChosen: false });
    expect(inconsistent.ok).toBe(false);
    if (!inconsistent.ok) expect(inconsistent.code).toBe('VISIBILITY_MISMATCH');
  });

  it('requires a reference when visibility is not NONE', () => {
    const result = validateAdminSettings({ ...safe, commentVisibilityRef: null });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('MISSING_VISIBILITY_REF');
  });

  it('parses only a complete fixed shape and rejects extra claims (C-10.1, WF-11)', () => {
    expect(parseAdminSettings(safe)).toEqual(safe);
    expect(parseAdminSettings({ ...safe, role: 'SITE_ADMIN' })).toBeNull();
    const withoutLabel: Record<string, unknown> = { ...safe };
    delete withoutLabel.routingLabel;
    expect(parseAdminSettings(withoutLabel)).toBeNull();
  });
});

describe('P10.A1 bounded identifiers and routing label (C-10.1, C-10.4, WF-11, I-6)', () => {
  it('allows an empty routing label and rejects over-long or control-character labels', () => {
    expect(validateAdminSettings({ ...safe, routingLabel: '' }).ok).toBe(true);
    expect(parseAdminSettings({ ...safe, routingLabel: '' })).toEqual({
      ...safe,
      routingLabel: '',
    });

    const control = validateAdminSettings({ ...safe, routingLabel: 'kw\u0001label' });
    expect(control.ok).toBe(false);
    if (!control.ok) expect(control.code).toBe('INVALID_ROUTING_LABEL');
    expect(parseAdminSettings({ ...safe, routingLabel: 'kw\u0001label' })).toBeNull();

    const overLong = validateAdminSettings({ ...safe, routingLabel: 'a'.repeat(129) });
    expect(overLong.ok).toBe(false);
    if (!overLong.ok) expect(overLong.code).toBe('INVALID_ROUTING_LABEL');
    expect(parseAdminSettings({ ...safe, routingLabel: 'a'.repeat(129) })).toBeNull();
  });

  it('accepts a 128-character routing label at the boundary', () => {
    const atBoundary = { ...safe, routingLabel: 'a'.repeat(128) };
    expect(validateAdminSettings(atBoundary).ok).toBe(true);
    expect(parseAdminSettings(atBoundary)).toEqual(atBoundary);
  });

  it('rejects malformed or duplicate watched project keys', () => {
    const invalid: readonly (readonly string[])[] = [
      ['kw'],
      ['KW-1'],
      ['A'.repeat(21)],
      ['KW\u0001'],
      ['KW', 'KW'],
    ];
    for (const watchedProjects of invalid) {
      const result = validateAdminSettings({ ...safe, watchedProjects });
      expect(result.ok).toBe(false);
      expect(parseAdminSettings({ ...safe, watchedProjects })).toBeNull();
    }
    expect(validateAdminSettings({ ...safe, watchedProjects: ['KW', 'AB_2'] }).ok).toBe(true);
  });

  it('rejects malformed or duplicate opaque identifiers in every settings list', () => {
    const badValues: readonly (readonly string[])[] = [
      ['bad/name'],
      ['a'.repeat(129)],
      ['kw\u0001'],
      ['with space'],
      ['group-reviewer', 'group-reviewer'],
    ];
    const fields = ['issueTypeExclusions', 'reviewerRoles', 'qualifiedRoles'] as const;
    for (const field of fields) {
      for (const value of badValues) {
        const result = validateAdminSettings({ ...safe, [field]: value });
        expect(result.ok).toBe(false);
        expect(parseAdminSettings({ ...safe, [field]: value })).toBeNull();
      }
    }
    expect(validateAdminSettings({ ...safe, reviewerRoles: ['g:1', 'a.b-c_d'] }).ok).toBe(true);
  });

  it('rejects a malformed comment visibility reference', () => {
    for (const commentVisibilityRef of ['bad/ref', 'a'.repeat(129), 'kw\u0001']) {
      const result = validateAdminSettings({ ...safe, commentVisibilityRef });
      expect(result.ok).toBe(false);
      expect(parseAdminSettings({ ...safe, commentVisibilityRef })).toBeNull();
    }
  });
});

describe('P10.A1 settings persistence and audit (C-10.4, N-04(b), N-07, I-6, I-8)', () => {
  it('writes a validated change once and audits codes only', async () => {
    const store = memoryStore();
    const events: AuditEvent[] = [];
    const result = await saveAdminSettings(store, safe, (event) => {
      events.push(event);
    });

    expect(result.ok).toBe(true);
    expect(store.writes).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]!.actionCode).toBe('SETTINGS_CHANGED');
    expect(events[0]!.errorCode).not.toBe('NO_OP');
    expect(JSON.stringify(events)).not.toContain('group-quality');
    expect(JSON.stringify(events)).not.toContain('group-qp');
    expect(JSON.stringify(events)).not.toContain('product-');
    expect(JSON.stringify(events)).not.toContain('Knewwhen signal');
  });

  it('does not write an unsafe change', async () => {
    const store = memoryStore();
    const result = await saveAdminSettings(
      store,
      { ...safe, aiEnabled: true, perSiteCap: ADMIN_CAP_CEILING + 1 },
      () => undefined,
    );
    expect(result.ok).toBe(false);
    expect(store.writes).toHaveLength(0);
  });

  it('awaits the audit sink before writing and fails closed when it rejects', async () => {
    const order: string[] = [];
    const store: AdminSettingsStore = {
      async get() {
        return null;
      },
      async set() {
        order.push('store.set');
      },
    };
    const sinkCalls: AuditEvent[] = [];
    const result = await saveAdminSettings(store, safe, async (event) => {
      sinkCalls.push(event);
      order.push('audit');
      throw new Error('audit unavailable');
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('AUDIT_FAILED');
    expect(sinkCalls).toHaveLength(1);
    expect(order).toEqual(['audit']);
  });

  it('emits exactly one audit event for a real change', async () => {
    const store = memoryStore();
    const events: AuditEvent[] = [];
    const result = await saveAdminSettings(store, safe, async (event) => {
      events.push(event);
    });
    expect(result.ok).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]!.errorCode).not.toBe('NO_OP');
  });

  it('is idempotent for an identical save: no write and no NO_OP audit row', async () => {
    const store = memoryStore(safe);
    const events: AuditEvent[] = [];
    const result = await saveAdminSettings(store, safe, async (event) => {
      events.push(event);
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.settings).toEqual(safe);
    expect(store.writes).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('audits a routing-label-only change exactly once', async () => {
    const store = memoryStore(safe);
    const events: AuditEvent[] = [];
    const next = { ...safe, routingLabel: 'Knewwhen triage' };
    const result = await saveAdminSettings(store, next, async (event) => {
      events.push(event);
    });
    expect(result.ok).toBe(true);
    expect(store.writes).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0]!.errorCode).not.toBe('NO_OP');
  });
});
