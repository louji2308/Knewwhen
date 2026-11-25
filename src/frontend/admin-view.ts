/**
 * P10.A1 — pure admin page view model (Arch §3, C-10.1–5/7, WF-2, WF-11).
 * The resolver envelope is narrowed field by field to a fixed shape. No
 * arbitrary field, settings prose or Jira record text can reach the UI, and
 * this module holds no authority: server validation still decides every save.
 */

import type { ResolverEnvelope } from '../contracts/envelope';
import { validateSettings, type SettingsV1 } from '../services/settings';

export const ADMIN_UI_STRINGS = Object.freeze({
  title: 'KnewWhen admin',
  notice: 'Decision support, not a regulatory determination or legal advice.',
  idle: 'Settings have not loaded yet.',
  ready: 'Settings are loaded.',
  unavailable: 'KnewWhen settings are not available on this site yet.',
  error: 'KnewWhen could not load settings. Try again.',
  denied: 'Only a Jira site admin can open this page.',
  disclosure:
    'When AI screening is on, the text of new or changed issues in watched projects is sent to the Atlassian-hosted model. Model input and output are not stored.',
  save: 'Save settings',
  cannotSave: 'Save is unavailable until the settings can be read.',
  getStarted: 'Get started',
  formHeading: 'Settings',
  saveSaved: 'Settings saved.',
  saveInvalid: 'The settings were not sent because one or more fields are not valid.',
  saveFailed: 'Settings could not be saved.',
  checklist: Object.freeze({
    watchedProjects: 'Watched projects',
    roles: 'Reviewers and Qualified persons',
    visibility: 'Summary-comment visibility',
    routingLabel: 'Routing label',
    ruleSetStatus: 'Rule-set status',
    aiScreening: 'AI screening',
    productIdentity: 'Product identity',
    panelPinned: 'KnewWhen panel on every issue',
  }),
  messages: Object.freeze({
    projectsDoneOne: 'Done (1 project)',
    projectsDoneMany: 'Done ({n} projects)',
    projectsMissing: 'Not set — KnewWhen checks nothing',
    rolesDone: 'Done',
    rolesMissing: 'Not set — case work is blocked',
    visibilityDone: 'Chosen',
    visibilityMissing: 'Not chosen — Jira write-back waits',
    routingMissing: 'Not set — Route is unavailable',
    ruleReviewed: 'FDA rule set {id} v{version}: Reviewed',
    rulePreview: 'FDA rule set {id} v{version}: Preview',
    ruleUnreviewed: 'FDA rule set {id} v{version}: Not reviewed',
    aiOff: 'Off (rule-based screening only)',
    aiOn: 'On · caps {perIssue}/{perSite}',
    aiStopped: 'Stopped (kill switch)',
    productDone: 'Product identity is set',
    productMissing: 'Not set — lookback does not check "same product"',
    panelManual:
      'Manual step — not checked by KnewWhen. In each watched project, open any issue, open the KnewWhen panel, then choose ⋯ → Show for all work items.',
  }),
});

export type AdminViewState = 'IDLE' | 'READY' | 'UNAVAILABLE' | 'ERROR';
export type GetStartedStepId =
  | 'WATCHED_PROJECTS'
  | 'ROLES'
  | 'COMMENT_VISIBILITY'
  | 'ROUTING_LABEL'
  | 'RULE_SET_STATUS'
  | 'AI_SCREENING'
  | 'PRODUCT_IDENTITY'
  | 'PANEL_PINNED';

export interface GetStartedStep {
  readonly id: GetStartedStepId;
  readonly label: string;
  readonly done: boolean;
  readonly message: string;
}

export interface AdminCapsView {
  readonly perIssue: number;
  readonly perSite: number;
  readonly ceiling: number;
}

