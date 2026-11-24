import { describe, expect, it } from 'vitest';
import {
  buildEntityProperty,
  buildSummaryComment,
  enqueueWriteback,
  processWriteback,
  type WritebackPorts,
} from '../src/services/writeback';
import type { SqlRow } from '../src/services/sql';
import type { PropertyRecord } from '../src/services/writeback';

const NOW = '2026-11-24T12:00:00.000Z';
const CASE_ID = 'case-1';

function ports(overrides: Partial<WritebackPorts> = {}) {
  const tasks: SqlRow[] = [];
  const attempts = new Map<string, SqlRow>();
  const properties: Array<{ issueId: string; key: string; value: PropertyRecord }> = [];
  const comments: Array<{ issueId: string; body: string; marker: string }> = [];
  let commentId = 0;
  const built: WritebackPorts = {
    now: () => NOW,
    maxAttempts: 4,
    findTask: async (caseId, kind, dedupeKey) =>
      tasks.find(
        (row) => row.case_id === caseId && row.kind === kind && row.dedupe_key === dedupeKey,
      ) ?? null,
    enqueueTask: async (row) => {
      tasks.push(row);
      return row;
    },
    updateTask: async (taskId, patch) => {
      const row = tasks.find((candidate) => candidate.id === taskId);
      if (row === undefined) throw new Error('NO_TASK');
      Object.assign(row, patch);
      return row;
    },
    findPendingTasks: async () =>
      tasks.filter((row) => row.status === 'PENDING').map((row) => ({ ...row })),
    findAttempt: async (taskId) => attempts.get(taskId) ?? null,
    saveAttempt: async (row) => {
      attempts.set(String(row.task_id), row);
    },
    findCase: async (id) =>
      id === CASE_ID
        ? {
            id: CASE_ID,
            anchor_issue_id: 'KW-100',
            state: 'DECIDED',
            case_seq: 1,
            origin: 'SIGNAL',
            created_at: NOW,
          }
        : null,
    findDecision: async (caseId) =>
      caseId === CASE_ID
        ? {
            id: 'decision-1',
            case_id: CASE_ID,
            version: 1,
            state: 'CONFIRMED',
            awareness_entry_id: 'entry-1',
            awareness_date: '2026-11-05',
            awareness_basis: 'RECORD',
            rule_set_id: 'fda',
            rule_set_version: 'v1',
            due_date: '2026-12-05',
            decided_by: 'qp-1',
            decided_at: NOW,
          }
        : null,
    findCommentByMarker: async () => null,
    setEntityProperty: async (issueId, key, value) => {
      properties.push({ issueId, key, value });
    },
    createComment: async (_issueId, _body, _marker) => {
      commentId += 1;
      return `comment-${commentId}`;
    },
    ...overrides,
  };
  return { ports: built, tasks, attempts, properties, comments };
}

describe('P7.0/IF-12 writeback builders (C-07.1–3, I-6)', () => {
  it('builds an indexed property with codes, dates and ids only', () => {
    const value = buildEntityProperty({
      caseId: CASE_ID,
      issueKey: 'KW-100',
      state: 'DECIDED',
      signalFlag: true,
      decisionStatus: 'CONFIRMED',
      decisionVersion: 1,
      awarenessDate: '2026-11-05',
      awarenessBasis: 'RECORD',
      evidenceStrength: 'SYSTEM_UNEDITED',
      ruleSetId: 'fda',
      ruleSetVersion: 'v1',
      dueDate: '2026-12-05',
      daysLeft: 11,
      asOfDate: '2026-11-24',
    });
    expect(value).toEqual({
      schemaVersion: 1,
      caseId: CASE_ID,
      state: 'DECIDED',
      signalFlag: true,
      decisionStatus: 'CONFIRMED',
      decisionVersion: 1,
      awarenessDate: '2026-11-05',
      awarenessBasis: 'RECORD',
      evidenceStrength: 'SYSTEM_UNEDITED',
      ruleSet: 'fda@v1',
      dueDate: '2026-12-05',
      daysLeft: 11,
      asOfDate: '2026-11-24',
    });
    expect(JSON.stringify(value)).not.toMatch(/patient|complaint text/i);
  });

  it('builds a marker-based comment without the rationale or record text', () => {
    const body = buildSummaryComment({
      caseId: CASE_ID,
      decisionVersion: 1,
      awarenessDate: '2026-11-05',
      awarenessBasis: 'RECORD',
      evidenceStrength: 'SYSTEM_UNEDITED',
      ruleSetId: 'fda',
      ruleSetVersion: 'v1',
      dueDate: '2026-12-05',
      qpMention: '[accountId:qp-1]',
      panelLink: '/plugins/servlet/ac/knewwhen/panel?caseId=case-1',
      rationale: 'sensitive human rationale with patient name',
    });
    expect(body).toContain('decision-support record, not a regulatory determination');
    expect(body).toContain('fda@v1');
    expect(body).toContain('[accountId:qp-1]');
    expect(body).not.toContain('sensitive human rationale');
    expect(body).not.toContain('patient name');
    expect(body).toMatch(/knewwhen:summary:case-1:v1/u);
  });
});

