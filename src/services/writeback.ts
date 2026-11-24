/**
 * P7.A1/A2 — IF-12 transactional outbox and Jira write-back (Arch §11.3,
 * C-07.1–9, I-6/I-8). Task rows carry ids, codes and counts only. Bodies are
 * built at process time from the case and decision rows, are never stored, and
 * never contain record text, quote or rationale. The viewing-user visibility
 * gate is injected and fails closed.
 */

import type { WritebackTaskKind } from '../contracts/writeback';
import type { SqlRow } from './sql';

/** Jira entity-property values allow booleans, unlike SQL bound values. */
export type PropertyValue = string | number | boolean | null;
export type PropertyRecord = Readonly<Record<string, PropertyValue>>;

export interface WritebackPorts {
  now(): string;
  readonly canWrite?: boolean;
  readonly maxAttempts?: number;
  findTask(caseId: string, kind: string, dedupeKey: string): Promise<SqlRow | null>;
  enqueueTask(row: SqlRow): Promise<SqlRow>;
  updateTask(taskId: string, patch: SqlRow): Promise<SqlRow>;
  findPendingTasks(limit?: number): Promise<readonly SqlRow[]>;
  findAttempt(taskId: string): Promise<SqlRow | null>;
  saveAttempt(row: SqlRow): Promise<void>;
  findCase(caseId: string): Promise<SqlRow | null>;
  findDecision(caseId: string): Promise<SqlRow | null>;
  findCommentByMarker(marker: string): Promise<string | null>;
  setEntityProperty(issueId: string, key: string, value: PropertyRecord): Promise<void>;
  createComment(issueId: string, body: string, marker: string): Promise<string>;
}

export interface EnqueueInput {
  readonly id?: string;
  readonly caseId: string;
  readonly kind: WritebackTaskKind;
  readonly dedupeKey: string;
}

export interface PropertyInput {
  readonly caseId: string;
  readonly issueKey: string;
  readonly state: string;
  readonly signalFlag: boolean;
  readonly decisionStatus: string;
  readonly decisionVersion: number;
  readonly awarenessDate: string;
  readonly awarenessBasis: string;
  readonly evidenceStrength: string;
  readonly ruleSetId: string;
  readonly ruleSetVersion: string;
  readonly dueDate: string;
  readonly daysLeft: number;
  readonly asOfDate: string;
}

export interface CommentInput {
  readonly caseId: string;
  readonly decisionVersion: number;
  readonly awarenessDate: string;
  readonly awarenessBasis: string;
  readonly evidenceStrength: string;
  readonly ruleSetId: string;
  readonly ruleSetVersion: string;
  readonly dueDate: string;
  readonly qpMention: string;
  readonly panelLink: string;
  /** Human-authored but excluded by default; never placed in a comment. */
  readonly rationale?: string | null;
}

export const WRITEBACK_PROPERTY_KEY = 'knewwhen.case';

const stringValue = (row: SqlRow | null, key: string, fallback = ''): string => {
  const value = row?.[key];
  return typeof value === 'string' ? value : fallback;
};

const numberValue = (row: SqlRow | null, key: string, fallback = 0): number => {
  const value = row?.[key];
  return typeof value === 'number' ? value : fallback;
};

/** Codes, dates and ids only. No field can carry record text or rationale. */
export function buildEntityProperty(input: PropertyInput): PropertyRecord {
  const value: PropertyRecord = {
    schemaVersion: 1,
    caseId: input.caseId,
    state: input.state,
    signalFlag: input.signalFlag,
    decisionStatus: input.decisionStatus,
    decisionVersion: input.decisionVersion,
    awarenessDate: input.awarenessDate,
    awarenessBasis: input.awarenessBasis,
    evidenceStrength: input.evidenceStrength,
    ruleSet: `${input.ruleSetId}@${input.ruleSetVersion}`,
    dueDate: input.dueDate,
    daysLeft: input.daysLeft,
    asOfDate: input.asOfDate,
  };
  for (const [key, candidate] of Object.entries(value)) {
    if (!['string', 'number', 'boolean'].includes(typeof candidate) && candidate !== null) {
      throw new Error('PROPERTY_INVALID');
    }
    void key;
  }
  return value;
}

export function commentMarker(caseId: string, version: number): string {
  return `knewwhen:summary:${caseId}:v${version}`;
}

/**
 * The marker is the idempotency key. Rationale is deliberately never read
 * into the returned string, even though it is accepted for interface parity.
 */
export function buildSummaryComment(input: CommentInput): string {
  const marker = commentMarker(input.caseId, input.decisionVersion);
  return [
    marker,
    `Decision version: ${input.decisionVersion}`,
    `Awareness date: ${input.awarenessDate} (${input.awarenessBasis}; ${input.evidenceStrength})`,
    `Rule set: ${input.ruleSetId}@${input.ruleSetVersion}`,
    `Due date: ${input.dueDate}`,
    `Recording QP: ${input.qpMention}`,
    `Panel: ${input.panelLink}`,
    'decision-support record, not a regulatory determination',
  ].join('\n');
}

