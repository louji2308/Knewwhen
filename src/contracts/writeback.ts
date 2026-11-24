/**
 * P7.0 — IF-12 transactional outbox contract (Arch §11.3, C-07.4–9).
 * The task row carries ids, codes and counts only. No property body, comment
 * body, rationale or record text can enter this contract.
 */

export const WRITEBACK_TASK_KINDS = Object.freeze([
  'SIGNAL_FLAG',
  'PROPERTY',
  'SUMMARY_COMMENT',
  'REMINDER',
] as const);

export type WritebackTaskKind = (typeof WRITEBACK_TASK_KINDS)[number];

export const WRITEBACK_TASK_STATUSES = Object.freeze(['PENDING', 'DONE', 'FAILED'] as const);

export type WritebackTaskStatus = (typeof WRITEBACK_TASK_STATUSES)[number];

export interface WritebackTask {
  readonly id: string;
  readonly caseId: string;
  readonly kind: WritebackTaskKind;
  readonly dedupeKey: string;
  readonly status: WritebackTaskStatus;
  readonly attempts: number;
  readonly lastErrorCode: string | null;
  readonly commentId: string | null;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const TASK_KEYS = [
  'attempts',
  'caseId',
  'commentId',
  'dedupeKey',
  'id',
  'kind',
  'lastErrorCode',
  'status',
] as const;

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Strict boundary parser: a task payload cannot smuggle text or authority. */
export function parseWritebackTask(raw: unknown): WritebackTask | null {
  if (!isRecord(raw)) return null;
  const actual = Object.keys(raw).sort();
  if (actual.length !== TASK_KEYS.length || actual.some((key, index) => key !== TASK_KEYS[index])) {
    return null;
  }
  const { id, caseId, kind, dedupeKey, status, attempts, lastErrorCode, commentId } = raw;
  if (
    !nonEmpty(id) ||
    !nonEmpty(caseId) ||
    !nonEmpty(kind) ||
    !WRITEBACK_TASK_KINDS.includes(kind as WritebackTaskKind) ||
    !nonEmpty(dedupeKey) ||
    !nonEmpty(status) ||
    !WRITEBACK_TASK_STATUSES.includes(status as WritebackTaskStatus) ||
    typeof attempts !== 'number' ||
    !Number.isInteger(attempts) ||
    attempts < 0
  ) {
    return null;
  }
  if (
    (lastErrorCode !== null && !nonEmpty(lastErrorCode)) ||
    (commentId !== null && !nonEmpty(commentId))
  ) {
    return null;
  }
  return {
    id,
    caseId,
    kind: kind as WritebackTaskKind,
    dedupeKey,
    status: status as WritebackTaskStatus,
    attempts,
    lastErrorCode,
    commentId,
  };
}