export interface AdminSettingsView {
  readonly watchedProjects: readonly string[];
  readonly issueTypeExclusions: readonly string[];
  readonly reviewerRoles: readonly string[];
  readonly qualifiedRoles: readonly string[];
  readonly aiEnabled: boolean;
  readonly killSwitch: boolean;
  readonly writeBackEnabled: boolean;
  readonly visibilityChosen: boolean;
  readonly ruleSetVersion: string;
  readonly ruleSetStatus: string;
  readonly productIdentity: string;
  readonly productIdentityKind: string;
  readonly productIdentityValue: string;
  readonly routingLabel: string;
  readonly commentVisibility: string;
  readonly commentVisibilityRef: string;
  readonly caps: AdminCapsView;
  readonly canSave: boolean;
  readonly message: string;
}

export interface AdminViewModel extends AdminSettingsView {
  readonly state: AdminViewState;
  readonly getStarted: readonly GetStartedStep[];
}

type Data = Readonly<Record<string, unknown>>;

const RULE_STATUSES = Object.freeze(['REVIEWED', 'PREVIEW', 'UNREVIEWED'] as const);
const PRODUCT_KINDS = Object.freeze(['COMPONENT', 'LABEL_PREFIX', 'NAMED_FIELD'] as const);
const VISIBILITIES = Object.freeze(['NONE', 'PROJECT_ROLE', 'GROUP'] as const);

const record = (value: unknown): Data | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Data) : null;

/** Config ids and codes only: a newline or a control character is never shown. */
function safeText(value: unknown, maximum = 200): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) return '';
  return /[\u0000-\u001f\u007f]/u.test(value) ? '' : value;
}

function safeStrings(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = safeText(item);
    if (text !== '') out.push(text);
  }
  return out;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([a-zA-Z]+)\}/gu, (_match: string, key: string) => {
    const value = values[key];
    return value === undefined ? '' : String(value);
  });
}

function emptyView(message: string): AdminSettingsView {
  return {
    watchedProjects: [],
    issueTypeExclusions: [],
    reviewerRoles: [],
    qualifiedRoles: [],
    aiEnabled: false,
    killSwitch: false,
    writeBackEnabled: false,
    visibilityChosen: false,
    ruleSetVersion: '',
    ruleSetStatus: 'UNREVIEWED',
    productIdentity: '',
    productIdentityKind: '',
    productIdentityValue: '',
    routingLabel: '',
    commentVisibility: 'NONE',
    commentVisibilityRef: '',
    caps: { perIssue: 0, perSite: 0, ceiling: 0 },
    canSave: false,
    message,
  };
}

function narrow(data: Data, message: string): AdminSettingsView {
  const caps = record(data['caps']);
  const rawStatus = safeText(data['ruleSetStatus'], 32);
  const ruleSetStatus = RULE_STATUSES.includes(rawStatus as (typeof RULE_STATUSES)[number])
    ? rawStatus
    : 'UNREVIEWED';
  const rawKind = safeText(data['productIdentityKind'], 32);
  const productIdentityKind = PRODUCT_KINDS.includes(rawKind as (typeof PRODUCT_KINDS)[number])
    ? rawKind
    : '';
  const productIdentityValue = safeText(data['productIdentityValue'], 128);
  const rawVisibility = safeText(data['commentVisibility'], 32);
  const commentVisibility = VISIBILITIES.includes(rawVisibility as (typeof VISIBILITIES)[number])
    ? rawVisibility
    : 'NONE';
  const displayIdentity = safeText(data['productIdentity'], 128);
  return {
    watchedProjects: safeStrings(data['watchedProjects']),
    issueTypeExclusions: safeStrings(data['issueTypeExclusions']),
    reviewerRoles: safeStrings(data['reviewerRoles']),
    qualifiedRoles: safeStrings(data['qualifiedRoles']),
    aiEnabled: data['aiEnabled'] === true,
    killSwitch: data['killSwitch'] === true,
    writeBackEnabled: data['writeBackEnabled'] === true,
    visibilityChosen: data['visibilityChosen'] === true,
    ruleSetVersion: safeText(data['ruleSetVersion'], 64),
    ruleSetStatus,
    productIdentity:
      displayIdentity ||
      (productIdentityKind === '' || productIdentityValue === ''
        ? ''
        : `${productIdentityKind}:${productIdentityValue}`),
    productIdentityKind,
    productIdentityValue,
    routingLabel: safeText(data['routingLabel'], 128),
    commentVisibility,
    commentVisibilityRef: safeText(data['commentVisibilityRef'], 128),
    caps: {
      perIssue: count(caps?.['perIssue']),
      perSite: count(caps?.['perSite']),
      ceiling: count(caps?.['ceiling']),
    },
    canSave: data['canSave'] === true,
    message,
  };
}

