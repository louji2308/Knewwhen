/**
 * P10.A1 — the complete admin settings contract, validation and persistence
 * port (C-10.1–5, WF-2, WF-11, AGENTS §5.5). Pure: KVS persistence is injected.
 *
 * The code ceiling below is an engineering limit recorded as D-017, not a
 * regulatory value. No rule content is invented here; the rule-set fields are
 * opaque version/status labels supplied by the reviewed rule-data adapter.
 */

import type { AuditEvent } from '../handlers/authorisation';
import { auditSettingsChange, validateSettings, type SettingsV1 } from './settings';

export const ADMIN_CAP_CEILING = 1000;

/** Bound on opaque identifiers and the routing label (C-10.1, I-6). */
const MAX_PRINTABLE_LENGTH = 128;
/** Jira project keys: the same shape the Jira client and admin handler use. */
const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,19}$/u;
/** Opaque ids are references, never record text: no whitespace or separators beyond these. */
const OPAQUE_ID = /^[A-Za-z0-9_.:-]{1,128}$/u;
/** Rule-set versions are code labels, not prose; the UI shows at most 64 chars. */
const VERSION_CODE = /^[A-Za-z0-9_.:-]{1,64}$/u;

export const RULE_SET_STATUSES = Object.freeze(['UNREVIEWED', 'PREVIEW', 'REVIEWED'] as const);
export type RuleSetStatus = (typeof RULE_SET_STATUSES)[number];

export const COMMENT_VISIBILITIES = Object.freeze(['NONE', 'PROJECT_ROLE', 'GROUP'] as const);
export type CommentVisibility = (typeof COMMENT_VISIBILITIES)[number];

export const PRODUCT_IDENTITY_KINDS = Object.freeze([
  'COMPONENT',
  'LABEL_PREFIX',
  'NAMED_FIELD',
] as const);
export type ProductIdentityKind = (typeof PRODUCT_IDENTITY_KINDS)[number];

export interface ProductIdentity {
  readonly kind: ProductIdentityKind;
  /** A label prefix, component name or field key. Never record text. */
  readonly value: string;
}

export interface AdminSettings {
  readonly version: 1;
  readonly watchedProjects: readonly string[];
  readonly issueTypeExclusions: readonly string[];
  readonly productIdentity: ProductIdentity | null;
  readonly reviewerRoles: readonly string[];
  readonly qualifiedRoles: readonly string[];
  readonly aiEnabled: boolean;
  readonly killSwitch: boolean;
  readonly perIssueCap: number;
  readonly perSiteCap: number;
  readonly writeBackEnabled: boolean;
  readonly commentVisibility: CommentVisibility;
  readonly commentVisibilityRef: string | null;
  /** Configured routing label (WF-11). Empty is the first-run state. */
  readonly routingLabel: string;
  readonly visibilityChosen: boolean;
  readonly ruleSetVersion: string;
  readonly ruleSetStatus: RuleSetStatus;
}

/** First-run fail-closed defaults (Arch §13.1, C-10.2). */
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = Object.freeze({
  version: 1,
  watchedProjects: Object.freeze([]),
  issueTypeExclusions: Object.freeze([]),
  productIdentity: null,
  reviewerRoles: Object.freeze([]),
  qualifiedRoles: Object.freeze([]),
  aiEnabled: false,
  killSwitch: false,
  perIssueCap: 0,
  perSiteCap: 0,
  writeBackEnabled: false,
  commentVisibility: 'NONE',
  commentVisibilityRef: null,
  routingLabel: '',
  visibilityChosen: false,
  ruleSetVersion: 'UNKNOWN',
  ruleSetStatus: 'UNREVIEWED',
});

export type AdminValidationCode =
  | 'OK'
  | 'BAD_VERSION'
  | 'NO_WATCHED_PROJECT'
  | 'INVALID_CAP'
  | 'CAP_ABOVE_CEILING'
  | 'WRITE_BACK_NO_VISIBILITY'
  | 'VISIBILITY_MISMATCH'
  | 'MISSING_VISIBILITY_REF'
  | 'INVALID_PRODUCT_IDENTITY'
  | 'INVALID_ROUTING_LABEL'
  | 'INVALID_IDENTIFIER'
  | 'DUPLICATE_IDENTIFIER'
  | 'BAD_RULE_SET_STATUS'
  | 'BAD_RULE_SET_VERSION'
  | 'AUDIT_FAILED';

