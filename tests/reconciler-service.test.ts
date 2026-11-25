import { describe, expect, it } from 'vitest';
import { CANARY_TOKENS } from '../src/contracts/canary';
import {
  RECONCILER_CODES,
  RECONCILER_LIMITS,
  runReconciler,
  type ReconcilerCode,
  type ReconcilerPort,
  type ReconcilerResult,
} from '../src/services/reconciler';

/** N-01(c), Arch §15.2. Injected observation time: no live clock in the flow. */
const NOW = '2026-11-25T09:00:00.000Z';

interface FakeState {
  cursor: string | null;
  updatedIds: readonly string[];
  stalledIds: readonly string[];
  openCaseIds: readonly string[];
  missingCaseIds: readonly string[];
  pruneCount: number;
  /** Model a stale/buggy JQL page that ignores the cursor. */
  ignoreCursor: boolean;
}

type FailingStep =
  | 'readCursor'
  | 'writeCursor'
  | 'findUpdatedIssueIds'
  | 'findStalledScanIds'
  | 'findOpenCaseIds'
  | 'findMissingWritebackCaseIds'
  | 'retryWritebacks'
  | 'pruneCounters'
  | 'audit';

function state(overrides: Partial<FakeState> = {}): FakeState {
  return {
    cursor: null,
    updatedIds: ['1001', '1002', '1003'],
    stalledIds: ['2001', '2002'],
    openCaseIds: ['3001', '3002'],
    missingCaseIds: ['4001', '4002'],
    pruneCount: 2,
    ignoreCursor: false,
    ...overrides,
  };
}

/** Stateful KVS/SQL/writeback fake. Mutating ports dedupe, as the real services do. */
function port(
  s: FakeState,
  fail: Partial<Record<FailingStep, boolean>> = {},
): {
  port: ReconcilerPort;
  calls: readonly string[];
  cursorWrites: readonly string[];
  audited: readonly string[];
  staleBefore: readonly string[];
} {
  const calls: string[] = [];
  const cursorWrites: string[] = [];
  const audited: string[] = [];
  const staleBefore: string[] = [];
  const retried = new Set<string>();
  let pruneLeft = s.pruneCount;

  const impl: ReconcilerPort = {
    async readCursor() {
      calls.push('readCursor');
      if (fail.readCursor) throw new Error('KVS_DOWN');
      return s.cursor;
    },
    async writeCursor(next) {
      calls.push(`writeCursor:${next}`);
      if (fail.writeCursor) throw new Error('KVS_DOWN');
      s.cursor = next;
      cursorWrites.push(next);
    },
    async findUpdatedIssueIds(cursor, limit) {
      calls.push(`findUpdatedIssueIds:${cursor}:${limit}`);
      if (fail.findUpdatedIssueIds) throw new Error('JQL_DOWN');
      const matching = s.ignoreCursor ? s.updatedIds : s.updatedIds.filter((id) => id > cursor);
      return matching.slice(0, limit);
    },
    async findStalledScanIds(beforeISO, limit) {
      staleBefore.push(beforeISO);
      calls.push(`findStalledScanIds:${beforeISO}:${limit}`);
      if (fail.findStalledScanIds) throw new Error('SQL_DOWN');
      return s.stalledIds.slice(0, limit);
    },
    async findOpenCaseIds(limit) {
      calls.push(`findOpenCaseIds:${limit}`);
      if (fail.findOpenCaseIds) throw new Error('SQL_DOWN');
      return s.openCaseIds.slice(0, limit);
    },
    async findMissingWritebackCaseIds(limit) {
      calls.push(`findMissingWritebackCaseIds:${limit}`);
      if (fail.findMissingWritebackCaseIds) throw new Error('SQL_DOWN');
      return s.missingCaseIds.slice(0, limit);
    },
    async retryWritebacks(limit) {
      calls.push(`retryWritebacks:${limit}`);
      if (fail.retryWritebacks) throw new Error('WRITEBACK_DOWN');
      let retriedNow = 0;
      for (const id of s.missingCaseIds.slice(0, limit)) {
        if (!retried.has(id)) {
          retried.add(id);
          retriedNow += 1;
        }
      }
      return retriedNow;
    },
    async pruneCounters(limit) {
      calls.push(`pruneCounters:${limit}`);
      if (fail.pruneCounters) throw new Error('SQL_DOWN');
      const prunedNow = Math.min(pruneLeft, limit);
      pruneLeft -= prunedNow;
      return prunedNow;
    },
    async audit(code) {
      calls.push(`audit:${code}`);
      audited.push(code);
      if (fail.audit) throw new Error('AUDIT_DOWN');
    },
  };
  return { port: impl, calls, cursorWrites, audited, staleBefore };
}

