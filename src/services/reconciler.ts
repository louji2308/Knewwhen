/**
 * P10.B2 — bounded, resumable daily reconciler assembly (N-01(c), Arch §15.2).
 *
 * Pure TypeScript: no @forge/* import, no network, no live clock. The observation
 * time is injected as `nowISO`; every durable effect is an injected narrow port,
 * so the whole flow is deterministic under test and run-twice safe.
 *
 * Privacy boundary (I-6, N-04): ids, codes and counts cross this boundary, never
 * Jira record text, account ids or payload bodies. Canary-bearing ids are
 * rejected before they can reach the cursor, which is the only string the
 * result carries.
 *
 * P10.B3 (personal-data reporting cycle and tombstone erasure, N-04(d)) is
 * **Blocked on U-5** and is deliberately absent here. No erasure or tombstone is
 * performed by this slice.
 */

import { canaryScan } from '../contracts/canary';

/** One hard ceiling per bounded step. No step may exceed its own ceiling. */
export const RECONCILER_LIMITS = Object.freeze({
  sweepIssues: 50,
  stalledScans: 50,
  openCases: 50,
  writebackTasks: 50,
  counters: 50,
});

/** Codes only — no sentence, quote, score or record text may enter the audit stream. */
export const RECONCILER_CODES = Object.freeze([
  'SWEEP',
  'STALLED_SCANS',
  'OPEN_CASES',
  'MISSING_WRITEBACKS',
  'WRITEBACK_RETRY',
  'COUNTER_PRUNE',
  'SWEEP_FAILED',
  'STALLED_SCANS_FAILED',
  'OPEN_CASES_FAILED',
  'MISSING_WRITEBACKS_FAILED',
  'WRITEBACK_RETRY_FAILED',
  'COUNTER_PRUNE_FAILED',
  'CURSOR_READ_FAILED',
  'CURSOR_WRITE_FAILED',
  'AUDIT_FAILED',
  'CANARY_DETECTED',
  'PORT_INVALID',
  'CURSOR_INVALID',
  'ID_SHAPE_INVALID',
  'RECONCILER_RUN',
] as const);

export type ReconcilerCode = (typeof RECONCILER_CODES)[number];

export interface ReconcilerCounts {
  readonly issuesSwept: number;
  readonly stalledScans: number;
  readonly openCases: number;
  readonly missingWritebacks: number;
  readonly writebacksRetried: number;
  readonly countersPruned: number;
  readonly errors: number;
}

/** Counts and cursor only. No record text, no account ids, no payload bodies. */
export interface ReconcilerResult {
  readonly status: 'OK' | 'DEGRADED';
  readonly cursor: string;
  readonly counts: ReconcilerCounts;
  readonly errorCodes: readonly ReconcilerCode[];
}

/**
 * Narrow injected operations. The adapters own SQL/JQL/KVS and their dedupe;
 * this module owns only ordering, bounds, the cursor and honest failure codes.
 */
export interface ReconcilerPort {
  readCursor(): Promise<string | null>;
  writeCursor(cursor: string): Promise<void>;
  findUpdatedIssueIds(cursor: string, limit: number): Promise<readonly string[]>;
  findStalledScanIds(beforeISO: string, limit: number): Promise<readonly string[]>;
  findOpenCaseIds(limit: number): Promise<readonly string[]>;
  findMissingWritebackCaseIds(limit: number): Promise<readonly string[]>;
  retryWritebacks(limit: number): Promise<number>;
  pruneCounters(limit: number): Promise<number>;
  audit(code: ReconcilerCode): Promise<void>;
}

const INITIAL_CURSOR = '';
/** Jira issue ids are numeric pointers (Arch §5.1); all other ids are opaque. */
const ISSUE_ID = /^\d{1,18}$/u;
const POINTER_ID = /^[A-Za-z0-9_.:-]{1,128}$/u;

/**
 * Total order for the cursor. Only validated numeric issue ids can reach it,
 * so compare numerically to avoid '9' being treated as after '10'.
 */
function isAfter(candidate: string, current: string): boolean {
  return BigInt(candidate) > BigInt(current);
}

