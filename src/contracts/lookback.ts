/**
 * P8.0 — frozen lookback vocabulary and shapes (Arch §8, C-03, IF-11).
 * The six reason codes and three ordinal labels come from the architecture.
 * No label can mean a human decision: only "same event?" can do that (I-4/I-5).
 * Envelopes carry pointers, codes, dates and overlap only; record text stays
 * transient inside the service and is never persisted or returned to the FE.
 */

export const LOOKBACK_REASON_CODES = Object.freeze([
  'LINKED',
  'LINKED_2',
  'SAME_REPORTER',
  'SAME_ORG',
  'SAME_PRODUCT',
  'TEXT_OVERLAP',
] as const);

export type LookbackReasonCode = (typeof LOOKBACK_REASON_CODES)[number];

export const LOOKBACK_CONFIDENCE_LABELS = Object.freeze(['HIGH', 'MEDIUM', 'LOW'] as const);
export type LookbackConfidence = (typeof LOOKBACK_CONFIDENCE_LABELS)[number];

export const CANDIDATE_STATES = Object.freeze([
  'PROPOSED',
  'ACCEPTED',
  'REJECTED',
  'UNSURE',
  'REOPENED',
] as const);
export type CandidateState = (typeof CANDIDATE_STATES)[number];

export const CAP_CODES = Object.freeze([
  'MAX_SEARCH_CALLS',
  'MAX_ISSUES_EXAMINED',
  'MAX_CANDIDATES_SHOWN',
  'MAX_DEPTH',
  'RATE_LIMITED',
] as const);
export type CapCode = (typeof CAP_CODES)[number];

export const UNAVAILABLE_RELATIONSHIP_CODES = Object.freeze([
  'ORG_JSM_ABSENT',
  'PRODUCT_NOT_MAPPED',
] as const);
export type UnavailableRelationshipCode = (typeof UNAVAILABLE_RELATIONSHIP_CODES)[number];

export interface LookbackProfile {
  readonly version: string;
  readonly highOverlap: number;
  readonly moderateOverlap: number;
  readonly minDistinctiveTokens: number;
}

export interface LookbackCaps {
  readonly maxSearchCalls: number;
  readonly maxIssues: number;
  readonly maxCandidatesPerLabel: number;
  readonly depth: number;
}

export interface LookbackRelationships {
  readonly reporterId?: string;
  readonly orgKey?: string;
  readonly productKey?: string;
}

/** Authoritative anchor data resolved server-side, never from the client. */
export interface LookbackAnchor {
  readonly entryId: string;
  readonly issueKey: string;
  /** Jira's record time, not app observation time (I-3). */
  readonly recordTs: string;
  /** Distinctive tokens from the anchor's validated quotes only. */
  readonly tokens: readonly string[];
  readonly watchedProjects: readonly string[];
  readonly relationships: LookbackRelationships;
  readonly unavailableRelationships: readonly UnavailableRelationshipCode[];
}

/** IF-11: the client names only a case, an anchor entry and an optional cursor. */
export interface LookbackStepInput {
  readonly caseId: string;
  readonly anchorEntryId: string;
  readonly cursor?: string;
}

export interface CandidateRecord {
  readonly issueId: string;
  readonly issueKey: string;
  readonly projectKey: string;
  readonly recordTs: string;
  readonly tsStrength: 'JIRA_RECORD_TIMESTAMP' | 'JIRA_COMMENT_TIMESTAMP';
  readonly relationships: {
    readonly linkedDepth?: 1 | 2;
    readonly sameReporter?: boolean;
    readonly sameOrg?: boolean;
    readonly sameProduct?: boolean;
  };
  /** Transient only: never written to SQL, logs, errors or evidence (I-6). */
  readonly segments: readonly { readonly key: string; readonly text: string }[];
}

export interface LookbackCandidateView {
  readonly id: string;
  readonly caseId: string;
  readonly issueId: string;
  readonly issueKey: string;
  readonly candidateSegmentKey: string;
  readonly recordTs: string;
  readonly tsStrength: CandidateRecord['tsStrength'];
  readonly reasonCodes: readonly LookbackReasonCode[];
  readonly reasons: readonly string[];
  readonly overlap: number;
  readonly confidence: LookbackConfidence;
  readonly state: CandidateState;
  readonly anchorEntryId: string;
}

/** Segment metadata only. No Jira text is sent in a resolver envelope. */
export interface LookbackSegmentOption {
  readonly key: string;
  readonly authorAccountId: string | null;
  readonly recordCreatedAt: string;
  readonly recordUpdatedAt: string;
  readonly strength: 'SYSTEM_UNEDITED' | 'SYSTEM_EDITED' | 'HISTORY_UNVERIFIED';
  readonly wholeSegmentAllowed: boolean;
}

/** A human-authored phrase is allowed; a quoted record phrase is not stored. */
export interface CandidateChoice {
  readonly segmentKey: string;
  readonly quote?: string;
  readonly wholeSegment?: boolean;
}