export type AdminValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly code: AdminValidationCode };

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const exactKeys = (
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
};

/**
 * Printable means no C0/C1 control characters and no DEL. The bound counts
 * UTF-16 code units, matching the form's 128-character input limit (WF-11).
 */
const isBoundedPrintable = (value: string): boolean =>
  value.length <= MAX_PRINTABLE_LENGTH &&
  [...value].every((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0x20 && code !== 0x7f && (code < 0x80 || code > 0x9f);
  });

const isProjectKey = (value: string): boolean => PROJECT_KEY.test(value);
const isOpaqueId = (value: string): boolean => OPAQUE_ID.test(value);

/** Identifiers must be bounded, well-shaped and unique (no duplicate grants). */
function boundedIdList(
  value: unknown,
  pattern: (id: string) => boolean,
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && pattern(item)) &&
    new Set(value).size === value.length
  );
}

const hasDuplicates = (values: readonly string[]): boolean =>
  new Set(values).size !== values.length;

function parseProductIdentity(value: unknown): ProductIdentity | null | undefined {
  if (value === null) return null;
  if (!isRecord(value) || !exactKeys(value, ['kind', 'value'])) return undefined;
  const { kind, value: name } = value;
  if (typeof name !== 'string' || !isBoundedPrintable(name)) return undefined;
  if (typeof kind !== 'string' || !PRODUCT_IDENTITY_KINDS.some((item) => item === kind)) {
    return undefined;
  }
  return { kind: kind as ProductIdentityKind, value: name };
}

/** Strict boundary parser: a payload cannot smuggle a role or arbitrary field. */
export function parseAdminSettings(raw: unknown): AdminSettings | null {
  if (!isRecord(raw)) return null;
  const keys = [
    'version',
    'watchedProjects',
    'issueTypeExclusions',
    'productIdentity',
    'reviewerRoles',
    'qualifiedRoles',
    'aiEnabled',
    'killSwitch',
    'perIssueCap',
    'perSiteCap',
    'writeBackEnabled',
    'commentVisibility',
    'commentVisibilityRef',
    'routingLabel',
    'visibilityChosen',
    'ruleSetVersion',
    'ruleSetStatus',
  ];
  if (!exactKeys(raw, keys)) return null;

  const identity = parseProductIdentity(raw.productIdentity);
  if (
    raw.version !== 1 ||
    identity === undefined ||
    !boundedIdList(raw.watchedProjects, isProjectKey) ||
    !boundedIdList(raw.issueTypeExclusions, isOpaqueId) ||
    !boundedIdList(raw.reviewerRoles, isOpaqueId) ||
    !boundedIdList(raw.qualifiedRoles, isOpaqueId) ||
    typeof raw.routingLabel !== 'string' ||
    !isBoundedPrintable(raw.routingLabel) ||
    typeof raw.aiEnabled !== 'boolean' ||
    typeof raw.killSwitch !== 'boolean' ||
    typeof raw.perIssueCap !== 'number' ||
    typeof raw.perSiteCap !== 'number' ||
    typeof raw.writeBackEnabled !== 'boolean' ||
    typeof raw.visibilityChosen !== 'boolean' ||
    typeof raw.ruleSetVersion !== 'string' ||
    !VERSION_CODE.test(raw.ruleSetVersion) ||
    typeof raw.ruleSetStatus !== 'string' ||
    !RULE_SET_STATUSES.some((status) => status === raw.ruleSetStatus) ||
    typeof raw.commentVisibility !== 'string' ||
    !COMMENT_VISIBILITIES.some((visibility) => visibility === raw.commentVisibility) ||
    (raw.commentVisibilityRef !== null &&
      (typeof raw.commentVisibilityRef !== 'string' || !isOpaqueId(raw.commentVisibilityRef)))
  ) {
    return null;
  }

  return {
    version: 1,
    watchedProjects: [...raw.watchedProjects],
    issueTypeExclusions: [...raw.issueTypeExclusions],
    productIdentity: identity,
    reviewerRoles: [...raw.reviewerRoles],
    qualifiedRoles: [...raw.qualifiedRoles],
    aiEnabled: raw.aiEnabled,
    killSwitch: raw.killSwitch,
    perIssueCap: raw.perIssueCap,
    perSiteCap: raw.perSiteCap,
    writeBackEnabled: raw.writeBackEnabled,
    commentVisibility: raw.commentVisibility as CommentVisibility,
    commentVisibilityRef: raw.commentVisibilityRef as string | null,
    routingLabel: raw.routingLabel,
    visibilityChosen: raw.visibilityChosen,
    ruleSetVersion: raw.ruleSetVersion,
    ruleSetStatus: raw.ruleSetStatus as RuleSetStatus,
  };
}

