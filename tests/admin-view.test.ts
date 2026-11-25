/** P10.A1 — admin view model tests (C-10.1–5/7, WF-2, WF-11, I-5/I-6). */
import { describe, expect, it } from 'vitest';
import type { ResolverEnvelope } from '../src/contracts/envelope';
import { scanWording } from '../src/core/wording';
import {
  ADMIN_UI_STRINGS,
  adminViewModel,
  validateAdminForm,
  type AdminSettingsView,
} from '../src/frontend/admin-view';

type Code = ResolverEnvelope<unknown>['code'];

const envelope = (data: unknown, code: Code = 'OK'): ResolverEnvelope<unknown> => ({
  data,
  code,
  roleHint: 'SITE_ADMIN',
  correlationId: 'corr-admin-1',
});

const safeData = {
  watchedProjects: ['KW'],
  issueTypeExclusions: ['Bug'],
  reviewerRoles: ['kw-reviewers'],
  qualifiedRoles: ['kw-qp'],
  aiEnabled: false,
  killSwitch: false,
  writeBackEnabled: true,
  visibilityChosen: true,
  ruleSetVersion: '1.0.0',
  ruleSetStatus: 'REVIEWED',
  productIdentity: 'product-',
  productIdentityKind: 'LABEL_PREFIX',
  productIdentityValue: 'product-',
  routingLabel: 'Knewwhen signal',
  commentVisibility: 'GROUP',
  commentVisibilityRef: 'group-quality',
  caps: { perIssue: 2, perSite: 20, ceiling: 20 },
  canSave: true,
  message: 'arbitrary envelope prose',
  quote: 'secret record text',
  unexpectedField: 'do-not-copy',
};

const asView = (model: ReturnType<typeof adminViewModel>): AdminSettingsView => model;

function strings(value: unknown, into: string[] = []): readonly string[] {
  if (typeof value === 'string') {
    into.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) strings(item, into);
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) strings(item, into);
  }
  return into;
}

