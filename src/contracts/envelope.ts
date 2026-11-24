/**
 * IF-15 — resolver response envelope (plan §7, §11 P2.D2). Pinned by P2.D2.
 * Every resolver returns this shape: data, a role hint, a correlation id and a
 * typed error code. UI slices hold no authority; the role hint is advisory and
 * the server is the authority (I-4). No envelope field carries record text.
 */

export const ENVELOPE_ERROR_CODES = Object.freeze([
  'OK',
  'NOT_PERMITTED',
  'INVALID_REQUEST',
  'DEPENDENCY_FAILED',
  'RATE_LIMITED',
  'NOT_FOUND',
] as const);

export type EnvelopeErrorCode = (typeof ENVELOPE_ERROR_CODES)[number];

/**
 * `T` is supplied by each feature's own contract and must contain codes, ids
 * and human-authored text only — never verbatim Jira record text (I-1, I-6).
 */
export interface ResolverEnvelope<T> {
  readonly data: T | null;
  readonly roleHint: string;
  readonly correlationId: string;
  readonly code: EnvelopeErrorCode;
}
