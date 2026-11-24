/**
 * P3.A2/A3 — IF-2: the one verbatim validator for model, rule and human quote
 * proposals (Arch §6.3, C-01.1/2, I-1/I-2). Pure core: no @forge/* import.
 * Accepted evidence is always cut from the live segment text, never echoed from
 * the proposal: a paraphrase, score or invented string cannot become evidence.
 */

import { normalise, PLACEHOLDER_CODE_POINTS } from './normalise';

export interface QuoteLimits {
  readonly minChars: number;
  readonly maxChars: number;
}

/** Approved operating defaults from OI-4 (D-008/D-009); not regulatory data. */
export const OI4_QUOTE_LIMITS: QuoteLimits = Object.freeze({ minChars: 1, maxChars: 1000 });

export type RejectCode = 'TOO_SHORT' | 'TOO_LONG' | 'PLACEHOLDER_CROSSED' | 'NOT_VERBATIM';

export interface AcceptedSpan {
  readonly accepted: true;
  /** Offset into the normalised segment, at the first occurrence. */
  readonly spanStart: number;
  readonly spanLen: number;
  /** Verbatim slice taken from the segment, not from the proposal. */
  readonly slice: string;
}

export interface RejectedQuote {
  readonly accepted: false;
  readonly reasonCode: RejectCode;
}

export type ValidationResult = AcceptedSpan | RejectedQuote;

const reject = (reasonCode: RejectCode): RejectedQuote => ({ accepted: false, reasonCode });

const containsPlaceholder = (text: string): boolean => {
  for (const character of text) {
    if (PLACEHOLDER_CODE_POINTS.has(character)) return true;
  }
  return false;
};

/**
 * Accept proposal Q for segment text T iff N(Q) is a substring of N(T), with no
 * placeholder in either, inside the injected length limits. Returns the first
 * occurrence so the caller can point at the live record.
 */
export function validateQuote(
  segmentText: string,
  quote: string,
  limits: QuoteLimits = OI4_QUOTE_LIMITS,
): ValidationResult {
  const proposed = normalise(quote);
  if (proposed.length < limits.minChars) return reject('TOO_SHORT');
  if (proposed.length > limits.maxChars) return reject('TOO_LONG');

  // Check the raw proposal too: a placeholder must not be smuggled in through
  // an unusual Unicode representation that normalisation would otherwise hide.
  if (containsPlaceholder(quote) || containsPlaceholder(proposed)) {
    return reject('PLACEHOLDER_CROSSED');
  }

  const segment = normalise(segmentText);
  const spanStart = segment.indexOf(proposed);
  if (spanStart < 0) return reject('NOT_VERBATIM');

  const slice = segment.slice(spanStart, spanStart + proposed.length);
  return { accepted: true, spanStart, spanLen: proposed.length, slice };
}
