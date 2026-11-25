/**
 * P10.A1–A3 — the gated admin resolver slice (C-10.1–8, C-08.1, I-4, I-6).
 * Every action goes through the single ADMIN_SETTINGS matrix entry. Ports are
 * injected; with no port the registry returns an honest NOT_FOUND envelope.
 * Only counts, bounded identifiers and fixed codes leave this boundary.
 */

import type { Action } from '../contracts/authorisation';
import type { ResolverEnvelope } from '../contracts/envelope';
import {
  ADMIN_CAP_CEILING,
  parseAdminSettings,
  readAdminSettings,
  saveAdminSettings,
  type AdminSettings,
  type AdminSettingsStore,
} from '../services/admin-settings';
import { parseHealthSnapshot } from '../services/health';
import type { AuditSink, GatedHandler } from './authorisation';

export const ADMIN_PAYLOAD_ACTIONS = Object.freeze([
  'GET_SETTINGS',
  'SAVE_SETTINGS',
  'LOAD_SAMPLE',
  'GET_HEALTH',
] as const);
export type AdminPayloadAction = (typeof ADMIN_PAYLOAD_ACTIONS)[number];

export interface AdminHandlerDependencies {
  readonly settingsStore?: AdminSettingsStore;
  readonly loadSample?: (projectKey: string, accountId: string) => Promise<unknown>;
  readonly health?: () => Promise<unknown>;
  readonly recordAudit?: AuditSink;
}

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

function envelope<T>(
  data: T | null,
  role: string,
  code: ResolverEnvelope<T>['code'],
): ResolverEnvelope<T> {
  return {
    data,
    roleHint: role,
    correlationId: globalThis.crypto.randomUUID(),
    code,
  };
}

function parseAdminPayload(raw: unknown): {
  readonly action: AdminPayloadAction;
  readonly settings?: unknown;
  readonly projectKey?: string;
} | null {
  if (!isRecord(raw)) return null;
  const known = ADMIN_PAYLOAD_ACTIONS.find((candidate) => candidate === raw.action);
  if (known === undefined) return null;
  if (known === 'GET_SETTINGS' || known === 'GET_HEALTH') {
    return exactKeys(raw, ['action']) ? { action: known } : null;
  }
  if (known === 'LOAD_SAMPLE') {
    return exactKeys(raw, ['action', 'projectKey']) && typeof raw.projectKey === 'string'
      ? { action: known, projectKey: raw.projectKey }
      : null;
  }
  return exactKeys(raw, ['action', 'settings']) ? { action: known, settings: raw.settings } : null;
}

const PROJECT_KEY = /^[A-Z][A-Z0-9_]{0,19}$/u;
const ISSUE_KEY = /^[A-Z][A-Z0-9_]{0,19}-\d+$/u;

function safeCount(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeKeys(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && ISSUE_KEY.test(item));
}

interface SamplePortResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly createdCount?: number;
  readonly totalCreatedCount?: number;
  readonly csvRecordCount?: number;
  readonly remainingCount?: number;
  readonly issueKeys?: readonly string[];
}

const SAMPLE_SUCCESS_KEYS = Object.freeze([
  'ok',
  'createdCount',
  'totalCreatedCount',
  'csvRecordCount',
  'issueKeys',
]);
const SAMPLE_FAILURE_KEYS = Object.freeze([
  'ok',
  'code',
  'createdCount',
  'totalCreatedCount',
  'remainingCount',
  'issueKeys',
]);
const SAMPLE_CODES = Object.freeze([
  'INVALID_REQUEST',
  'PROJECT_NOT_WATCHED',
  'ALREADY_LOADED',
  'DEPENDENCY_FAILED',
  'PARTIAL_LOAD',
] as const);

/** Rebuild only count/key/code fields; fixture prose can never cross here. */
function parseSampleResult(raw: unknown): SamplePortResult | null {
  if (!isRecord(raw) || typeof raw.ok !== 'boolean') return null;
  // Failure results may carry only a code (for example ALREADY_LOADED);
  // count and key fields are optional, but no unknown field can cross here.
  const allowed = raw.ok ? SAMPLE_SUCCESS_KEYS : SAMPLE_FAILURE_KEYS;
  if (!Object.keys(raw).every((key) => allowed.some((candidate) => candidate === key))) {
    return null;
  }
  if (!raw.ok) {
    if (typeof raw.code !== 'string' || !SAMPLE_CODES.some((code) => code === raw.code)) {
      return null;
    }
  }
  for (const key of ['createdCount', 'totalCreatedCount', 'csvRecordCount', 'remainingCount']) {
    if (key in raw && !Number.isSafeInteger(raw[key])) return null;
  }
  if ('issueKeys' in raw && !Array.isArray(raw.issueKeys)) return null;
  return {
    ok: raw.ok,
    ...(typeof raw.code === 'string' ? { code: raw.code } : {}),
    ...('createdCount' in raw ? { createdCount: safeCount(raw.createdCount) } : {}),
    ...('totalCreatedCount' in raw ? { totalCreatedCount: safeCount(raw.totalCreatedCount) } : {}),
    ...('csvRecordCount' in raw ? { csvRecordCount: safeCount(raw.csvRecordCount) } : {}),
    ...('remainingCount' in raw ? { remainingCount: safeCount(raw.remainingCount) } : {}),
    ...('issueKeys' in raw ? { issueKeys: safeKeys(raw.issueKeys) } : {}),
  };
}

