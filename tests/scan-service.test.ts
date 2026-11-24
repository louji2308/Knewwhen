import { describe, expect, it } from 'vitest';
import { validateQuote } from '../src/core/validate';
import type { Lexicon } from '../src/core/screener';
import type { HashKeyMaterial } from '../src/services/hash-key';
import type { LlmGateway, LlmPolicy, LlmState } from '../src/services/scan/llm';
import {
  runScan,
  type ScanInput,
  type ScanPorts,
  type ScanSegmentInput,
} from '../src/services/scan';
import type { SqlRow } from '../src/services/sql';

const KEY: HashKeyMaterial = { id: 'key-1', value: 'scan-key' };
const lexicon: Lexicon = {
  version: 'lex-v1',
  phrases: [{ id: 'p1', category: 'INJURY', text: 'device event' }],
};

const llmPolicy: LlmPolicy = {
  aiEnabled: true,
  killSwitch: false,
  promptVersion: 'prompt-v1',
  modelId: 'model-v1',
  maxSegmentsPerCall: 1,
  perIssueLimit: 3,
  perSiteLimit: 10,
  breakerThreshold: 2,
};

const emptyLlmState: LlmState = {
  issueCalls: 0,
  siteCalls: 0,
  invalidStreak: 0,
  breakerOpen: false,
};

function segment(overrides: Partial<ScanSegmentInput> = {}): ScanSegmentInput {
  return {
    segmentKey: 'comment:1',
    text: 'A device event was noted.',
    recordKind: 'COMMENT',
    recordCreatedAt: '2026-11-05T09:00:00.000Z',
    recordUpdatedAt: '2026-11-05T09:00:00.000Z',
    authorAccountId: 'author-1',
    changelogChecked: false,
    changelogHadEdit: false,
    ...overrides,
  };
}

function input(overrides: Partial<ScanInput> = {}): ScanInput {
  return {
    issueId: 'KW-100',
    scanId: 'scan-1',
    startedAt: '2026-11-24T12:00:00.000Z',
    now: '2026-11-24T12:00:05.000Z',
    timeoutMs: 25_000,
    segments: [segment()],
    lexicon,
    ...overrides,
  };
}

function ports(overrides: Partial<ScanPorts> = {}) {
  const persisted: SqlRow[] = [];
  const captures: string[] = [];
  const cases: SqlRow[] = [];
  const entries: SqlRow[] = [];
  const tasks: SqlRow[] = [];
  const scans: SqlRow[] = [];
  const states = new Map<string, SqlRow>();

  const built: ScanPorts = {
    key: KEY,
    capture: async (captureInput) => {
      const validation = validateQuote(captureInput.segmentText, captureInput.quote);
      if (!validation.accepted) throw new Error('CAPTURE_REJECTED');
      captures.push(validation.slice);
      const row: SqlRow = {
        id: captureInput.id ?? `evidence-${captures.length}`,
        issue_id: captureInput.issueId,
        segment_key: captureInput.segmentKey,
      };
      persisted.push(row);
      return { inserted: true, row, span: validation.slice };
    },
    findSegmentStates: async (issueId) =>
      [...states.values()].filter((row) => row.issue_id === issueId),
    saveSegmentState: async (row) => {
      states.set(`${row.issue_id}:${row.segment_key}`, row);
      persisted.push(row);
      return row;
    },
    findCase: async (issueId) => cases.find((row) => row.anchor_issue_id === issueId) ?? null,
    createCase: async (row) => {
      cases.push(row);
      persisted.push(row);
      return row;
    },
    findTrailEntries: async (evidenceId) => entries.filter((row) => row.evidence_id === evidenceId),
    addRecord: async (row) => {
      entries.push(row);
      persisted.push(row);
      return row;
    },
    findTask: async (caseId, kind, dedupeKey) =>
      tasks.find(
        (row) => row.case_id === caseId && row.kind === kind && row.dedupe_key === dedupeKey,
      ) ?? null,
    enqueueTask: async (row) => {
      tasks.push(row);
      persisted.push(row);
      return row;
    },
    saveScan: async (row) => {
      scans.push(row);
      persisted.push(row);
      return row;
    },
    now: () => input().now,
    ...overrides,
  };
  return { ports: built, persisted, captures, cases, entries, tasks, scans, states };
}

