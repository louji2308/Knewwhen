/**
 * P10.A2 — bounded, honest health snapshot (C-10.8, N-09).
 * Req: C-10.8, N-09. Tests read only codes, counts and ISO timestamps.
 */

import { describe, expect, it, vi } from 'vitest';
import { SCAN_STATUSES } from '../src/contracts/scan';
import { VALIDATION_STATUSES } from '../src/contracts/evidence';
import {
  HEALTH_QUERY_LIMIT,
  HEALTH_SCAN_RESULTS,
  HEALTH_WINDOW_DAYS,
  HealthError,
  assertBoundedLimit,
  boundedHealthPort,
  parseHealthSnapshot,
  readHealthSnapshot,
  type HealthCountQuery,
  type HealthCounterValue,
  type HealthPort,
  type HealthReadQuery,
} from '../src/services/health';

const NOW = '2026-11-25T12:34:56.000Z';
const SINCE = '2026-11-18T12:34:56.000Z';
const RECONCILER_AT = '2026-11-24T06:00:00.000Z';

const COUNTERS: Readonly<Record<string, HealthCounterValue>> = Object.freeze({
  AI_ISSUE_CALLS: 7,
  AI_SITE_CALLS: 20,
  AI_PER_ISSUE_CAP: 10,
  AI_PER_SITE_CAP: 50,
  AI_BREAKER_STATE: 'OPEN',
  CAPS_HIT: 2,
  RULE_SET_VERSION: 'fda-2026-11',
  RULE_SET_STATUS: 'PREVIEW',
  HASH_KEY_STATUS: 'PRESENT',
  LAST_RECONCILER_AT: RECONCILER_AT,
});

interface FakeOptions {
  readonly count?: (query: HealthCountQuery) => Promise<number>;
  readonly counters?: () => Promise<Readonly<Record<string, HealthCounterValue>>>;
  readonly latest?: (query: HealthReadQuery) => Promise<string | null>;
  readonly max?: (query: HealthReadQuery) => Promise<string | number | null>;
}

function fakePort(options: FakeOptions = {}): HealthPort {
  return {
    count: options.count ?? (async () => 0),
    max: options.max ?? (async () => null),
    latest: options.latest ?? (async () => null),
    readCounters: async () => (options.counters ? await options.counters() : {}),
  };
}

const statusCounts = (): Readonly<Record<string, number>> => ({
  QUEUED: 2,
  RUNNING: 1,
  DONE: 3,
  FAILED: 1,
  DEFERRED: 4,
});
const resultCounts: Readonly<Record<string, number>> = {
  SIGNAL: 3,
  NO_SIGNAL: 2,
  SKIPPED: 1,
  UNKNOWN: 0,
};

function countedPort(): HealthPort {
  const statuses = statusCounts();
  return fakePort({
    count: async (query) => {
      if (query.table === 'scan') {
        if (query.where.status === 'RUNNING' && query.since?.column === 'started_at') return 1; // stalled
        if (query.where.reason_code === 'LLM_DEFERRED') return 4;
        const status = query.where.status;
        if (typeof status === 'string') return statuses[status] ?? 0;
        const result = query.where.result;
        if (typeof result === 'string') return resultCounts[result] ?? 0;
      }
      if (query.table === 'evidence_item') {
        return query.where.validation_status === 'VALID'
          ? 5
          : query.where.validation_status === 'MODIFIED'
            ? 1
            : 0;
      }
      if (query.table === 'writeback_task') {
        return query.where.status === 'PENDING' ? 2 : query.where.status === 'FAILED' ? 1 : 0;
      }
      return 0;
    },
    latest: async () => RECONCILER_AT,
    counters: async () => COUNTERS,
  });
}