export function validateAdminSettings(settings: AdminSettings): AdminValidationResult {
  if (settings.version !== 1) return { ok: false, code: 'BAD_VERSION' };
  if (settings.watchedProjects.length === 0) return { ok: false, code: 'NO_WATCHED_PROJECT' };
  if (
    !Number.isInteger(settings.perIssueCap) ||
    !Number.isInteger(settings.perSiteCap) ||
    settings.perIssueCap < 1 ||
    settings.perSiteCap < 1
  ) {
    return { ok: false, code: 'INVALID_CAP' };
  }
  if (settings.perIssueCap > ADMIN_CAP_CEILING || settings.perSiteCap > ADMIN_CAP_CEILING) {
    return { ok: false, code: 'CAP_ABOVE_CEILING' };
  }
  if (!isBoundedPrintable(settings.routingLabel)) {
    return { ok: false, code: 'INVALID_ROUTING_LABEL' };
  }
  if (
    settings.watchedProjects.some((id) => !isProjectKey(id)) ||
    settings.issueTypeExclusions.some((id) => !isOpaqueId(id)) ||
    settings.reviewerRoles.some((id) => !isOpaqueId(id)) ||
    settings.qualifiedRoles.some((id) => !isOpaqueId(id)) ||
    (settings.commentVisibilityRef !== null && !isOpaqueId(settings.commentVisibilityRef))
  ) {
    return { ok: false, code: 'INVALID_IDENTIFIER' };
  }
  if (
    hasDuplicates(settings.watchedProjects) ||
    hasDuplicates(settings.issueTypeExclusions) ||
    hasDuplicates(settings.reviewerRoles) ||
    hasDuplicates(settings.qualifiedRoles)
  ) {
    return { ok: false, code: 'DUPLICATE_IDENTIFIER' };
  }
  // The specific no-visibility case must be reachable before the general
  // mismatch, otherwise it is masked by VISIBILITY_MISMATCH (C-10.4).
  if (
    settings.writeBackEnabled &&
    settings.commentVisibility === 'NONE' &&
    !settings.visibilityChosen
  ) {
    return { ok: false, code: 'WRITE_BACK_NO_VISIBILITY' };
  }
  const visibilityMatches = settings.visibilityChosen === (settings.commentVisibility !== 'NONE');
  if (!visibilityMatches) return { ok: false, code: 'VISIBILITY_MISMATCH' };
  if (settings.commentVisibility !== 'NONE' && settings.commentVisibilityRef === null) {
    return { ok: false, code: 'MISSING_VISIBILITY_REF' };
  }
  if (settings.productIdentity !== null && !isBoundedPrintable(settings.productIdentity.value)) {
    return { ok: false, code: 'INVALID_PRODUCT_IDENTITY' };
  }
  if (!RULE_SET_STATUSES.some((status) => status === settings.ruleSetStatus)) {
    return { ok: false, code: 'BAD_RULE_SET_STATUS' };
  }
  if (!VERSION_CODE.test(settings.ruleSetVersion)) {
    return { ok: false, code: 'BAD_RULE_SET_VERSION' };
  }
  return validateSettings(toSettingsV1(settings));
}

