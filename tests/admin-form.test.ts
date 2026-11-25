/** P10 — admin form translation tests (C-10.1–5, WF-11, I-6). */
import { describe, expect, it } from 'vitest';
import {
  formFromSettings,
  settingsFromForm,
  type AdminFormState,
} from '../src/frontend/admin-form';
import type { AdminSettingsView } from '../src/frontend/admin-view';

const view: AdminSettingsView = {
  watchedProjects: ['KW'],
  issueTypeExclusions: ['Bug'],
  reviewerRoles: ['group-reviewer'],
  qualifiedRoles: ['group-qp'],
  aiEnabled: true,
  killSwitch: false,
  writeBackEnabled: true,
  visibilityChosen: true,
  ruleSetVersion: 'rules-unreviewed-v1',
  ruleSetStatus: 'UNREVIEWED',
  productIdentity: 'LABEL_PREFIX:product-',
  productIdentityKind: 'LABEL_PREFIX',
  productIdentityValue: 'product-',
  routingLabel: 'Knewwhen signal',
  commentVisibility: 'GROUP',
  commentVisibilityRef: 'group-quality',
  caps: { perIssue: 5, perSite: 100, ceiling: 1000 },
  canSave: true,
  message: '',
};

const form = (overrides: Partial<AdminFormState> = {}): AdminFormState => ({
  ...formFromSettings(view),
  ...overrides,
});

describe('P10 admin form translation (C-10.2, C-10.4, I-6)', () => {
  it('builds a form from narrowed view fields only', () => {
    expect(formFromSettings(view)).toMatchObject({
      watchedProjects: 'KW',
      productIdentityKind: 'LABEL_PREFIX',
      productIdentityValue: 'product-',
      routingLabel: 'Knewwhen signal',
      perIssueCap: '5',
      aiEnabled: 'ON',
    });
  });

  it('builds a strict settings object the service accepts', () => {
    const settings = settingsFromForm(form());
    expect(settings).not.toBeNull();
    expect(settings).toMatchObject({
      version: 1,
      watchedProjects: ['KW'],
      reviewerRoles: ['group-reviewer'],
      qualifiedRoles: ['group-qp'],
      productIdentity: { kind: 'LABEL_PREFIX', value: 'product-' },
      routingLabel: 'Knewwhen signal',
      perIssueCap: 5,
      perSiteCap: 100,
      commentVisibility: 'GROUP',
      commentVisibilityRef: 'group-quality',
    });
  });

  it('deduplicates ids and rejects unsafe or inconsistent forms', () => {
    expect(
      settingsFromForm(form({ reviewerRoles: ' group-a, group-a , group-b ' }))?.reviewerRoles,
    ).toEqual(['group-a', 'group-b']);
    expect(settingsFromForm(form({ watchedProjects: '' }))).toBeNull();
    expect(settingsFromForm(form({ perIssueCap: '0' }))).toBeNull();
    expect(settingsFromForm(form({ aiEnabled: 'ON', perIssueCap: 'nonsense' }))).toBeNull();
    expect(settingsFromForm(form({ writeBackEnabled: 'ON', visibilityChosen: 'OFF' }))).toBeNull();
    expect(
      settingsFromForm(form({ commentVisibility: 'GROUP', commentVisibilityRef: '' })),
    ).toBeNull();
    expect(settingsFromForm(form({ ruleSetStatus: 'APPROVED' as 'UNREVIEWED' }))).toBeNull();
  });
});
