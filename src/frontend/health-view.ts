/**
 * P10.A2 — pure admin Health view model (Arch §7, C-10.8, N-09, I-5/I-6).
 * It accepts only a resolver envelope and rebuilds the snapshot field by field:
 * unknown fields (quotes, record text, account ids) cannot survive into the UI.
 * All human strings are fixed and carry the decision-support notice.
 */

import type { ResolverEnvelope } from '../contracts/envelope';
import { SCAN_STATUSES, type ScanStatus } from '../contracts/scan';
import { VALIDATION_STATUSES, type ValidationStatus } from '../contracts/evidence';
import { RULE_STATUSES } from '../contracts/deadlines';
import {
  HEALTH_BREAKER_STATES,
  HEALTH_HASH_KEY_STATUSES,
  HEALTH_SCAN_RESULTS,
  type HealthBreakerState,
  type HealthHashKeyStatus,
  type HealthRuleSetStatus,
  type HealthScanResult,
  type HealthSnapshot,
} from '../services/health';

export const HEALTH_UI_STRINGS = Object.freeze({
  title: 'Health',
  notice: 'Decision support, not a regulatory determination or legal advice.',
  idle: 'Health data has not been loaded yet.',
  ready: 'Health data from the last 7 days.',
  unavailable: 'Health data is not available on this installation.',
  error: 'The health data could not be loaded.',
  dependencyFailed: 'Health data could not be read because a required source was unavailable.',
  fields: Object.freeze({
    scans: 'Scans by status and result',
    evidence: 'Evidence validation',
    writeback: 'Write-back',
    ai: 'AI screening',
    ruleSet: 'Rule set',
    reconciler: 'Last reconciler run',
    capsHit: 'Caps hit',
    none: 'Not recorded',
  }),
});

export interface HealthViewModel {
  readonly kind: 'IDLE' | 'READY' | 'UNAVAILABLE' | 'ERROR';
  readonly message: string;
  readonly notice: string;
  readonly snapshot: HealthSnapshot | null;
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const VERSION_CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

const code = (value: unknown, allowed: readonly string[]): string =>
  typeof value === 'string' && allowed.includes(value) ? value : '';

const versionCode = (value: unknown): string =>
  typeof value === 'string' && VERSION_CODE.test(value) ? value : '';

const timestamp = (value: unknown): string | null =>
  typeof value === 'string' && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
    ? value
    : null;

const fixedCounts = (raw: unknown, keys: readonly string[]): Readonly<Record<string, number>> => {
  const source = isRecord(raw) ? raw : {};
  const result: Record<string, number> = {};
  for (const key of keys) result[key] = count(source[key]);
  return result;
};

/**
 * Rebuild a snapshot from known fields only. Unknown keys and unknown code
 * values are discarded rather than displayed, following scan-view and
 * decision-view (I-1/I-6).
 */
function narrowSnapshot(raw: unknown): HealthSnapshot | null {
  if (!isRecord(raw)) return null;
  const ai = isRecord(raw.ai) ? raw.ai : {};
  return {
    windowDays: count(raw.windowDays),
    scansByStatus: fixedCounts(raw.scansByStatus, SCAN_STATUSES) as Readonly<
      Record<ScanStatus, number>
    >,
    scansByResult: fixedCounts(raw.scansByResult, HEALTH_SCAN_RESULTS) as Readonly<
      Record<HealthScanResult, number>
    >,
    stalledScans: count(raw.stalledScans),
    deferredCount: count(raw.deferredCount),
    evidenceStateCounts: fixedCounts(raw.evidenceStateCounts, VALIDATION_STATUSES) as Readonly<
      Record<ValidationStatus, number>
    >,
    writebackPending: count(raw.writebackPending),
    writebackFailed: count(raw.writebackFailed),
    lastReconcilerAt: timestamp(raw.lastReconcilerAt),
    capsHit: count(raw.capsHit),
    ruleSetVersion: versionCode(raw.ruleSetVersion),
    ruleSetStatus: (code(raw.ruleSetStatus, [...RULE_STATUSES, 'UNKNOWN']) ||
      'UNKNOWN') as HealthRuleSetStatus,
    hashKeyStatus: (code(raw.hashKeyStatus, HEALTH_HASH_KEY_STATUSES) ||
      'UNKNOWN') as HealthHashKeyStatus,
    ai: {
      issueCalls: count(ai.issueCalls),
      siteCalls: count(ai.siteCalls),
      perIssueCap: count(ai.perIssueCap),
      perSiteCap: count(ai.perSiteCap),
      breakerState: (code(ai.breakerState, HEALTH_BREAKER_STATES) ||
        'UNKNOWN') as HealthBreakerState,
    },
  };
}

const empty = (kind: HealthViewModel['kind'], message: string): HealthViewModel => ({
  kind,
  message,
  notice: HEALTH_UI_STRINGS.notice,
  snapshot: null,
});

export function healthViewModel(envelope: ResolverEnvelope<unknown> | null): HealthViewModel {
  if (envelope === null) return empty('IDLE', HEALTH_UI_STRINGS.idle);
  if (envelope.code === 'NOT_FOUND' || envelope.code === 'NOT_PERMITTED') {
    return empty('UNAVAILABLE', HEALTH_UI_STRINGS.unavailable);
  }
  if (envelope.code === 'DEPENDENCY_FAILED') {
    return empty('ERROR', HEALTH_UI_STRINGS.dependencyFailed);
  }
  if (envelope.code !== 'OK') return empty('ERROR', HEALTH_UI_STRINGS.error);
  const snapshot = narrowSnapshot(envelope.data);
  if (snapshot === null) return empty('ERROR', HEALTH_UI_STRINGS.error);
  return {
    kind: 'READY',
    message: HEALTH_UI_STRINGS.ready,
    notice: HEALTH_UI_STRINGS.notice,
    snapshot,
  };
}
