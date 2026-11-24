/**
 * P2.B2 — canary harness for the privacy backstop (I-6). Pure and dev/test-only.
 * It detects injected sentinel strings in anything about to be logged, stored
 * as SQL parameters, sent in a comment body or placed in an error message.
 * The canaries are synthetic probes; they are never real record text.
 */

import { LOG_FIELD_ALLOWLIST, type LogFields } from './logging';

/** Distinct multi-part probes so a partial match cannot pass by accident. */
export const CANARY_TOKENS = Object.freeze([
  'canary-record-text-alpha-7f3a',
  'canary-quote-secret-bravo-91cd',
  'canary-model-io-charlie-4e2b',
  'canary-account-delta-8a6f',
] as const);

const ALLOWED = new Set<string>(LOG_FIELD_ALLOWLIST);

/** True when any sentinel appears anywhere in the serialised input. */
export function canaryScan(value: string): boolean {
  return CANARY_TOKENS.some((token) => value.includes(token));
}

/**
 * Guard for a structured log entry. Throws typed codes so a leak fails the
 * build in CI, and so no failing string is ever echoed into a log.
 */
export function assertSafeFields(fields: LogFields): void {
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED.has(key)) throw new Error('CANARY_FIELD');
    const text = typeof value === 'number' ? String(value) : value;
    if (text !== undefined && canaryScan(text)) throw new Error('CANARY_LEAK');
  }
}

export type { LogFields };
