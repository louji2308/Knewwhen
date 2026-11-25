/**
 * P10 — pure translation between the admin form and the strict settings
 * contract (C-10.1–5, WF-11, I-6). The form carries only printable strings;
 * the service parser and validator are the single authority on what may be
 * sent to the server. No record text or account id is stored here.
 */

import {
  COMMENT_VISIBILITIES,
  DEFAULT_ADMIN_SETTINGS,
  PRODUCT_IDENTITY_KINDS,
  RULE_SET_STATUSES,
  parseAdminSettings,
  validateAdminSettings,
  type AdminSettings,
  type CommentVisibility,
  type ProductIdentityKind,
  type RuleSetStatus,
} from '../services/admin-settings';
import type { AdminSettingsView } from './admin-view';

export interface AdminFormState {
  readonly watchedProjects: string;
  readonly issueTypeExclusions: string;
  readonly reviewerRoles: string;
  readonly qualifiedRoles: string;
  readonly aiEnabled: 'ON' | 'OFF';
  readonly killSwitch: 'ON' | 'OFF';
  readonly writeBackEnabled: 'ON' | 'OFF';
  readonly visibilityChosen: 'ON' | 'OFF';
  readonly perIssueCap: string;
  readonly perSiteCap: string;
  readonly productIdentityKind: '' | ProductIdentityKind;
  readonly productIdentityValue: string;
  readonly commentVisibility: CommentVisibility;
  readonly commentVisibilityRef: string;
  readonly routingLabel: string;
  readonly ruleSetVersion: string;
  readonly ruleSetStatus: RuleSetStatus;
}

const list = (values: readonly string[]): string => values.join(', ');

const flag = (value: boolean): 'ON' | 'OFF' => (value ? 'ON' : 'OFF');

function ids(value: string): readonly string[] {
  const seen = new Set<string>();
  for (const item of value.split(/[,\n]/u)) {
    const id = item.trim();
    if (id !== '' && !seen.has(id)) seen.add(id);
  }
  return [...seen];
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | '' {
  return allowed.find((candidate) => candidate === value) ?? '';
}

/** Build a fresh form from a narrowed envelope; never reuse raw resolver data. */
export function formFromSettings(view: AdminSettingsView): AdminFormState {
  const kind = oneOf(view.productIdentityKind, PRODUCT_IDENTITY_KINDS);
  const visibility = oneOf(view.commentVisibility, COMMENT_VISIBILITIES);
  const status = oneOf(view.ruleSetStatus, RULE_SET_STATUSES);
  return {
    watchedProjects: list(view.watchedProjects),
    issueTypeExclusions: list(view.issueTypeExclusions),
    reviewerRoles: list(view.reviewerRoles),
    qualifiedRoles: list(view.qualifiedRoles),
    aiEnabled: flag(view.aiEnabled),
    killSwitch: flag(view.killSwitch),
    writeBackEnabled: flag(view.writeBackEnabled),
    visibilityChosen: flag(view.visibilityChosen),
    perIssueCap: String(view.caps.perIssue),
    perSiteCap: String(view.caps.perSite),
    productIdentityKind: kind,
    productIdentityValue:
      kind === ''
        ? ''
        : view.productIdentityValue === ''
          ? view.productIdentity
          : view.productIdentityValue,
    commentVisibility: visibility === '' ? 'NONE' : visibility,
    commentVisibilityRef: view.commentVisibilityRef,
    routingLabel: view.routingLabel,
    ruleSetVersion: view.ruleSetVersion || DEFAULT_ADMIN_SETTINGS.ruleSetVersion,
    ruleSetStatus: status === '' ? 'UNREVIEWED' : status,
  };
}

/**
 * Reject an unusable form locally instead of calling the gate. The strict
 * service parser is reused, so the UI cannot invent a settings shape.
 */
export function settingsFromForm(form: AdminFormState): AdminSettings | null {
  const kind = oneOf(form.productIdentityKind, PRODUCT_IDENTITY_KINDS);
  const identityValue = form.productIdentityValue.trim();
  const raw = {
    version: 1,
    watchedProjects: ids(form.watchedProjects),
    issueTypeExclusions: ids(form.issueTypeExclusions),
    productIdentity: kind === '' || identityValue === '' ? null : { kind, value: identityValue },
    reviewerRoles: ids(form.reviewerRoles),
    qualifiedRoles: ids(form.qualifiedRoles),
    aiEnabled: form.aiEnabled === 'ON',
    killSwitch: form.killSwitch === 'ON',
    perIssueCap: Number(form.perIssueCap),
    perSiteCap: Number(form.perSiteCap),
    writeBackEnabled: form.writeBackEnabled === 'ON',
    commentVisibility: form.commentVisibility,
    commentVisibilityRef:
      form.commentVisibilityRef.trim() === '' ? null : form.commentVisibilityRef.trim(),
    routingLabel: form.routingLabel,
    visibilityChosen: form.visibilityChosen === 'ON',
    ruleSetVersion: form.ruleSetVersion,
    ruleSetStatus: form.ruleSetStatus,
  };
  const parsed = parseAdminSettings(raw);
  if (parsed === null || !validateAdminSettings(parsed).ok) return null;
  return parsed;
}