describe('P10.A2 health snapshot (C-10.8, N-09)', () => {
  it('exposes the fixed 7-day window and query ceiling', () => {
    expect(HEALTH_WINDOW_DAYS).toBe(7);
    expect(HEALTH_QUERY_LIMIT).toBe(100);
  });

  it('returns honest zero and unknown states when every source is empty', async () => {
    const snapshot = await readHealthSnapshot(fakePort(), NOW);
    expect(snapshot.windowDays).toBe(7);
    expect(snapshot.scansByStatus).toEqual(Object.fromEntries(SCAN_STATUSES.map((s) => [s, 0])));
    expect(snapshot.scansByResult).toEqual({ SIGNAL: 0, NO_SIGNAL: 0, SKIPPED: 0, UNKNOWN: 0 });
    expect(snapshot.stalledScans).toBe(0);
    expect(snapshot.deferredCount).toBe(0);
    expect(snapshot.evidenceStateCounts).toEqual(
      Object.fromEntries(VALIDATION_STATUSES.map((s) => [s, 0])),
    );
    expect(snapshot.writebackPending).toBe(0);
    expect(snapshot.writebackFailed).toBe(0);
    expect(snapshot.lastReconcilerAt).toBeNull();
    expect(snapshot.capsHit).toBe(0);
    expect(snapshot.ruleSetVersion).toBe('');
    expect(snapshot.ruleSetStatus).toBe('UNKNOWN');
    expect(snapshot.hashKeyStatus).toBe('UNKNOWN');
    expect(snapshot.ai).toEqual({
      issueCalls: 0,
      siteCalls: 0,
      perIssueCap: 0,
      perSiteCap: 0,
      breakerState: 'UNKNOWN',
    });
  });

  it('reports only counts, codes and ISO timestamps from counted sources', async () => {
    const snapshot = await readHealthSnapshot(countedPort(), NOW);
    expect(snapshot.scansByStatus).toEqual({
      QUEUED: 2,
      RUNNING: 1,
      DONE: 3,
      FAILED: 1,
      DEFERRED: 4,
    });
    expect(snapshot.scansByResult).toEqual({ SIGNAL: 3, NO_SIGNAL: 2, SKIPPED: 1, UNKNOWN: 0 });
    expect(snapshot.stalledScans).toBe(1);
    expect(snapshot.deferredCount).toBe(4);
    expect(snapshot.evidenceStateCounts).toEqual({
      VALID: 5,
      RELOCATED: 0,
      MODIFIED: 1,
      UNAVAILABLE: 0,
      UNVERIFIABLE: 0,
    });
    expect(snapshot.writebackPending).toBe(2);
    expect(snapshot.writebackFailed).toBe(1);
    expect(snapshot.lastReconcilerAt).toBe(RECONCILER_AT);
    expect(snapshot.capsHit).toBe(2);
    expect(snapshot.ruleSetVersion).toBe('fda-2026-11');
    expect(snapshot.ruleSetStatus).toBe('PREVIEW');
    expect(snapshot.hashKeyStatus).toBe('PRESENT');
    expect(snapshot.ai).toEqual({
      issueCalls: 7,
      siteCalls: 20,
      perIssueCap: 10,
      perSiteCap: 50,
      breakerState: 'OPEN',
    });
  });

  it('enforces an explicit query limit on every port call (N-09)', async () => {
    expect(() => assertBoundedLimit(0)).toThrowError(
      expect.objectContaining({ code: 'HEALTH_UNBOUNDED_QUERY' }),
    );
    expect(() => assertBoundedLimit(HEALTH_QUERY_LIMIT + 1)).toThrowError(
      expect.objectContaining({ code: 'HEALTH_UNBOUNDED_QUERY' }),
    );
    expect(() => assertBoundedLimit(1.5)).toThrowError(
      expect.objectContaining({ code: 'HEALTH_UNBOUNDED_QUERY' }),
    );
    expect(() => assertBoundedLimit(undefined)).toThrowError(
      expect.objectContaining({ code: 'HEALTH_UNBOUNDED_QUERY' }),
    );

    const rawCount = vi.fn(async () => 0);
    const wrapped = boundedHealthPort({ ...fakePort(), count: rawCount });
    await expect(wrapped.count({ table: 'scan', where: {}, limit: 101 })).rejects.toMatchObject({
      code: 'HEALTH_UNBOUNDED_QUERY',
    });
    await expect(
      wrapped.count({ table: 'scan', where: {}, limit: undefined } as unknown as HealthCountQuery),
    ).rejects.toMatchObject({ code: 'HEALTH_UNBOUNDED_QUERY' });
    expect(rawCount).not.toHaveBeenCalled();
    await expect(
      wrapped.count({ table: 'scan', where: {}, limit: HEALTH_QUERY_LIMIT }),
    ).resolves.toBe(0);
    expect(rawCount).toHaveBeenCalledTimes(1);

    const many = Object.fromEntries(
      Array.from({ length: HEALTH_QUERY_LIMIT + 1 }, (_, index) => [`K${index}`, index]),
    );
    await expect(
      boundedHealthPort(fakePort({ counters: async () => many })).readCounters({
        limit: HEALTH_QUERY_LIMIT,
      }),
    ).rejects.toMatchObject({
      code: 'HEALTH_UNBOUNDED_RESULT',
    });
  });

  it('sends only bounded queries from the snapshot reader', async () => {
    const seen: number[] = [];
    const port = fakePort({
      count: async (query) => {
        seen.push(query.limit);
        return 0;
      },
    });
    await readHealthSnapshot(port, NOW);
    expect(seen.length).toBeGreaterThan(0);
    for (const limit of seen) {
      expect(Number.isInteger(limit)).toBe(true);
      expect(limit).toBeGreaterThanOrEqual(1);
      expect(limit).toBeLessThanOrEqual(HEALTH_QUERY_LIMIT);
    }
  });

  it('queries only columns present in the frozen migration', async () => {
    const counts: HealthCountQuery[] = [];
    const reads: HealthReadQuery[] = [];
    const port = fakePort({
      count: async (query) => {
        counts.push(query);
        return 0;
      },
      latest: async (query) => {
        reads.push(query);
        return null;
      },
      max: async (query) => {
        reads.push(query);
        return null;
      },
    });
    await readHealthSnapshot(port, NOW);
    expect(counts.length).toBeGreaterThan(0);
    expect(
      counts
        .filter((query) => query.table === 'scan')
        .every((query) => query.since?.column === 'started_at'),
    ).toBe(true);
    expect(reads.filter((query) => query.table === 'audit_event')).toEqual([
      expect.objectContaining({ column: 'at', where: { action_code: 'RECONCILER_RUN' } }),
    ]);
    expect(
      reads
        .filter((query) => query.table === 'usage_counter')
        .every((query) => query.column === 'count'),
    ).toBe(true);
  });

  it('derives the 7-day cutoff from the injected clock only', async () => {
    const sinceValues: string[] = [];
    const port = fakePort({
      count: async (query) => {
        if (query.since?.column === 'started_at') sinceValues.push(query.since.at);
        return 0;
      },
    });
    await readHealthSnapshot(port, NOW);
    expect(sinceValues.length).toBeGreaterThan(0);
    expect([...new Set(sinceValues)]).toEqual([SINCE]);
  });

  it('propagates only an injected typed failure of a required source', async () => {
    const required = fakePort({
      count: async (query) => {
        if (query.table === 'scan') throw new HealthError('HEALTH_DEPENDENCY_FAILED');
        return 0;
      },
    });
    await expect(readHealthSnapshot(required, NOW)).rejects.toMatchObject({
      code: 'HEALTH_DEPENDENCY_FAILED',
    });

    const optional = fakePort({
      count: async (query) => {
        if (query.table === 'writeback_task') throw new HealthError('HEALTH_DEPENDENCY_FAILED');
        return 0;
      },
      counters: async () => {
        throw new HealthError('HEALTH_DEPENDENCY_FAILED');
      },
      latest: async () => {
        throw new HealthError('HEALTH_DEPENDENCY_FAILED');
      },
    });
    const snapshot = await readHealthSnapshot(optional, NOW);
    expect(snapshot.writebackPending).toBe(0);
    expect(snapshot.writebackFailed).toBe(0);
    expect(snapshot.ruleSetStatus).toBe('UNKNOWN');
    expect(snapshot.lastReconcilerAt).toBeNull();

    const untypedRequired = fakePort({
      count: async () => {
        throw new Error('SQL unavailable');
      },
    });
    await expect(readHealthSnapshot(untypedRequired, NOW)).rejects.toMatchObject({
      code: 'HEALTH_DEPENDENCY_FAILED',
    });

    const untypedOptional = fakePort({
      count: async (query) => {
        if (query.table === 'writeback_task') throw new Error('SQL unavailable');
        return 0;
      },
      counters: async () => {
        throw new Error('SQL unavailable');
      },
      latest: async () => {
        throw new Error('SQL unavailable');
      },
    });
    const untypedSnapshot = await readHealthSnapshot(untypedOptional, NOW);
    expect(untypedSnapshot.writebackPending).toBe(0);
    expect(untypedSnapshot.writebackFailed).toBe(0);
    expect(untypedSnapshot.ruleSetStatus).toBe('UNKNOWN');
  });

  it('never carries record text or account ids into the model', async () => {
    const port = fakePort({
      counters: async () => ({
        ...COUNTERS,
        RULE_SET_VERSION: 'CANARY PATIENT TEXT',
        LAST_RECONCILER_AT: 'acc-canary-123 wrote CANARY_PATIENT_TEXT',
        quote: 'CANARY_PATIENT_TEXT',
        account_id: 'acc-canary-123',
      }),
      latest: async () => 'acc-canary-123 wrote CANARY_PATIENT_TEXT',
      max: async () => 'acc-canary-123 wrote CANARY_PATIENT_TEXT',
    });
    const snapshot = await readHealthSnapshot(port, NOW);
    const serialised = JSON.stringify(snapshot);
    expect(serialised).not.toContain('CANARY_PATIENT_TEXT');
    expect(serialised).not.toContain('acc-canary-123');
    expect(snapshot.ruleSetVersion).toBe('');
    expect(snapshot.lastReconcilerAt).toBeNull();
  });
});