describe('P10.A1 admin view model (C-10.1, C-10.7, I-6)', () => {
  it('narrows envelope data to the fixed AdminSettingsView fields only', () => {
    const model = adminViewModel(envelope(safeData));
    expect(model.state).toBe('READY');
    expect(Object.keys(model).sort()).toEqual(
      [
        'aiEnabled',
        'canSave',
        'caps',
        'commentVisibility',
        'commentVisibilityRef',
        'getStarted',
        'issueTypeExclusions',
        'killSwitch',
        'message',
        'productIdentity',
        'productIdentityKind',
        'productIdentityValue',
        'qualifiedRoles',
        'routingLabel',
        'reviewerRoles',
        'ruleSetStatus',
        'ruleSetVersion',
        'state',
        'visibilityChosen',
        'watchedProjects',
        'writeBackEnabled',
      ].sort(),
    );
    expect(asView(model)).toMatchObject({
      watchedProjects: ['KW'],
      issueTypeExclusions: ['Bug'],
      reviewerRoles: ['kw-reviewers'],
      qualifiedRoles: ['kw-qp'],
      aiEnabled: false,
      killSwitch: false,
      writeBackEnabled: true,
      visibilityChosen: true,
      ruleSetVersion: '1.0.0',
      ruleSetStatus: 'REVIEWED',
      productIdentity: 'product-',
      caps: { perIssue: 2, perSite: 20, ceiling: 20 },
      canSave: true,
    });
    const json = JSON.stringify(model);
    expect(json).not.toContain('secret record text');
    expect(json).not.toContain('arbitrary envelope prose');
    expect(json).not.toContain('do-not-copy');
  });

  it('renders the eight fixed get-started steps with flags from known fields only (C-10.7, WF-2)', () => {
    const model = adminViewModel(envelope(safeData));
    expect(model.getStarted.map((step) => step.id)).toEqual([
      'WATCHED_PROJECTS',
      'ROLES',
      'COMMENT_VISIBILITY',
      'ROUTING_LABEL',
      'RULE_SET_STATUS',
      'AI_SCREENING',
      'PRODUCT_IDENTITY',
      'PANEL_PINNED',
    ]);
    expect(model.getStarted.map((step) => step.done)).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
    const panelStep = model.getStarted[7];
    expect(panelStep?.message).toContain('Show for all work items');
    expect(model.getStarted[0]?.message).toContain('1');
  });

  it('marks first-run gaps honestly, including the manual panel step', () => {
    const model = adminViewModel(
      envelope({
        ...safeData,
        watchedProjects: [],
        reviewerRoles: [],
        qualifiedRoles: [],
        visibilityChosen: false,
        routingLabel: '',
        ruleSetStatus: 'UNREVIEWED',
        aiEnabled: false,
        productIdentity: '',
        productIdentityKind: '',
        productIdentityValue: '',
      }),
    );
    expect(model.getStarted.map((step) => step.done)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(model.message).toBe(ADMIN_UI_STRINGS.notice);
  });

  it('maps envelope states and an explicit status to fixed states (G-8)', () => {
    expect(adminViewModel(null).state).toBe('IDLE');
    expect(adminViewModel(null).message).toBe(ADMIN_UI_STRINGS.idle);
    expect(adminViewModel(envelope(null, 'NOT_FOUND')).state).toBe('UNAVAILABLE');
    expect(adminViewModel(envelope(null, 'DEPENDENCY_FAILED')).state).toBe('ERROR');
    expect(adminViewModel(envelope(null, 'RATE_LIMITED')).state).toBe('ERROR');
    expect(adminViewModel(envelope(safeData), 'UNAVAILABLE').state).toBe('UNAVAILABLE');
    expect(adminViewModel(envelope(safeData), 'UNAVAILABLE').watchedProjects).toEqual([]);
  });
});

describe('P10.A1 admin form validation (C-10.2, C-10.4)', () => {
  it('accepts a safe configuration and keeps empty roles legal on first run', () => {
    const view = adminViewModel(envelope(safeData));
    expect(validateAdminForm(view, {})).toEqual({ ok: true });
    expect(validateAdminForm(view, { reviewerRoles: [], qualifiedRoles: [] })).toEqual({
      ok: true,
    });
  });

  it('uses the shared settings rules for projects and write-back visibility', () => {
    const view = adminViewModel(envelope(safeData));
    const noProjects = validateAdminForm(view, { watchedProjects: [] });
    expect(noProjects.ok).toBe(false);
    if (!noProjects.ok) expect(noProjects.code).toBe('NO_WATCHED_PROJECT');
    const noVisibility = validateAdminForm(view, {
      writeBackEnabled: true,
      visibilityChosen: false,
    });
    expect(noVisibility.ok).toBe(false);
    if (!noVisibility.ok) expect(noVisibility.code).toBe('WRITE_BACK_NO_VISIBILITY');
  });

  it('rejects caps over the code ceiling, negative caps and non-integer caps', () => {
    const view = adminViewModel(envelope(safeData));
    const over = validateAdminForm(view, { perIssueCap: 21 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.code).toBe('CAP_OVER_CEILING');
    const negative = validateAdminForm(view, { perSiteCap: -1 });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.code).toBe('NEGATIVE_CAP');
    const fractional = validateAdminForm(view, { perIssueCap: 1.5 });
    expect(fractional.ok).toBe(false);
    if (!fractional.ok) expect(fractional.code).toBe('INVALID_CAP');
  });

  it('rejects an unusable code ceiling rather than trusting the form', () => {
    const view = adminViewModel(
      envelope({ ...safeData, caps: { perIssue: 0, perSite: 0, ceiling: 0 } }),
    );
    const result = validateAdminForm(view, { perIssueCap: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_CEILING');
  });
});

describe('P10.A1 admin wording (C-10.3, G-1, I-5)', () => {
  it('shows the decision-support notice and no suggested answer', () => {
    const model = adminViewModel(envelope(safeData));
    expect(ADMIN_UI_STRINGS.notice).toBe(
      'Decision support, not a regulatory determination or legal advice.',
    );
    expect(model.message).toBe(ADMIN_UI_STRINGS.notice);
    expect(JSON.stringify(model).toLowerCase()).not.toContain('suggested decision');
    expect(JSON.stringify(model).toLowerCase()).not.toContain('recommended decision');
  });

  it('has no banned wording in any exported UI string or rendered message', () => {
    const model = adminViewModel(envelope(safeData));
    const modelStrings = [
      ...strings(model),
      ...strings(model.getStarted.map((step) => [step.label, step.message])),
    ];
    expect(scanWording(strings(ADMIN_UI_STRINGS))).toEqual({ status: 'CLEAN' });
    expect(scanWording(modelStrings)).toEqual({ status: 'CLEAN' });
  });
});