const FORBIDDEN_KEYS = new Set([
  'body',
  'quote',
  'summary',
  'text',
  'accountId',
  'payload',
  'commentBody',
  'rationale',
  'entityId',
]);

function assertNoForbiddenText(result: ReconcilerResult): void {
  const json = JSON.stringify(result);
  for (const token of CANARY_TOKENS) expect(json).not.toContain(token);
  for (const key of Object.keys(result)) expect(FORBIDDEN_KEYS.has(key)).toBe(false);
  for (const key of Object.keys(result.counts)) expect(FORBIDDEN_KEYS.has(key)).toBe(false);
}

describe('P10.B2 reconciler service (N-01(c), Arch §15.2)', () => {
  it('is deterministic: identical state and injected time give identical results', async () => {
    const a = await runReconciler(port(state()).port, NOW);
    const b = await runReconciler(port(state()).port, NOW);
    expect(a).toEqual(b);
  });

  it('sweeps once, advances the cursor and performs no duplicate writes on a second run', async () => {
    const harness = port(state());
    const first = await runReconciler(harness.port, NOW);

    expect(first.status).toBe('OK');
    expect(first.counts).toEqual({
      issuesSwept: 3,
      stalledScans: 2,
      openCases: 2,
      missingWritebacks: 2,
      writebacksRetried: 2,
      countersPruned: 2,
      errors: 0,
    });
    expect(first.cursor).toBe('1003');
    expect(harness.cursorWrites).toEqual(['1003']);
    expect(harness.audited.filter((code) => code === 'RECONCILER_RUN')).toHaveLength(1);

    const second = await runReconciler(harness.port, NOW);
    expect(second.status).toBe('OK');
    expect(second.counts.issuesSwept).toBe(0);
    expect(second.counts.writebacksRetried).toBe(0);
    expect(second.counts.countersPruned).toBe(0);
    expect(second.cursor).toBe('1003');
    expect(harness.cursorWrites).toEqual(['1003']); // no second cursor write
  });

  it('never exceeds a limit, even when a port returns an oversized page', async () => {
    const ids = (prefix: string, n: number): string[] =>
      Array.from({ length: n }, (_, i) => `${prefix}${1000 + i}`);
    const harness = port(
      state({
        updatedIds: ids('1', RECONCILER_LIMITS.sweepIssues + 10),
        stalledIds: ids('2', RECONCILER_LIMITS.stalledScans + 10),
        openCaseIds: ids('3', RECONCILER_LIMITS.openCases + 10),
        missingCaseIds: ids('4', RECONCILER_LIMITS.writebackTasks + 10),
        pruneCount: RECONCILER_LIMITS.counters + 10,
      }),
    );
    const result = await runReconciler(harness.port, NOW);

    expect(result.counts.issuesSwept).toBe(RECONCILER_LIMITS.sweepIssues);
    expect(result.counts.stalledScans).toBe(RECONCILER_LIMITS.stalledScans);
    expect(result.counts.openCases).toBe(RECONCILER_LIMITS.openCases);
    expect(result.counts.missingWritebacks).toBe(RECONCILER_LIMITS.writebackTasks);
    expect(result.counts.writebacksRetried).toBe(RECONCILER_LIMITS.writebackTasks);
    expect(result.counts.countersPruned).toBe(RECONCILER_LIMITS.counters);
    // The 50th generated id: prefix '1' + (1000 + 49).
    expect(result.cursor).toBe('11049');

    for (const call of harness.calls) {
      const tail = call.split(':').at(-1);
      if (
        call.startsWith('find') ||
        call.startsWith('retryWritebacks') ||
        call.startsWith('pruneCounters')
      ) {
        expect(Number(tail)).toBeLessThanOrEqual(50);
      }
    }
  });

  it('never regresses the cursor: older returned ids cannot move it backwards', async () => {
    const s = state({
      cursor: '2000',
      updatedIds: ['1001', '1002', '1003'],
      ignoreCursor: true,
    });
    const harness = port(s);
    const result = await runReconciler(harness.port, NOW);

    expect(result.cursor).toBe('2000');
    expect(result.counts.issuesSwept).toBe(3); // returned ids were seen
    expect(harness.cursorWrites).toEqual([]); // but none is a valid advance
    expect(result.status).toBe('OK');
  });

  it('advances to the greatest returned issue id, not the last one', async () => {
    const harness = port(state({ updatedIds: ['1003', '1001', '1002'] }));
    const result = await runReconciler(harness.port, NOW);

    expect(result.cursor).toBe('1003');
    expect(harness.cursorWrites).toEqual(['1003']);
  });

  it('uses the injected time as the stalled-scan boundary, never the live clock', async () => {
    const harness = port(state());
    await runReconciler(harness.port, NOW);
    expect(harness.staleBefore).toEqual([NOW]);
  });

  it('records a degraded step code but continues unrelated bounded steps', async () => {
    const harness = port(state(), { findStalledScanIds: true });
    const result = await runReconciler(harness.port, NOW);

    expect(result.status).toBe('DEGRADED');
    expect(result.errorCodes).toContain('STALLED_SCANS_FAILED');
    expect(result.counts.errors).toBe(1);
    expect(result.counts.openCases).toBe(2);
    expect(result.counts.writebacksRetried).toBe(2);
    expect(result.counts.countersPruned).toBe(2);
    expect(result.cursor).toBe('1003');
    expect(harness.audited).toContain('STALLED_SCANS_FAILED');
  });

  it('degrades honestly when a required port is missing', async () => {
    const result = await runReconciler(null as unknown as ReconcilerPort, NOW);
    expect(result.status).toBe('DEGRADED');
    expect(result.errorCodes).toEqual(['PORT_INVALID']);
    expect(result.cursor).toBe('');
    expect(result.counts).toEqual({
      issuesSwept: 0,
      stalledScans: 0,
      openCases: 0,
      missingWritebacks: 0,
      writebacksRetried: 0,
      countersPruned: 0,
      errors: 1,
    });
  });

  it('degrades when the cursor cannot be read and skips the dependent sweep', async () => {
    const harness = port(state(), { readCursor: true });
    const result = await runReconciler(harness.port, NOW);

    expect(result.status).toBe('DEGRADED');
    expect(result.errorCodes).toContain('CURSOR_READ_FAILED');
    expect(result.counts.issuesSwept).toBe(0);
    expect(result.counts.openCases).toBe(2); // unrelated step still ran
    expect(harness.calls.some((call) => call.startsWith('findUpdatedIssueIds'))).toBe(false);
  });

  it('degrades when the cursor cannot be written and reports no durable advance', async () => {
    const harness = port(state(), { writeCursor: true });
    const result = await runReconciler(harness.port, NOW);

    expect(result.status).toBe('DEGRADED');
    expect(result.errorCodes).toContain('CURSOR_WRITE_FAILED');
    expect(result.cursor).toBe('');
    expect(result.counts.issuesSwept).toBe(3);
  });

  it('isolates an audit failure without losing step counts', async () => {
    const harness = port(state(), { audit: true });
    const result = await runReconciler(harness.port, NOW);

    expect(result.status).toBe('DEGRADED');
    expect(result.errorCodes).toContain('AUDIT_FAILED');
    expect(result.counts.errors).toBe(1);
    expect(result.counts.issuesSwept).toBe(3);
    expect(result.counts.countersPruned).toBe(2);
  });

  it('rejects a non-canary free-text cursor without persisting it (N-01(c), I-6)', async () => {
    const harness = port(state({ cursor: 'free text cursor' }));
    const result = await runReconciler(harness.port, NOW);

    expect(result.status).toBe('DEGRADED');
    expect(result.errorCodes).toContain('CURSOR_INVALID');
    expect(result.cursor).toBe('');
    expect(harness.cursorWrites).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('free text cursor');
  });

  it('rejects non-canary free-text ids as a typed shape failure (N-01(c), I-6)', async () => {
    const harness = port(state({ updatedIds: ['free text id'] }));
    const result = await runReconciler(harness.port, NOW);

    expect(result.status).toBe('DEGRADED');
    expect(result.errorCodes).toContain('ID_SHAPE_INVALID');
    expect(result.cursor).toBe('');
    expect(harness.cursorWrites).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('free text id');
  });

  it('keeps canary text out of the result and reports it as a degraded step (N-04, I-6)', async () => {
    const harness = port(
      state({
        updatedIds: [CANARY_TOKENS[0]!, '1001'],
        stalledIds: [CANARY_TOKENS[1]!],
        openCaseIds: [CANARY_TOKENS[2]!],
        missingCaseIds: [CANARY_TOKENS[3]!],
      }),
    );
    const result = await runReconciler(harness.port, NOW);

    expect(result.status).toBe('DEGRADED');
    expect(result.errorCodes).toContain('CANARY_DETECTED');
    expect(result.cursor).toBe('1001');
    assertNoForbiddenText(result);
  });

  it('emits allow-listed codes only and no free text to audit', async () => {
    const harness = port(state());
    await runReconciler(harness.port, NOW);
    for (const code of harness.audited) {
      expect(RECONCILER_CODES).toContain(code as ReconcilerCode);
      expect(code).not.toContain('canary');
    }
    expect(harness.audited).toContain('SWEEP');
    expect(harness.audited).toContain('COUNTER_PRUNE');
  });
});
