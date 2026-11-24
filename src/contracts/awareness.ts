/**
 * P5.D1 — resolver payload and view vocabulary for the Awareness slice.
 *
 * These shapes contain ids, codes, dates and human-authored notes only. A
 * verbatim Jira slice is fetched live for display and is never a resolver
 * payload, a stored field or any part of an envelope (I-1, I-6).
 */

export const AWARENESS_ROLE_HINTS = Object.freeze([
  'UNKNOWN',
  'VIEWER',
  'REVIEWER',
  'QUALIFIED_PERSON',
  'SITE_ADMIN',
] as const);

export type AwarenessRoleHint = (typeof AWARENESS_ROLE_HINTS)[number];

export interface AwarenessEntryView {
  readonly entryId: string;
  readonly kind: 'RECORD' | 'ENTERED';
  readonly status: 'PROPOSED' | 'CONFIRMED' | 'REJECTED';
  readonly source: string;
  readonly evidenceId: string | null;
  readonly validationStatus: string | null;
  readonly strength: string | null;
  readonly receivedDateEntered: string | null;
  readonly enteredAt: string;
  readonly decidedAt: string | null;
  readonly supersedesId: string | null;
}

export interface AwarenessCandidateView {
  readonly entryId: string;
  readonly basis: 'JIRA_RECORD_TIMESTAMP' | 'ENTERED_RECEIPT_DATE';
  readonly effectiveDate: string | null;
  readonly reasonCode: string | null;
  readonly observationAt: string | null;
  readonly strength: string | null;
}

export interface AwarenessCaseView {
  readonly kind: 'CASE_VIEW';
  readonly caseId: string;
  readonly state: string;
  readonly origin: string;
  readonly createdAt: string;
  readonly entries: readonly AwarenessEntryView[];
  readonly candidates: readonly AwarenessCandidateView[];
  /** Rule data does not select an awareness date; these stay null (C-04.6). */
  readonly preselectedEntryId: null;
  readonly preselectedBasis: null;
}

export interface RevalidationView {
  readonly kind: 'REVALIDATION_VIEW';
  readonly evidenceId: string;
  readonly caseId: string | null;
  readonly state: string;
  readonly bodyEdited: boolean;
  readonly updated: boolean;
}

export type AwarenessView = AwarenessCaseView | RevalidationView;

/** Field names are frozen so the FE and resolvers cannot drift silently. */
export const AWARENESS_REQUEST_FIELDS = Object.freeze({
  caseId: 'caseId',
  issueKey: 'issueKey',
  entryId: 'entryId',
  evidenceId: 'evidenceId',
  receivedDate: 'receivedDate',
  note: 'note',
  reasonCode: 'reasonCode',
  revalidate: 'revalidate',
  reject: 'reject',
  correct: 'correct',
} as const);