/**
 * Fixed eight-step checklist from Workflow §8.1 and WF-2. Panel-pin state is
 * not in the settings envelope, so it is never guessed and stays a named manual
 * action. The routing label is checked only when the envelope provides one.
 */
export function getStartedSteps(view: AdminSettingsView): readonly GetStartedStep[] {
  const m = ADMIN_UI_STRINGS.messages;
  const projectsDone =
    view.watchedProjects.length === 1
      ? m.projectsDoneOne
      : fill(m.projectsDoneMany, { n: view.watchedProjects.length });
  const ruleTemplate =
    view.ruleSetStatus === 'REVIEWED'
      ? m.ruleReviewed
      : view.ruleSetStatus === 'PREVIEW'
        ? m.rulePreview
        : m.ruleUnreviewed;
  const aiDone =
    view.aiEnabled === false ||
    (view.killSwitch === false && view.caps.perIssue > 0 && view.caps.perSite > 0);
  const aiMessage = view.killSwitch
    ? m.aiStopped
    : view.aiEnabled
      ? fill(m.aiOn, { perIssue: view.caps.perIssue, perSite: view.caps.perSite })
      : m.aiOff;
  return [
    {
      id: 'WATCHED_PROJECTS',
      label: ADMIN_UI_STRINGS.checklist.watchedProjects,
      done: view.watchedProjects.length > 0,
      message: view.watchedProjects.length > 0 ? projectsDone : m.projectsMissing,
    },
    {
      id: 'ROLES',
      label: ADMIN_UI_STRINGS.checklist.roles,
      done: view.reviewerRoles.length > 0 && view.qualifiedRoles.length > 0,
      message:
        view.reviewerRoles.length > 0 && view.qualifiedRoles.length > 0
          ? m.rolesDone
          : m.rolesMissing,
    },
    {
      id: 'COMMENT_VISIBILITY',
      label: ADMIN_UI_STRINGS.checklist.visibility,
      done: view.visibilityChosen,
      message: view.visibilityChosen ? m.visibilityDone : m.visibilityMissing,
    },
    {
      id: 'ROUTING_LABEL',
      label: ADMIN_UI_STRINGS.checklist.routingLabel,
      done: view.routingLabel !== '',
      message: view.routingLabel === '' ? m.routingMissing : view.routingLabel,
    },
    {
      id: 'RULE_SET_STATUS',
      label: ADMIN_UI_STRINGS.checklist.ruleSetStatus,
      done: view.ruleSetStatus === 'REVIEWED',
      message: fill(ruleTemplate, {
        id: view.ruleSetVersion === '' ? '-' : 'FDA',
        version: view.ruleSetVersion || '-',
      }),
    },
    {
      id: 'AI_SCREENING',
      label: ADMIN_UI_STRINGS.checklist.aiScreening,
      done: aiDone,
      message: aiMessage,
    },
    {
      id: 'PRODUCT_IDENTITY',
      label: ADMIN_UI_STRINGS.checklist.productIdentity,
      done: view.productIdentity !== '',
      message: view.productIdentity === '' ? m.productMissing : m.productDone,
    },
    {
      id: 'PANEL_PINNED',
      label: ADMIN_UI_STRINGS.checklist.panelPinned,
      done: false,
      message: m.panelManual,
    },
  ];
}