describe('P6.A2/A3 scan consumer (C-01.4-8, C-02.5, G-7)', () => {
  it('captures a rule match, opens one case and enqueues SIGNAL_FLAG with ids only', async () => {
    const fx = ports();
    const result = await runScan(input(), fx.ports);
    expect(result).toMatchObject({
      status: 'DONE',
      result: 'SIGNAL',
      reasonCode: 'SIGNAL',
      segmentsSeen: 1,
      segmentsScanned: 1,
    });
    expect(fx.captures).toEqual(['device event']);
    expect(fx.cases).toHaveLength(1);
    expect(fx.entries).toHaveLength(1);
    expect(fx.tasks).toMatchObject([{ kind: 'SIGNAL_FLAG', status: 'PENDING' }]);
    expect(fx.scans[0]).toMatchObject({ result: 'SIGNAL', status: 'DONE' });
    expect(JSON.stringify(fx.persisted)).not.toContain('device event was noted');
  });

  it('stores NO_SIGNAL with versions and counts, without opening a case', async () => {
    const fx = ports();
    const result = await runScan(
      input({ segments: [segment({ text: 'ordinary feature request' })] }),
      fx.ports,
    );
    expect(result).toMatchObject({
      status: 'DONE',
      result: 'NO_SIGNAL',
      reasonCode: 'NO_SIGNAL',
      segmentsSeen: 1,
      segmentsScanned: 1,
    });
    expect(fx.cases).toEqual([]);
    expect(fx.tasks).toEqual([]);
    expect(fx.scans[0]).toMatchObject({
      lexicon_version: 'lex-v1',
      segments_seen: 1,
      segments_scanned: 1,
    });
  });

  it('skips unchanged segments but rescans an edited one', async () => {
    const fx = ports();
    await runScan(input(), fx.ports);
    const before = fx.ports.findSegmentStates;
    expect((await before('KW-100'))[0]).toMatchObject({ segment_key: 'comment:1' });
    const second = await runScan(input({ scanId: 'scan-2' }), fx.ports);
    expect(second.reasonCode).toBe('UNCHANGED');
    expect(fx.captures).toHaveLength(1);
    const third = await runScan(
      input({ scanId: 'scan-3', segments: [segment({ text: 'A device event recurred.' })] }),
      fx.ports,
    );
    expect(third.result).toBe('SIGNAL');
    expect(fx.captures).toHaveLength(2);
  });

  it('keeps rules working after an invalid AI result and records the reason', async () => {
    let calls = 0;
    const fake: LlmGateway = {
      async call() {
        calls += 1;
        return { text: 'not json' };
      },
    };
    const fx = ports({
      llmGateway: fake,
      llmPolicy,
      llmState: emptyLlmState,
    });
    const result = await runScan(input(), fx.ports);
    expect(result).toMatchObject({ status: 'DONE', result: 'SIGNAL', reasonCode: 'LLM_INVALID' });
    expect(calls).toBe(2);
    expect(fx.captures).toEqual(['device event']);
    expect(result.aiReasonCode).toBe('LLM_INVALID');
  });

  it('is idempotent when the same event is replayed', async () => {
    const fx = ports();
    await runScan(input(), fx.ports);
    const replay = await runScan(input(), fx.ports);
    expect(replay).toMatchObject({ result: 'SIGNAL', reasonCode: 'UNCHANGED' });
    expect(fx.captures).toHaveLength(1);
    expect(fx.cases).toHaveLength(1);
    expect(fx.entries).toHaveLength(1);
    expect(fx.tasks).toHaveLength(1);
  });

  it('skips app-written comments and defers before the timeout budget', async () => {
    const fx = ports();
    const skipped = await runScan(
      input({
        segments: [segment({ text: 'knewwhen:decision:case-1:v1 device event', isOwn: true })],
      }),
      fx.ports,
    );
    expect(skipped).toMatchObject({ result: 'SKIPPED', reasonCode: 'SKIPPED_SELF' });
    const deferred = await runScan(
      input({
        now: '2026-11-24T12:00:21.000Z',
        segments: [segment(), segment({ segmentKey: 'comment:2' })],
      }),
      fx.ports,
    );
    expect(deferred.status).toBe('DEFERRED');
  });

  it('does not call the scan NO_SIGNAL when the lexicon is unavailable', async () => {
    const fx = ports();
    const result = await runScan(input({ lexicon: undefined }), fx.ports);
    expect(result).toMatchObject({ status: 'FAILED', reasonCode: 'LEXICON_MISSING' });
    expect(fx.scans[0]).toMatchObject({ status: 'FAILED', result: 'SKIPPED' });
  });
});