/** C-10.8, N-09, I-6: a strict boundary parser, independent of the port. */
describe('P10.A2 strict health snapshot parser (C-10.8, N-09, I-6)', () => {
  const validSnapshot = (): Record<string, unknown> => ({
    windowDays: HEALTH_WINDOW_DAYS,
    scansByStatus: Object.fromEntries(SCAN_STATUSES.map((status, index) => [status, index])),
    scansByResult: Object.fromEntries(HEALTH_SCAN_RESULTS.map((result, index) => [result, index])),
    stalledScans: 1,
    deferredCount: 2,
    evidenceStateCounts: Object.fromEntries(
      VALIDATION_STATUSES.map((state, index) => [state, index]),
    ),
    writebackPending: 3,
    writebackFailed: 4,
    lastReconcilerAt: RECONCILER_AT,
    capsHit: 5,
    ruleSetVersion: 'fda-2026-11',
    ruleSetStatus: 'PREVIEW',
    hashKeyStatus: 'PRESENT',
    ai: {
      issueCalls: 6,
      siteCalls: 7,
      perIssueCap: 10,
      perSiteCap: 50,
      breakerState: 'CLOSED',
    },
  });

  const nested = (raw: Record<string, unknown>, parent: string): Record<string, unknown> =>
    raw[parent] as Record<string, unknown>;

  it('accepts one complete canonical snapshot and preserves every field', () => {
    const raw = validSnapshot();
    expect(parseHealthSnapshot(raw)).toEqual(raw);
    expect(parseHealthSnapshot({ ...raw, lastReconcilerAt: null })?.lastReconcilerAt).toBeNull();
  });

  it('rejects empty, non-object and arbitrary string inputs', () => {
    for (const raw of [{}, null, [], 'CANARY_RECORD_TEXT', 7, true, undefined]) {
      expect(parseHealthSnapshot(raw)).toBeNull();
    }
  });

  it('rejects every missing top-level key and every unknown top-level field', () => {
    for (const key of Object.keys(validSnapshot())) {
      const missing = validSnapshot();
      delete missing[key];
      expect(parseHealthSnapshot(missing)).toBeNull();
    }
    for (const extra of ['status', 'errorCodes', 'quote', 'accountId', 'rawText']) {
      expect(parseHealthSnapshot({ ...validSnapshot(), [extra]: 'CANARY_RECORD_TEXT' })).toBeNull();
    }
  });

  it('rejects unknown or missing keys in nested maps and the ai block', () => {
    const parents = ['scansByStatus', 'scansByResult', 'evidenceStateCounts', 'ai'] as const;
    for (const parent of parents) {
      const raw = validSnapshot();
      const withExtra = { ...raw, [parent]: { ...nested(raw, parent), EXTRA_KEY: 99 } };
      expect(parseHealthSnapshot(withExtra)).toBeNull();

      const withoutOne = { ...nested(raw, parent) };
      delete withoutOne[Object.keys(withoutOne)[0] as string];
      expect(parseHealthSnapshot({ ...raw, [parent]: withoutOne })).toBeNull();

      expect(parseHealthSnapshot({ ...raw, [parent]: [] })).toBeNull();
    }
  });

  it('rejects unsafe, fractional and non-number counts at every numeric field', () => {
    const countPaths: ReadonlyArray<readonly [string, string | null]> = [
      ['stalledScans', null],
      ['deferredCount', null],
      ['writebackPending', null],
      ['writebackFailed', null],
      ['capsHit', null],
      ['scansByStatus', SCAN_STATUSES[0]],
      ['scansByResult', HEALTH_SCAN_RESULTS[0]],
      ['evidenceStateCounts', VALIDATION_STATUSES[0]],
      ['ai', 'issueCalls'],
      ['ai', 'siteCalls'],
      ['ai', 'perIssueCap'],
      ['ai', 'perSiteCap'],
    ];
    const badCounts: readonly unknown[] = [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      '3',
      null,
      [],
      {},
      true,
    ];
    for (const [parent, key] of countPaths) {
      for (const value of badCounts) {
        const raw = validSnapshot();
        if (key === null) {
          expect(parseHealthSnapshot({ ...raw, [parent]: value })).toBeNull();
        } else {
          expect(
            parseHealthSnapshot({ ...raw, [parent]: { ...nested(raw, parent), [key]: value } }),
          ).toBeNull();
        }
      }
    }
    for (const value of [0, 8, 7.5, '7', null]) {
      expect(parseHealthSnapshot({ ...validSnapshot(), windowDays: value })).toBeNull();
    }
  });

  it('rejects unknown codes, canary text, control characters and oversized strings', () => {
    // VERSION_CODE permits code-shaped tokens; sentences, control characters
    // and oversized strings are not codes (no new version vocabulary is invented).
    for (const value of [
      'CANARY RECORD TEXT',
      'acc-canary-123 wrote CANARY_RECORD_TEXT',
      `fda-${'x'.repeat(70)}`,
      'fda-2026-11\u0000',
    ]) {
      expect(parseHealthSnapshot({ ...validSnapshot(), ruleSetVersion: value })).toBeNull();
    }
    expect(
      parseHealthSnapshot({ ...validSnapshot(), ruleSetStatus: 'CANARY_RECORD_TEXT' }),
    ).toBeNull();
    expect(parseHealthSnapshot({ ...validSnapshot(), hashKeyStatus: 'acc-canary-123' })).toBeNull();
    expect(
      parseHealthSnapshot({
        ...validSnapshot(),
        ai: { ...nested(validSnapshot(), 'ai'), breakerState: 'MAYBE' },
      }),
    ).toBeNull();
  });

  it('rejects malformed, unbounded and non-string timestamps', () => {
    for (const value of [
      'acc-canary-123 wrote CANARY_RECORD_TEXT',
      '2026-11-24T06:00:00',
      '9999-99-99T99:99:99Z',
      `2026-11-24T06:00:00.${'1'.repeat(64)}Z`,
      `2026-11-24T06:00:00.000Z\n`,
      [],
      {},
      123,
    ]) {
      expect(parseHealthSnapshot({ ...validSnapshot(), lastReconcilerAt: value })).toBeNull();
    }
  });
});