interface SampleViewData {
  readonly projectKey: string;
  readonly sampleCount: number;
  readonly csvIssueCount: number;
  readonly csvRowCount: number;
  readonly createdKeys: readonly string[];
  readonly complete: boolean;
  readonly resultCode: string;
}

function sampleViewData(projectKey: string, result: SamplePortResult): SampleViewData {
  return {
    projectKey,
    sampleCount: result.totalCreatedCount ?? result.createdCount ?? 0,
    csvIssueCount: result.createdCount ?? 0,
    csvRowCount: result.csvRecordCount ?? 0,
    createdKeys: result.issueKeys ?? [],
    complete: result.ok || result.code !== 'PARTIAL_LOAD',
    resultCode: result.code ?? 'OK',
  };
}

/** Settings cross the resolver boundary as a fixed view shape, never raw JSON. */
function settingsViewData(settings: AdminSettings): Readonly<Record<string, unknown>> {
  const identity = settings.productIdentity;
  return {
    watchedProjects: settings.watchedProjects,
    issueTypeExclusions: settings.issueTypeExclusions,
    reviewerRoles: settings.reviewerRoles,
    qualifiedRoles: settings.qualifiedRoles,
    aiEnabled: settings.aiEnabled,
    killSwitch: settings.killSwitch,
    writeBackEnabled: settings.writeBackEnabled,
    visibilityChosen: settings.visibilityChosen,
    commentVisibility: settings.commentVisibility,
    commentVisibilityRef: settings.commentVisibilityRef,
    routingLabel: settings.routingLabel,
    ruleSetVersion: settings.ruleSetVersion,
    ruleSetStatus: settings.ruleSetStatus,
    productIdentity: identity === null ? '' : `${identity.kind}:${identity.value}`,
    productIdentityKind: identity?.kind ?? '',
    productIdentityValue: identity?.value ?? '',
    caps: {
      perIssue: settings.perIssueCap,
      perSite: settings.perSiteCap,
      ceiling: ADMIN_CAP_CEILING,
    },
    canSave: true,
  };
}

/** Returns only the actions for which a live port was actually supplied. */
export function createAdminHandlers(
  deps: AdminHandlerDependencies,
): Partial<Record<Action, GatedHandler>> {
  const handlers: Partial<Record<Action, GatedHandler>> = {};
  if (
    deps.settingsStore === undefined &&
    deps.loadSample === undefined &&
    deps.health === undefined
  ) {
    return handlers;
  }

  handlers.ADMIN_SETTINGS = async (_context, decision, raw) => {
    const payload = parseAdminPayload(raw);
    if (payload === null) return envelope(null, decision.role, 'INVALID_REQUEST');

    if (payload.action === 'GET_SETTINGS') {
      if (deps.settingsStore === undefined) return envelope(null, decision.role, 'NOT_FOUND');
      try {
        return envelope(
          settingsViewData(await readAdminSettings(deps.settingsStore)),
          decision.role,
          'OK',
        );
      } catch {
        return envelope(null, decision.role, 'DEPENDENCY_FAILED');
      }
    }

    if (payload.action === 'SAVE_SETTINGS') {
      if (deps.settingsStore === undefined) return envelope(null, decision.role, 'NOT_FOUND');
      const settings = parseAdminSettings(payload.settings);
      if (settings === null) return envelope(null, decision.role, 'INVALID_REQUEST');
      try {
        const saved = await saveAdminSettings(deps.settingsStore, settings, (event) =>
          deps.recordAudit?.({ ...event, actorAccountId: _context.accountId }),
        );
        if (!saved.ok) {
          return envelope(
            null,
            decision.role,
            saved.code === 'AUDIT_FAILED' ? 'DEPENDENCY_FAILED' : 'INVALID_REQUEST',
          );
        }
        return envelope(settingsViewData(saved.settings), decision.role, 'OK');
      } catch {
        return envelope(null, decision.role, 'DEPENDENCY_FAILED');
      }
    }

    if (payload.action === 'LOAD_SAMPLE') {
      if (
        deps.loadSample === undefined ||
        payload.projectKey === undefined ||
        !PROJECT_KEY.test(payload.projectKey)
      ) {
        return envelope(null, decision.role, 'INVALID_REQUEST');
      }
      try {
        const parsed = parseSampleResult(
          await deps.loadSample(payload.projectKey, _context.accountId),
        );
        if (parsed === null) return envelope(null, decision.role, 'DEPENDENCY_FAILED');
        const data = sampleViewData(payload.projectKey, parsed);
        if (!parsed.ok && parsed.code === 'PARTIAL_LOAD') {
          return envelope(data, decision.role, 'OK');
        }
        if (!parsed.ok) {
          const code =
            parsed.code === 'PROJECT_NOT_WATCHED'
              ? 'NOT_FOUND'
              : parsed.code === 'ALREADY_LOADED' || parsed.code === 'INVALID_REQUEST'
                ? 'INVALID_REQUEST'
                : 'DEPENDENCY_FAILED';
          return envelope(data, decision.role, code);
        }
        return envelope(data, decision.role, 'OK');
      } catch {
        return envelope(null, decision.role, 'DEPENDENCY_FAILED');
      }
    }

    if (deps.health === undefined) return envelope(null, decision.role, 'NOT_FOUND');
    try {
      const snapshot = parseHealthSnapshot(await deps.health());
      if (snapshot === null) return envelope(null, decision.role, 'DEPENDENCY_FAILED');
      return envelope(snapshot, decision.role, 'OK');
    } catch {
      return envelope(null, decision.role, 'DEPENDENCY_FAILED');
    }
  };

  return handlers;
}
