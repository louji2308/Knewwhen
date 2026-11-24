/**
 * IF-14 — structured logging contract (plan §7, §11 P2.B2). Pinned by P2.D2.
 * Only ids, codes, counts and durations may be logged (I-6). No value in this
 * contract can carry record text, a quote, model I/O, a token or an account id
 * as text: actor identity is a type, never a logged string value.
 */

/** The complete allow-list of field names a structured log entry may contain. */
export const LOG_FIELD_ALLOWLIST = Object.freeze([
  'correlationId',
  'actorType',
  'actionCode',
  'errorCode',
  'reasonCode',
  'entityType',
  'entityId',
  'count',
  'durationMs',
] as const);

export type LogField = (typeof LOG_FIELD_ALLOWLIST)[number];

/**
 * A log entry is a partial map from allowed fields to ids, codes, counts or
 * durations. String values must be codes/ids from the app's own vocabularies,
 * never source record text; the canary harness (P2.B2) enforces this at build.
 */
export type LogFields = Partial<Record<LogField, string | number>>;

export interface StructuredLogger {
  info(fields: LogFields): void;
  warn(fields: LogFields): void;
  error(fields: LogFields): void;
}