export async function runReconciler(
  port: ReconcilerPort,
  nowISO: string,
): Promise<ReconcilerResult> {
  const failures = new Set<ReconcilerCode>();
  const counts = {
    issuesSwept: 0,
    stalledScans: 0,
    openCases: 0,
    missingWritebacks: 0,
    writebacksRetried: 0,
    countersPruned: 0,
  };

  const finish = (cursor: string): ReconcilerResult => ({
    status: failures.size === 0 ? 'OK' : 'DEGRADED',
    cursor,
    counts: { ...counts, errors: failures.size },
    errorCodes: RECONCILER_CODES.filter((code) => failures.has(code)),
  });

  if (port === null || typeof port !== 'object') {
    failures.add('PORT_INVALID');
    return finish(INITIAL_CURSOR);
  }

  const audit = async (code: ReconcilerCode): Promise<void> => {
    try {
      await port.audit(code);
    } catch {
      // An audit outage must not hide the step it was meant to record.
      failures.add('AUDIT_FAILED');
    }
  };

  const step = async <T>(
    okCode: ReconcilerCode,
    failCode: ReconcilerCode,
    op: () => Promise<T>,
  ): Promise<T | null> => {
    try {
      const value = await op();
      await audit(okCode);
      return value;
    } catch {
      failures.add(failCode);
      await audit(failCode);
      return null;
    }
  };

  /** Keep only ids of the expected shape; neither canary nor free text crosses. */
  const acceptedIds = async (
    value: unknown,
    limit: number,
    valid: (id: string) => boolean,
  ): Promise<readonly string[]> => {
    if (!Array.isArray(value)) throw new Error('RECONCILER_BAD_IDS');
    const accepted: string[] = [];
    let canary = false;
    let malformed = false;
    for (const raw of value.slice(0, limit)) {
      if (typeof raw !== 'string' || raw.length === 0) {
        malformed = true;
        continue;
      }
      if (canaryScan(raw)) {
        canary = true;
        continue;
      }
      if (!valid(raw)) {
        malformed = true;
        continue;
      }
      accepted.push(raw);
    }
    if (canary) {
      failures.add('CANARY_DETECTED');
      await audit('CANARY_DETECTED');
    }
    if (malformed) {
      failures.add('ID_SHAPE_INVALID');
      await audit('ID_SHAPE_INVALID');
    }
    return accepted;
  };

  const boundedCount = (value: unknown, limit: number): number => {
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new Error('RECONCILER_BAD_COUNT');
    return Math.min(limit, Math.max(0, Math.trunc(value)));
  };

  let cursorReadOk = true;
  let baseCursor = INITIAL_CURSOR;
  try {
    const stored = await port.readCursor();
    if (stored === null) {
      baseCursor = INITIAL_CURSOR;
    } else if (typeof stored === 'string' && (stored === INITIAL_CURSOR || ISSUE_ID.test(stored))) {
      baseCursor = stored;
    } else {
      failures.add('CURSOR_INVALID');
      await audit('CURSOR_INVALID');
      throw new Error('RECONCILER_BAD_CURSOR');
    }
  } catch {
    cursorReadOk = false;
    if (!failures.has('CURSOR_INVALID')) {
      failures.add('CURSOR_READ_FAILED');
      await audit('CURSOR_READ_FAILED');
    }
  }
  let cursor = baseCursor;
  let durableCursor = baseCursor;

  // The sweep depends on a trustworthy cursor. A failed read skips only this
  // step; every unrelated bounded step below still runs.
  if (cursorReadOk) {
    const swept = await step('SWEEP', 'SWEEP_FAILED', async () =>
      acceptedIds(
        await port.findUpdatedIssueIds(baseCursor, RECONCILER_LIMITS.sweepIssues),
        RECONCILER_LIMITS.sweepIssues,
        (id) => ISSUE_ID.test(id),
      ),
    );
    if (swept !== null) {
      counts.issuesSwept = swept.length;
      for (const id of swept) {
        if (isAfter(id, cursor)) cursor = id;
      }
    }
  }

  // `beforeISO` is the injected observation time. The adapter's query owns the
  // "stalled" threshold, so no product number is invented in this pure flow.
  const stalled = await step('STALLED_SCANS', 'STALLED_SCANS_FAILED', async () =>
    acceptedIds(
      await port.findStalledScanIds(nowISO, RECONCILER_LIMITS.stalledScans),
      RECONCILER_LIMITS.stalledScans,
      (id) => POINTER_ID.test(id),
    ),
  );
  if (stalled !== null) counts.stalledScans = stalled.length;

  const openCases = await step('OPEN_CASES', 'OPEN_CASES_FAILED', async () =>
    acceptedIds(
      await port.findOpenCaseIds(RECONCILER_LIMITS.openCases),
      RECONCILER_LIMITS.openCases,
      (id) => POINTER_ID.test(id),
    ),
  );
  if (openCases !== null) counts.openCases = openCases.length;

  const missing = await step('MISSING_WRITEBACKS', 'MISSING_WRITEBACKS_FAILED', async () =>
    acceptedIds(
      await port.findMissingWritebackCaseIds(RECONCILER_LIMITS.writebackTasks),
      RECONCILER_LIMITS.writebackTasks,
      (id) => POINTER_ID.test(id),
    ),
  );
  if (missing !== null) counts.missingWritebacks = missing.length;

  const retried = await step('WRITEBACK_RETRY', 'WRITEBACK_RETRY_FAILED', async () =>
    boundedCount(
      await port.retryWritebacks(RECONCILER_LIMITS.writebackTasks),
      RECONCILER_LIMITS.writebackTasks,
    ),
  );
  if (retried !== null) counts.writebacksRetried = retried;

  const pruned = await step('COUNTER_PRUNE', 'COUNTER_PRUNE_FAILED', async () =>
    boundedCount(await port.pruneCounters(RECONCILER_LIMITS.counters), RECONCILER_LIMITS.counters),
  );
  if (pruned !== null) counts.countersPruned = pruned;

  // Persist only a real advance. A second run with no newer ids writes nothing.
  if (cursorReadOk && isAfter(cursor, baseCursor)) {
    try {
      await port.writeCursor(cursor);
      durableCursor = cursor;
    } catch {
      failures.add('CURSOR_WRITE_FAILED');
      await audit('CURSOR_WRITE_FAILED');
    }
  }

  await audit('RECONCILER_RUN');
  return finish(durableCursor);
}