describe('P7.A1/A2 outbox (C-07.4–9, I-8)', () => {
  it('enqueues once for a repeated dedupe key', async () => {
    const fx = ports();
    const input = {
      id: 'task-1',
      caseId: CASE_ID,
      kind: 'SIGNAL_FLAG' as const,
      dedupeKey: `${CASE_ID}:signal`,
    };
    const first = await enqueueWriteback(input, fx.ports);
    const second = await enqueueWriteback(input, fx.ports);
    expect(second).toEqual(first);
    expect(fx.tasks).toHaveLength(1);
  });

  it('writes the indexed property once and marks the task DONE', async () => {
    const fx = ports();
    await enqueueWriteback(
      { id: 'task-1', caseId: CASE_ID, kind: 'SIGNAL_FLAG', dedupeKey: `${CASE_ID}:signal` },
      fx.ports,
    );
    const result = await processWriteback(fx.ports);
    expect(result).toMatchObject({ processed: 1, done: 1 });
    expect(fx.properties).toMatchObject([{ issueId: 'KW-100', key: 'knewwhen.case' }]);
    expect(fx.properties[0]?.value.signalFlag).toBe(true);
    expect(fx.tasks[0]?.status).toBe('DONE');
  });

  it('looks up the body marker before posting and never reposts a comment', async () => {
    const fx = ports({
      findCommentByMarker: async (marker) =>
        marker === 'knewwhen:summary:case-1:v1' ? 'comment-existing' : null,
    });
    await enqueueWriteback(
      { id: 'task-1', caseId: CASE_ID, kind: 'SUMMARY_COMMENT', dedupeKey: `${CASE_ID}:v1` },
      fx.ports,
    );
    const result = await processWriteback(fx.ports);
    expect(result).toMatchObject({ processed: 1, done: 1, commentsCreated: 0 });
    expect(fx.tasks[0]).toMatchObject({ status: 'DONE', comment_id: 'comment-existing' });
  });

  it('fails closed when the viewing user cannot see the issue', async () => {
    const fx = ports({ canWrite: false });
    await enqueueWriteback(
      { id: 'task-1', caseId: CASE_ID, kind: 'SIGNAL_FLAG', dedupeKey: `${CASE_ID}:signal` },
      fx.ports,
    );
    const result = await processWriteback(fx.ports);
    expect(result).toMatchObject({ processed: 1, failed: 1 });
    expect(fx.properties).toEqual([]);
    expect(fx.tasks[0]).toMatchObject({ status: 'FAILED', last_error_code: 'NO_ACCESS' });
  });

  it('retries with backoff and stops after the attempt cap', async () => {
    const fx = ports({
      setEntityProperty: async () => {
        throw new Error('JIRA_5XX');
      },
    });
    await enqueueWriteback(
      { id: 'task-1', caseId: CASE_ID, kind: 'SIGNAL_FLAG', dedupeKey: `${CASE_ID}:signal` },
      fx.ports,
    );
    await processWriteback(fx.ports);
    expect(fx.tasks[0]).toMatchObject({ status: 'PENDING', attempts: 1 });
    expect(fx.attempts.get('task-1')?.next_attempt_at).toBe('2026-11-24T12:01:00.000Z');
    await processWriteback({ ...fx.ports, now: () => '2026-11-24T12:01:00.000Z' });
    expect(fx.tasks[0]).toMatchObject({ status: 'PENDING', attempts: 2 });
    await processWriteback({ ...fx.ports, now: () => '2026-11-24T12:03:00.000Z' });
    await processWriteback({ ...fx.ports, now: () => '2026-11-24T12:07:00.000Z' });
    expect(fx.tasks[0]).toMatchObject({ status: 'FAILED', attempts: 4 });
  });
});