export function toSettingsV1(settings: AdminSettings): SettingsV1 {
  return {
    version: 1,
    watchedProjects: settings.watchedProjects,
    reviewerRoles: settings.reviewerRoles,
    qualifiedRoles: settings.qualifiedRoles,
    writeBackEnabled: settings.writeBackEnabled,
    visibilityChosen: settings.visibilityChosen,
    aiEnabled: settings.aiEnabled,
    killSwitch: settings.killSwitch,
  };
}

export interface AdminSettingsStore {
  get(): Promise<AdminSettings | null>;
  set(settings: AdminSettings): Promise<void>;
}

/** The sink may be asynchronous; persistence must not race it (I-8). */
export type AuditCodeSink = (event: AuditEvent) => void | Promise<void>;

export type SaveAdminResult =
  | { readonly ok: true; readonly settings: AdminSettings }
  | { readonly ok: false; readonly code: AdminValidationCode };

/**
 * Read with a fail-closed default. A missing store row is a first-run state,
 * not an invented configuration (Arch §13.1).
 */
export async function readAdminSettings(store: AdminSettingsStore): Promise<AdminSettings> {
  const stored = await store.get();
  if (stored === null) return DEFAULT_ADMIN_SETTINGS;
  // A stored row is untrusted input: re-apply the boundary so an older or
  // oversized value can never be echoed and saved back truncated (I-6).
  return parseAdminSettings(stored) ?? DEFAULT_ADMIN_SETTINGS;
}

const sameIds = (before: readonly string[], after: readonly string[]): boolean =>
  before.length === after.length && before.every((id, index) => id === after[index]);

/**
 * Validate, await one code-only audit event, then persist exactly once.
 * An identical save is a no-op: no NO_OP audit row and no store write (I-8).
 */
export async function saveAdminSettings(
  store: AdminSettingsStore,
  next: AdminSettings,
  sink: AuditCodeSink,
): Promise<SaveAdminResult> {
  const validated = validateAdminSettings(next);
  if (!validated.ok) return validated;

  const before = await readAdminSettings(store);
  const codes = new Set<string>();
  auditSettingsChange(toSettingsV1(before), toSettingsV1(next), (event) => {
    if (event.errorCode !== 'NO_OP') codes.add(event.errorCode);
  });

  // The shared helper compares list lengths only; compare values here so a
  // same-length substitution is still a real, audited change.
  if (!sameIds(before.watchedProjects, next.watchedProjects)) codes.add('PROJECTS');
  if (!sameIds(before.issueTypeExclusions, next.issueTypeExclusions)) {
    codes.add('ISSUE_TYPE_EXCLUSIONS');
  }
  if (!sameIds(before.reviewerRoles, next.reviewerRoles)) codes.add('REVIEWER_ROLES');
  if (!sameIds(before.qualifiedRoles, next.qualifiedRoles)) codes.add('QUALIFIED_ROLES');
  if (before.perIssueCap !== next.perIssueCap || before.perSiteCap !== next.perSiteCap) {
    codes.add('CAPS');
  }
  if (
    before.commentVisibility !== next.commentVisibility ||
    before.commentVisibilityRef !== next.commentVisibilityRef
  ) {
    codes.add('VISIBILITY_REF');
  }
  if (
    before.productIdentity?.kind !== next.productIdentity?.kind ||
    before.productIdentity?.value !== next.productIdentity?.value
  ) {
    codes.add('PRODUCT_IDENTITY');
  }
  if (
    before.ruleSetVersion !== next.ruleSetVersion ||
    before.ruleSetStatus !== next.ruleSetStatus
  ) {
    codes.add('RULE_SET');
  }
  if (before.routingLabel !== next.routingLabel) codes.add('ROUTING_LABEL');

  if (codes.size === 0) return { ok: true, settings: next };

  try {
    await sink({
      actionCode: 'SETTINGS_CHANGED',
      errorCode: [...codes].join('|'),
    });
  } catch {
    return { ok: false, code: 'AUDIT_FAILED' };
  }
  await store.set(next);
  return { ok: true, settings: next };
}
