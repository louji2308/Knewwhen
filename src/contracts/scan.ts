/**
 * P6.0 — IF-10 scan queue message and frozen scan vocabularies (Arch §7,
 * C-01.4–10, C-02.7). This is a pure contract: no @forge/* import, no record
 * text and no model I/O. The trigger creates only this narrow message; all
 * content is read later from the live Jira record.
 */

export const SCAN_TRIGGERS = Object.freeze([
  'ISSUE_CREATED',
  'ISSUE_UPDATED',
  'COMMENT_CREATED',
  'LINK_CREATED',
  'DAILY_SWEEP',
  'MANUAL',
] as const);

export type ScanTrigger = (typeof SCAN_TRIGGERS)[number];

export const SCAN_EVENT_TYPES = SCAN_TRIGGERS;

export type ScanEventType = ScanTrigger;

export const SCAN_STATUSES = Object.freeze([
  'QUEUED',
  'RUNNING',
  'DONE',
  'FAILED',
  'DEFERRED',
] as const);

export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** Codes only; never a sentence, quote, score or record text. */
export const SCAN_REASON_CODES = Object.freeze([
  'NO_SIGNAL',
  'SIGNAL',
  'SKIPPED_SCOPE',
  'SKIPPED_SELF',
  'SKIPPED_NOACCESS',
  'UNCHANGED',
  'LLM_DEFERRED',
  'LLM_BLOCKED',
  'LLM_TIMEOUT',
  'LLM_INVALID',
  'LEXICON_MISSING',
  'LEXICON_INVALID',
  'SCAN_TIMEOUT',
  'SCAN_FAILED',
] as const);

export type ScanReasonCode = (typeof SCAN_REASON_CODES)[number];

export interface ScanMessage {
  readonly issueId: string;
  readonly eventType: ScanEventType;
  readonly entityId: string | null;
  readonly trigger: ScanTrigger;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const exactKeys = (
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean => {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Strict boundary parser: extra claims such as `role` are not accepted. */
export function parseScanMessage(raw: unknown): ScanMessage | null {
  if (!isRecord(raw) || !exactKeys(raw, ['entityId', 'eventType', 'issueId', 'trigger'])) {
    return null;
  }
  const { entityId, eventType, issueId, trigger } = raw;
  if (!nonEmpty(issueId) || !nonEmpty(trigger) || !SCAN_TRIGGERS.includes(trigger as ScanTrigger)) {
    return null;
  }
  if (!nonEmpty(eventType) || !SCAN_TRIGGERS.includes(eventType as ScanEventType)) {
    return null;
  }
  if (entityId !== null && !nonEmpty(entityId)) return null;
  return {
    issueId,
    eventType: eventType as ScanEventType,
    entityId,
    trigger: trigger as ScanTrigger,
  };
}
