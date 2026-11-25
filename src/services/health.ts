/**
 * P10.A2 — bounded health snapshot for the admin Health view
 * (Arch §12, C-10.8, N-09, I-6). Pure: no @forge/* import, no live clock and
 * no randomness. The injected port is the only route to SQL or KVS; every call
 * carries an explicit limit no greater than HEALTH_QUERY_LIMIT. Only ids,
 * codes, counts and ISO timestamps cross this boundary — never record text,
 * account ids as display text or model I/O.
 */

import { SCAN_STATUSES, type ScanStatus } from '../contracts/scan';
import { VALIDATION_STATUSES, type ValidationStatus } from '../contracts/evidence';
import { RULE_STATUSES } from '../contracts/deadlines';

export const HEALTH_WINDOW_DAYS = 7;
export const HEALTH_QUERY_LIMIT = 100;

export const HEALTH_SCAN_RESULTS = Object.freeze([
  'SIGNAL',
  'NO_SIGNAL',
  'SKIPPED',
  'UNKNOWN',
] as const);
export type HealthScanResult = (typeof HEALTH_SCAN_RESULTS)[number];

export const HEALTH_BREAKER_STATES = Object.freeze(['OPEN', 'CLOSED', 'UNKNOWN'] as const);
export type HealthBreakerState = (typeof HEALTH_BREAKER_STATES)[number];

export const HEALTH_HASH_KEY_STATUSES = Object.freeze(['PRESENT', 'MISSING', 'UNKNOWN'] as const);
export type HealthHashKeyStatus = (typeof HEALTH_HASH_KEY_STATUSES)[number];

export type HealthRuleSetStatus = (typeof RULE_STATUSES)[number] | 'UNKNOWN';

/** Fixed counter names. Any other key from the port is dropped. */
export const HEALTH_COUNTER_KEYS = Object.freeze({
  issueCalls: 'AI_ISSUE_CALLS',
  siteCalls: 'AI_SITE_CALLS',
  perIssueCap: 'AI_PER_ISSUE_CAP',
  perSiteCap: 'AI_PER_SITE_CAP',
  breakerState: 'AI_BREAKER_STATE',
  capsHit: 'CAPS_HIT',
  ruleSetVersion: 'RULE_SET_VERSION',
  ruleSetStatus: 'RULE_SET_STATUS',
  hashKeyStatus: 'HASH_KEY_STATUS',
  lastReconcilerAt: 'LAST_RECONCILER_AT',
} as const);

export type HealthCounterValue = string | number | null;

export interface HealthCountQuery {
  readonly table: string;
  readonly where: Readonly<Record<string, string | number | null>>;
  readonly since?: { readonly column: string; readonly at: string };
  readonly limit: number;
}

export interface HealthReadQuery {
  readonly table: string;
  readonly column: string;
  readonly where?: Readonly<Record<string, string | number | null>>;
  readonly limit: number;
}

export interface HealthCountersQuery {
  readonly limit: number;
}

/**
 * Narrow injected ports: no SQL implementation belongs in this slice. A port
 * method that is absent is an optional source and becomes a zero/unknown state.
 */
export interface HealthPort {
  count(query: HealthCountQuery): Promise<number>;
  max(query: HealthReadQuery): Promise<string | number | null>;
  latest(query: HealthReadQuery): Promise<string | null>;
  readCounters(query: HealthCountersQuery): Promise<Readonly<Record<string, HealthCounterValue>>>;
}

export type HealthErrorCode =
  | 'HEALTH_DEPENDENCY_FAILED'
  | 'HEALTH_UNBOUNDED_QUERY'
  | 'HEALTH_UNBOUNDED_RESULT'
  | 'HEALTH_INVALID_TIME';

/** Message is the code only, so a failure can never carry record text into a log. */
export class HealthError extends Error {
  constructor(readonly code: HealthErrorCode) {
    super(code);
    this.name = 'HealthError';
  }
}

export interface HealthAiStatus {
  readonly issueCalls: number;
  readonly siteCalls: number;
  readonly perIssueCap: number;
  readonly perSiteCap: number;
  readonly breakerState: HealthBreakerState;
}