function messageFor(state: AdminViewState, code: string | undefined): string {
  switch (state) {
    case 'IDLE':
      return ADMIN_UI_STRINGS.idle;
    case 'READY':
      return ADMIN_UI_STRINGS.notice;
    case 'UNAVAILABLE':
      return ADMIN_UI_STRINGS.unavailable;
    case 'ERROR':
      return code === 'NOT_PERMITTED' ? ADMIN_UI_STRINGS.denied : ADMIN_UI_STRINGS.error;
  }
}

/** One envelope (or an explicit caller status) becomes one fixed view model. */
export function adminViewModel(
  envelope: ResolverEnvelope<unknown> | null,
  status?: AdminViewState,
): AdminViewModel {
  let state: AdminViewState =
    status ??
    (envelope === null
      ? 'IDLE'
      : envelope.code === 'OK'
        ? 'READY'
        : envelope.code === 'NOT_FOUND'
          ? 'UNAVAILABLE'
          : 'ERROR');
  if (state === 'READY' && envelope?.code !== 'OK') state = 'IDLE';
  const data = state === 'READY' ? record(envelope?.data) : null;
  const view =
    data === null
      ? emptyView(messageFor(state, envelope?.code))
      : narrow(data, messageFor(state, envelope?.code));
  return { ...view, state, getStarted: getStartedSteps(view) };
}

export interface AdminFormPatch {
  readonly watchedProjects?: readonly string[];
  readonly issueTypeExclusions?: readonly string[];
  readonly reviewerRoles?: readonly string[];
  readonly qualifiedRoles?: readonly string[];
  readonly writeBackEnabled?: boolean;
  readonly visibilityChosen?: boolean;
  readonly aiEnabled?: boolean;
  readonly killSwitch?: boolean;
  readonly perIssueCap?: number;
  readonly perSiteCap?: number;
}

export type AdminValidationCode =
  | 'OK'
  | 'WRITE_BACK_NO_VISIBILITY'
  | 'NO_WATCHED_PROJECT'
  | 'BAD_VERSION'
  | 'INVALID_CEILING'
  | 'INVALID_CAP'
  | 'NEGATIVE_CAP'
  | 'CAP_OVER_CEILING';

export type AdminValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly code: AdminValidationCode };

/**
 * Courtesy check for the form. It calls the shared settings validator for the
 * fields it owns, then checks the caps against the code ceiling supplied by
 * the resolver. The server gate remains authoritative (C-10.4, I-4).
 */
export function validateAdminForm(
  view: AdminSettingsView,
  patch: AdminFormPatch,
): AdminValidationResult {
  const ceiling = view.caps.ceiling;
  if (!Number.isSafeInteger(ceiling) || ceiling <= 0) {
    return { ok: false, code: 'INVALID_CEILING' };
  }
  const caps = [patch.perIssueCap ?? view.caps.perIssue, patch.perSiteCap ?? view.caps.perSite];
  for (const cap of caps) {
    if (!Number.isSafeInteger(cap)) return { ok: false, code: 'INVALID_CAP' };
    if (cap < 1) return { ok: false, code: 'NEGATIVE_CAP' };
    if (cap > ceiling) return { ok: false, code: 'CAP_OVER_CEILING' };
  }
  const settings: SettingsV1 = {
    version: 1,
    watchedProjects: patch.watchedProjects ?? view.watchedProjects,
    reviewerRoles: patch.reviewerRoles ?? view.reviewerRoles,
    qualifiedRoles: patch.qualifiedRoles ?? view.qualifiedRoles,
    writeBackEnabled: patch.writeBackEnabled ?? view.writeBackEnabled,
    visibilityChosen: patch.visibilityChosen ?? view.visibilityChosen,
    aiEnabled: patch.aiEnabled ?? view.aiEnabled,
    killSwitch: patch.killSwitch ?? view.killSwitch,
  };
  return validateSettings(settings);
}