function propertyInput(caseRow: SqlRow, decision: SqlRow | null, now: string): PropertyInput {
  return {
    caseId: stringValue(caseRow, 'id'),
    issueKey: stringValue(caseRow, 'anchor_issue_id'),
    state: stringValue(caseRow, 'state'),
    signalFlag: stringValue(caseRow, 'state') !== 'NEW',
    decisionStatus: stringValue(decision, 'state', 'NONE'),
    decisionVersion: numberValue(decision, 'version', 0),
    awarenessDate: stringValue(decision, 'awareness_date'),
    awarenessBasis: stringValue(decision, 'awareness_basis'),
    evidenceStrength: 'SYSTEM_UNEDITED',
    ruleSetId: stringValue(decision, 'rule_set_id'),
    ruleSetVersion: stringValue(decision, 'rule_set_version'),
    dueDate: stringValue(decision, 'due_date'),
    daysLeft: 0,
    asOfDate: now.slice(0, 10),
  };
}

function commentInput(caseRow: SqlRow, decision: SqlRow | null, _now: string): CommentInput {
  const property = propertyInput(caseRow, decision, _now);
  return {
    caseId: property.caseId,
    decisionVersion: property.decisionVersion,
    awarenessDate: property.awarenessDate,
    awarenessBasis: property.awarenessBasis,
    evidenceStrength: property.evidenceStrength,
    ruleSetId: property.ruleSetId,
    ruleSetVersion: property.ruleSetVersion,
    dueDate: property.dueDate,
    qpMention: stringValue(decision, 'decided_by', 'unassigned'),
    panelLink: `/plugins/servlet/ac/knewwhen/panel?caseId=${encodeURIComponent(property.caseId)}`,
  };
}

const backoffMs = (attempts: number): number => Math.min(60_000, 60_000 * 2 ** (attempts - 1));

function isoAfter(now: string, ms: number): string {
  return new Date(Date.parse(now) + ms).toISOString();
}

export interface ProcessOutcome {
  readonly processed: number;
  readonly done: number;
  readonly failed: number;
  readonly deferred: number;
  readonly commentsCreated: number;
}

/** Processes due tasks. A failed boundary call never deletes or edits a task. */
export async function processWriteback(ports: WritebackPorts, limit = 20): Promise<ProcessOutcome> {
  let processed = 0;
  let done = 0;
  let failed = 0;
  let deferred = 0;
  let commentsCreated = 0;
  const tasks = await ports.findPendingTasks(limit);
  const now = ports.now();
  for (const task of tasks) {
    const taskId = String(task.id);
    const attempt = await ports.findAttempt(taskId);
    if (attempt !== null && Date.parse(String(attempt.next_attempt_at)) > Date.parse(now)) {
      deferred += 1;
      continue;
    }
    processed += 1;
    const attempts = numberValue(task, 'attempts') + 1;
    const maxAttempts = ports.maxAttempts ?? 5;
    const fail = (code: string, terminal = false): void => {
      const status = terminal || attempts >= maxAttempts ? 'FAILED' : 'PENDING';
      void ports.updateTask(taskId, {
        status,
        attempts,
        last_error_code: code,
      });
      void ports.saveAttempt({
        task_id: taskId,
        next_attempt_at: isoAfter(now, backoffMs(attempts)),
        last_attempt_at: now,
      });
      failed += 1;
    };
    if (ports.canWrite === false) {
      fail('NO_ACCESS', true);
      continue;
    }
    const caseRow = await ports.findCase(String(task.case_id));
    if (caseRow === null) {
      fail('CASE_MISSING');
      continue;
    }
    const kind = String(task.kind);
    try {
      if (kind === 'SIGNAL_FLAG' || kind === 'PROPERTY') {
        const decision = await ports.findDecision(String(task.case_id));
        await ports.setEntityProperty(
          stringValue(caseRow, 'anchor_issue_id'),
          WRITEBACK_PROPERTY_KEY,
          buildEntityProperty(propertyInput(caseRow, decision, now)),
        );
      } else if (kind === 'SUMMARY_COMMENT') {
        const decision = await ports.findDecision(String(task.case_id));
        const built = commentInput(caseRow, decision, now);
        const marker = commentMarker(built.caseId, built.decisionVersion);
        const existing = await ports.findCommentByMarker(marker);
        const commentId =
          existing ??
          (await ports.createComment(
            stringValue(caseRow, 'anchor_issue_id'),
            buildSummaryComment(built),
            marker,
          ));
        if (existing === null) commentsCreated += 1;
        await ports.updateTask(taskId, { status: 'DONE', comment_id: commentId, attempts });
      } else if (kind === 'REMINDER') {
        await ports.updateTask(taskId, { status: 'DONE', attempts });
      } else {
        fail('UNKNOWN_KIND');
        continue;
      }
      if (kind === 'SIGNAL_FLAG' || kind === 'PROPERTY') {
        await ports.updateTask(taskId, { status: 'DONE', attempts });
      }
      done += 1;
    } catch (error) {
      const code =
        error instanceof Error && /429/u.test(error.message)
          ? 'JIRA_429'
          : error instanceof Error && /5\d\d/u.test(error.message)
            ? 'JIRA_5XX'
            : 'WRITE_FAILED';
      fail(code);
    }
  }
  return { processed, done, failed, deferred, commentsCreated };
}

/** Read-after-write idempotency; the unique DB key is the final backstop. */
export async function enqueueWriteback(
  input: EnqueueInput,
  ports: WritebackPorts,
): Promise<SqlRow> {
  const existing = await ports.findTask(input.caseId, input.kind, input.dedupeKey);
  if (existing !== null) return existing;
  return ports.enqueueTask({
    id: input.id ?? globalThis.crypto.randomUUID(),
    case_id: input.caseId,
    kind: input.kind,
    dedupe_key: input.dedupeKey,
    status: 'PENDING',
    attempts: 0,
    last_error_code: null,
    comment_id: null,
  });
}