export interface HealthSnapshot {
  readonly windowDays: number;
  readonly scansByStatus: Readonly<Record<ScanStatus, number>>;
  readonly scansByResult: Readonly<Record<HealthScanResult, number>>;
  readonly stalledScans: number;
  readonly deferredCount: number;
  readonly evidenceStateCounts: Readonly<Record<ValidationStatus, number>>;
  readonly writebackPending: number;
  readonly writebackFailed: number;
  readonly lastReconcilerAt: string | null;
  readonly capsHit: number;
  readonly ruleSetVersion: string;
  readonly ruleSetStatus: HealthRuleSetStatus;
  readonly hashKeyStatus: HealthHashKeyStatus;
  readonly ai: HealthAiStatus;
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const VERSION_CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

const asCode = (value: unknown, allowed: readonly string[]): string =>
  typeof value === 'string' && allowed.includes(value) ? value : '';

const asVersion = (value: unknown): string =>
  typeof value === 'string' && VERSION_CODE.test(value) ? value : '';

const asTimestamp = (value: unknown): string | null =>
  typeof value === 'string' && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
    ? value
    : null;

/** Exact, closed vocabularies for the resolver boundary (C-10.8, N-09, I-6). */
const HEALTH_SNAPSHOT_KEYS = Object.freeze([
  'windowDays',
  'scansByStatus',
  'scansByResult',
  'stalledScans',
  'deferredCount',
  'evidenceStateCounts',
  'writebackPending',
  'writebackFailed',
  'lastReconcilerAt',
  'capsHit',
  'ruleSetVersion',
  'ruleSetStatus',
  'hashKeyStatus',
  'ai',
] as const);
const HEALTH_AI_KEYS = Object.freeze([
  'issueCalls',
  'siteCalls',
  'perIssueCap',
  'perSiteCap',
  'breakerState',
] as const);
const BOUNDED_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;

const hasExactKeys = (
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
};

const isSafeCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isCode = (value: unknown, allowed: readonly string[]): value is string =>
  typeof value === 'string' && allowed.includes(value);

const isBoundedTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length <= 27 &&
  BOUNDED_ISO_TIMESTAMP.test(value) &&
  Number.isFinite(Date.parse(value));

/** Rebuild a count map from a closed key list; a missing or unknown key fails. */
const parseCountMap = <K extends string>(
  raw: unknown,
  keys: readonly K[],
): Readonly<Record<K, number>> | null => {
  if (!isRecord(raw) || !hasExactKeys(raw, keys)) return null;
  const result = {} as Record<K, number>;
  for (const key of keys) {
    const value: unknown = raw[key];
    if (!isSafeCount(value)) return null;
    result[key] = value;
  }
  return result;
};

/**
 * Strict boundary parser for a resolver-delivered health snapshot. Unlike the
 * view's normalising narrowSnapshot, this rejects anything outside the fixed
 * schema instead of turning hostile text into a plausible-looking UI value.
 * It returns null rather than a code message, so no input can reach a log.
 */
export function parseHealthSnapshot(raw: unknown): HealthSnapshot | null {
  if (!isRecord(raw) || !hasExactKeys(raw, HEALTH_SNAPSHOT_KEYS)) return null;

  const scansByStatus = parseCountMap(raw.scansByStatus, SCAN_STATUSES);
  const scansByResult = parseCountMap(raw.scansByResult, HEALTH_SCAN_RESULTS);
  const evidenceStateCounts = parseCountMap(raw.evidenceStateCounts, VALIDATION_STATUSES);
  if (scansByStatus === null || scansByResult === null || evidenceStateCounts === null) {
    return null;
  }

  const {
    windowDays,
    stalledScans,
    deferredCount,
    writebackPending,
    writebackFailed,
    capsHit,
    lastReconcilerAt,
    ruleSetVersion,
    ruleSetStatus,
    hashKeyStatus,
    ai,
  } = raw;
  if (
    windowDays !== HEALTH_WINDOW_DAYS ||
    !isSafeCount(stalledScans) ||
    !isSafeCount(deferredCount) ||
    !isSafeCount(writebackPending) ||
    !isSafeCount(writebackFailed) ||
    !isSafeCount(capsHit) ||
    !(lastReconcilerAt === null || isBoundedTimestamp(lastReconcilerAt)) ||
    typeof ruleSetVersion !== 'string' ||
    !VERSION_CODE.test(ruleSetVersion) ||
    !isCode(ruleSetStatus, [...RULE_STATUSES, 'UNKNOWN']) ||
    !isCode(hashKeyStatus, HEALTH_HASH_KEY_STATUSES) ||
    !isRecord(ai) ||
    !hasExactKeys(ai, HEALTH_AI_KEYS)
  ) {
    return null;
  }

  const { issueCalls, siteCalls, perIssueCap, perSiteCap, breakerState } = ai;
  if (
    !isSafeCount(issueCalls) ||
    !isSafeCount(siteCalls) ||
    !isSafeCount(perIssueCap) ||
    !isSafeCount(perSiteCap) ||
    !isCode(breakerState, HEALTH_BREAKER_STATES)
  ) {
    return null;
  }

  return {
    windowDays: HEALTH_WINDOW_DAYS,
    scansByStatus,
    scansByResult,
    stalledScans,
    deferredCount,
    evidenceStateCounts,
    writebackPending,
    writebackFailed,
    capsHit,
    lastReconcilerAt,
    ruleSetVersion,
    ruleSetStatus: ruleSetStatus as HealthRuleSetStatus,
    hashKeyStatus: hashKeyStatus as HealthHashKeyStatus,
    ai: {
      issueCalls,
      siteCalls,
      perIssueCap,
      perSiteCap,
      breakerState: breakerState as HealthBreakerState,
    },
  };
}

/** Reject a missing, fractional, negative or over-ceiling limit before any call. */
export function assertBoundedLimit(limit: unknown): asserts limit is number {
  if (
    typeof limit !== 'number' ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > HEALTH_QUERY_LIMIT
  ) {
    throw new HealthError('HEALTH_UNBOUNDED_QUERY');
  }
}

/** Decorate an injected port so an unbounded query can never reach the driver. */
export function boundedHealthPort(port: HealthPort): HealthPort {
  return {
    count: async (query) => {
      assertBoundedLimit((query as { readonly limit?: unknown } | null)?.limit);
      return await port.count(query);
    },
    max: async (query) => {
      assertBoundedLimit((query as { readonly limit?: unknown } | null)?.limit);
      return await port.max(query);
    },
    latest: async (query) => {
      assertBoundedLimit((query as { readonly limit?: unknown } | null)?.limit);
      return await port.latest(query);
    },
    readCounters: async (query) => {
      assertBoundedLimit((query as { readonly limit?: unknown } | null)?.limit);
      const counters: unknown = await port.readCounters(query);
      if (!isRecord(counters) || Object.keys(counters).length > query.limit) {
        throw new HealthError('HEALTH_UNBOUNDED_RESULT');
      }
      return counters as Readonly<Record<string, HealthCounterValue>>;
    },
  };
}

/** Absent or failing optional sources become zero/unknown; any failure of a
 * required source (the scan table) is propagated as a typed dependency error. */
async function safeCount(
  bounded: HealthPort,
  query: HealthCountQuery,
  required = false,
): Promise<number> {
  try {
    return asCount(await bounded.count(query));
  } catch (error) {
    if (required) {
      if (error instanceof HealthError) throw error;
      throw new HealthError('HEALTH_DEPENDENCY_FAILED');
    }
    return 0;
  }
}

async function safeRead<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

export async function readHealthSnapshot(
  port: HealthPort,
  nowISO: string,
): Promise<HealthSnapshot> {
  const nowMs = Date.parse(nowISO);
  if (!ISO_TIMESTAMP.test(nowISO) || !Number.isFinite(nowMs)) {
    throw new HealthError('HEALTH_INVALID_TIME');
  }
  const bounded = boundedHealthPort(port);
  const since = new Date(nowMs - HEALTH_WINDOW_DAYS * 86_400_000).toISOString();
  const windowed = (
    where: Readonly<Record<string, string | number | null>>,
    sinceColumn = 'started_at',
  ): HealthCountQuery => ({
    table: 'scan',
    where,
    since: { column: sinceColumn, at: since },
    limit: HEALTH_QUERY_LIMIT,
  });

  const scansByStatus = {} as Record<ScanStatus, number>;
  for (const status of SCAN_STATUSES) {
    scansByStatus[status] = await safeCount(bounded, windowed({ status }), true);
  }

  const scansByResult = {} as Record<HealthScanResult, number>;
  for (const result of HEALTH_SCAN_RESULTS) {
    scansByResult[result] = await safeCount(bounded, windowed({ result }), true);
  }

  const stalledScans = await safeCount(
    bounded,
    // `scan` has no updated_at column in the frozen migration; started_at is
    // the only bounded age signal available without a new migration.
    windowed({ status: 'RUNNING' }, 'started_at'),
    true,
  );
  const deferredCount = await safeCount(
    bounded,
    windowed({ status: 'DEFERRED', reason_code: 'LLM_DEFERRED' }),
    true,
  );

  const evidenceStateCounts = {} as Record<ValidationStatus, number>;
  for (const state of VALIDATION_STATUSES) {
    evidenceStateCounts[state] = await safeCount(bounded, {
      table: 'evidence_item',
      where: { validation_status: state },
      limit: HEALTH_QUERY_LIMIT,
    });
  }

  const writebackPending = await safeCount(bounded, {
    table: 'writeback_task',
    where: { status: 'PENDING' },
    limit: HEALTH_QUERY_LIMIT,
  });
  const writebackFailed = await safeCount(bounded, {
    table: 'writeback_task',
    where: { status: 'FAILED' },
    limit: HEALTH_QUERY_LIMIT,
  });

  const counters =
    (await safeRead(() => bounded.readCounters({ limit: HEALTH_QUERY_LIMIT }))) ?? {};
  const counterCount = (key: string): number => asCount(counters[key]);
  const counterCode = (key: string, allowed: readonly string[]): string =>
    asCode(counters[key], allowed);

  const reconcilerAt = await safeRead(() =>
    bounded.latest({
      table: 'audit_event',
      column: 'at',
      where: { action_code: 'RECONCILER_RUN' },
      limit: HEALTH_QUERY_LIMIT,
    }),
  );
  const reconcilerMax = await safeRead(() =>
    bounded.max({
      table: 'usage_counter',
      column: 'count',
      where: { kind: HEALTH_COUNTER_KEYS.lastReconcilerAt },
      limit: HEALTH_QUERY_LIMIT,
    }),
  );
  const issueCallsMax = await safeRead(() =>
    bounded.max({
      table: 'usage_counter',
      column: 'count',
      where: { kind: HEALTH_COUNTER_KEYS.issueCalls },
      limit: HEALTH_QUERY_LIMIT,
    }),
  );

  return {
    windowDays: HEALTH_WINDOW_DAYS,
    scansByStatus,
    scansByResult,
    stalledScans,
    deferredCount,
    evidenceStateCounts,
    writebackPending,
    writebackFailed,
    lastReconcilerAt:
      asTimestamp(reconcilerAt) ??
      asTimestamp(reconcilerMax) ??
      asTimestamp(counters[HEALTH_COUNTER_KEYS.lastReconcilerAt]),
    capsHit: counterCount(HEALTH_COUNTER_KEYS.capsHit),
    ruleSetVersion: asVersion(counters[HEALTH_COUNTER_KEYS.ruleSetVersion]),
    ruleSetStatus: (counterCode(HEALTH_COUNTER_KEYS.ruleSetStatus, [...RULE_STATUSES, 'UNKNOWN']) ||
      'UNKNOWN') as HealthRuleSetStatus,
    hashKeyStatus: (counterCode(HEALTH_COUNTER_KEYS.hashKeyStatus, HEALTH_HASH_KEY_STATUSES) ||
      'UNKNOWN') as HealthHashKeyStatus,
    ai: {
      issueCalls: counterCount(HEALTH_COUNTER_KEYS.issueCalls) || asCount(issueCallsMax),
      siteCalls: counterCount(HEALTH_COUNTER_KEYS.siteCalls),
      perIssueCap: counterCount(HEALTH_COUNTER_KEYS.perIssueCap),
      perSiteCap: counterCount(HEALTH_COUNTER_KEYS.perSiteCap),
      breakerState: (counterCode(HEALTH_COUNTER_KEYS.breakerState, HEALTH_BREAKER_STATES) ||
        'UNKNOWN') as HealthBreakerState,
    },
  };
}
