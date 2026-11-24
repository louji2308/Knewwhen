/**
 * P5.0 — frozen IF-8/IF-9 vocabularies (Arch §12, §5.3, §6.4, §9).
 * These are code values, not regulatory content. A new value is a new versioned
 * contract; existing stored codes are never renamed in place (I-7/I-8).
 */

export const CAPTURE_SOURCES = Object.freeze([
  'LLM_VALIDATED',
  'RULE_MATCH',
  'HUMAN_PHRASE',
  'HUMAN_SEGMENT',
] as const);
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];

export const EVIDENCE_STRENGTHS = Object.freeze([
  'SYSTEM_UNEDITED',
  'SYSTEM_EDITED',
  'HISTORY_UNVERIFIED',
] as const);
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export const VALIDATION_STATUSES = Object.freeze([
  'VALID',
  'RELOCATED',
  'MODIFIED',
  'UNAVAILABLE',
  'UNVERIFIABLE',
] as const);
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const TRAIL_ENTRY_KINDS = Object.freeze(['RECORD', 'ENTERED'] as const);
export type TrailEntryKind = (typeof TRAIL_ENTRY_KINDS)[number];

export const TRAIL_ENTRY_STATUSES = Object.freeze(['PROPOSED', 'CONFIRMED', 'REJECTED'] as const);
export type TrailEntryStatus = (typeof TRAIL_ENTRY_STATUSES)[number];

export const AWARENESS_BASES = Object.freeze([
  'JIRA_RECORD_TIMESTAMP',
  'ENTERED_RECEIPT_DATE',
] as const);
export type AwarenessBasis = (typeof AWARENESS_BASES)[number];

export const REJECTION_REASON_CODES = Object.freeze([
  'MISTAKE',
  'DUPLICATE',
  'SUPERSEDED',
  'OUT_OF_SCOPE',
] as const);
export type RejectionReasonCode = (typeof REJECTION_REASON_CODES)[number];
