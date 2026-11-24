/**
 * P5.D2 — pure FE view model for the Awareness slice (Arch §3, C-04.1-3,
 * C-09.2-3, G-1). It translates envelopes into labels and table rows. It holds
 * no authority: the server gate decides every action. No Jira record text is
 * accepted, stored or produced here; only ids, codes, dates and authored text.
 */

import type { ResolverEnvelope } from '../contracts/envelope';

type DataRecord = Readonly<Record<string, unknown>>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function asRecord(value: unknown): DataRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as DataRecord)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

export const AWARENESS_UI_STRINGS = Object.freeze({
  title: 'Awareness trail',
  notice: 'Decision support, not a regulatory determination or legal advice.',
  empty: 'No case is open for this issue yet.',
  denied:
    'Your account cannot view this case. Ask an administrator for the Reviewer or Qualified person role.',
  dependency: 'KnewWhen could not load the trail. Try again.',
  invalid: 'That request could not be used. Reload the case and try again.',
  trailHeading: 'Awareness trail',
  candidateHeading: 'Candidate awareness dates',
  noEntries: 'No trail entries yet.',
  noCandidates: 'No confirmed candidate dates yet.',
  noteWarning:
    'Your own words. Do not paste text from Jira records: KnewWhen stores what you type here.',
  addReceipt: 'Add possible receipt date',
  confirm: 'Confirm trail entry',
  reject: 'Reject trail entry',
  correct: 'Correct trail entry',
  revalidate: 'Check evidence again',
  cancel: 'Cancel',
  save: 'Save',
  selectEntry: 'Select an entry',
  datePrompt: 'Possible receipt date',
  notePrompt: 'Your note',
  reasonPrompt: 'Reason code',
  emptyDate: 'Enter a date.',
  badDate: 'Use YYYY-MM-DD.',
  futureDate: 'The date cannot be in the future.',
  headers: Object.freeze({
    kind: 'Kind',
    status: 'Status',
    received: 'Received date',
    observed: 'Observed at',
    strength: 'Strength',
    date: 'Date',
    entry: 'Entry',
  }),
  basisLabels: Object.freeze({
    JIRA_RECORD_TIMESTAMP: 'Jira record time',
    ENTERED_RECEIPT_DATE: 'Entered receipt date',
  }),
  statusLabels: Object.freeze({
    PROPOSED: 'Proposed',
    CONFIRMED: 'Confirmed',
    REJECTED: 'Rejected',
  }),
  reasonLabels: Object.freeze({
    RECEIPT_DATE_MISSING: 'not recorded',
    TIMEZONE_RULE_MISSING: 'time-zone rule unavailable',
    EVIDENCE_MISSING: 'evidence unavailable',
    DATE_INVALID: 'date unavailable',
  }),
  strengthLabels: Object.freeze({
    SYSTEM_UNEDITED: 'System text, unedited',
    SYSTEM_EDITED: 'System text, edited',
    HISTORY_UNVERIFIED: 'History not checked',
  }),
  stateLabels: Object.freeze({
    VALID: 'Still matches the Jira record',
    RELOCATED: 'Moved in the Jira record',
    MODIFIED: 'Modified since capture',
    UNAVAILABLE: 'No longer available',
    UNVERIFIABLE: 'Cannot be checked',
    AMBIGUOUS: 'Access could not be confirmed',
  }),
});

export interface AwarenessEntryRow {
  readonly entryId: string;
  readonly kind: string;
  readonly status: string;
  readonly source: string;
  readonly evidenceId: string | null;
  readonly validationStatus: string | null;
  readonly strength: string | null;
  readonly receivedDateEntered: string | null;
  readonly enteredAt: string;
  readonly decidedAt: string | null;
  readonly supersedesId: string | null;
}

export interface AwarenessCandidateRow {
  readonly entryId: string;
  readonly basis: string;
  readonly label: string;
  readonly effectiveDate: string | null;
  readonly reasonCode: string | null;
  readonly strength: string | null;
}

export type AwarenessViewModel =
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'ERROR'; readonly code: string; readonly message: string }
  | {
      readonly kind: 'CASE_VIEW';
      readonly caseId: string;
      readonly state: string;
      readonly roleHint: string;
      readonly entries: readonly AwarenessEntryRow[];
      readonly candidates: readonly AwarenessCandidateRow[];
      readonly preselected: null;
    }
  | {
      readonly kind: 'REVALIDATION';
      readonly state: string;
      readonly bodyEdited: boolean;
      readonly updated: boolean;
    };

function label(
  dictionary: Readonly<Record<string, string>>,
  code: string | null,
  fallback: string,
): string {
  return code === null ? fallback : (dictionary[code] ?? fallback);
}

function entryRow(value: unknown): AwarenessEntryRow | null {
  const row = asRecord(value);
  const entryId = readString(row?.['entryId']);
  if (!row || entryId === null) return null;
  const rawStatus = readString(row['status']) ?? 'PROPOSED';
  const rawStrength = readString(row['strength']);
  const rawKind = readString(row['kind']) ?? 'RECORD';
  return {
    entryId,
    kind: rawKind === 'ENTERED' ? 'Entered by a person' : 'From a Jira record',
    status: label(AWARENESS_UI_STRINGS.statusLabels, rawStatus, 'Proposed'),
    source: readString(row['source']) ?? 'UNKNOWN',
    evidenceId: readString(row['evidenceId']),
    validationStatus: readString(row['validationStatus']),
    strength:
      rawStrength === null
        ? null
        : label(AWARENESS_UI_STRINGS.strengthLabels, rawStrength, 'Not shown'),
    receivedDateEntered: readString(row['receivedDateEntered']),
    enteredAt: readString(row['enteredAt']) ?? '',
    decidedAt: readString(row['decidedAt']),
    supersedesId: readString(row['supersedesId']),
  };
}

function candidateRow(value: unknown): AwarenessCandidateRow | null {
  const row = asRecord(value);
  const entryId = readString(row?.['entryId']);
  const rawBasis = readString(row?.['basis']);
  if (!row || entryId === null || rawBasis === null) return null;
  const basis = label(AWARENESS_UI_STRINGS.basisLabels, rawBasis, 'Other basis');
  const effectiveDate = readString(row['effectiveDate']);
  const reasonCode = readString(row['reasonCode']);
  const reason =
    reasonCode === null
      ? null
      : (AWARENESS_UI_STRINGS.reasonLabels[
          reasonCode as keyof typeof AWARENESS_UI_STRINGS.reasonLabels
        ] ?? 'not available');
  const rawStrength = readString(row['strength']);
  return {
    entryId,
    basis: rawBasis,
    label:
      effectiveDate === null
        ? `${basis}: ${reason ?? 'not available'}`
        : `${basis}: ${effectiveDate}`,
    effectiveDate,
    reasonCode,
    strength:
      rawStrength === null
        ? null
        : label(AWARENESS_UI_STRINGS.strengthLabels, rawStrength, 'Not shown'),
  };
}

function errorMessage(code: string): string {
  switch (code) {
    case 'NOT_PERMITTED':
      return AWARENESS_UI_STRINGS.denied;
    case 'DEPENDENCY_FAILED':
      return AWARENESS_UI_STRINGS.dependency;
    case 'NOT_FOUND':
      return AWARENESS_UI_STRINGS.empty;
    case 'INVALID_REQUEST':
      return AWARENESS_UI_STRINGS.invalid;
    default:
      return AWARENESS_UI_STRINGS.dependency;
  }
}

/** Translate one envelope. Unknown shapes fail closed to an honest error. */
export function awarenessViewModel(envelope: ResolverEnvelope<unknown> | null): AwarenessViewModel {
  if (envelope === null) return { kind: 'LOADING' };
  if (envelope.code !== 'OK') {
    return { kind: 'ERROR', code: envelope.code, message: errorMessage(envelope.code) };
  }
  const data = asRecord(envelope.data);
  if (data === null)
    return { kind: 'ERROR', code: 'INVALID_REQUEST', message: AWARENESS_UI_STRINGS.invalid };
  if (data['kind'] === 'REVALIDATION_VIEW') {
    const rawState = readString(data['state']) ?? 'AMBIGUOUS';
    return {
      kind: 'REVALIDATION',
      state: label(AWARENESS_UI_STRINGS.stateLabels, rawState, 'Cannot be checked'),
      bodyEdited: data['bodyEdited'] === true,
      updated: data['updated'] === true,
    };
  }
  const caseId = readString(data['caseId']);
  if (data['kind'] !== 'CASE_VIEW' || caseId === null) {
    return { kind: 'ERROR', code: 'INVALID_REQUEST', message: AWARENESS_UI_STRINGS.invalid };
  }
  return {
    kind: 'CASE_VIEW',
    caseId,
    state: readString(data['state']) ?? 'UNKNOWN',
    roleHint: envelope.roleHint,
    entries: readArray(data['entries'])
      .map(entryRow)
      .filter((row): row is AwarenessEntryRow => row !== null),
    candidates: readArray(data['candidates'])
      .map(candidateRow)
      .filter((row): row is AwarenessCandidateRow => row !== null),
    preselected: null,
  };
}

export interface AwarenessTableRows {
  readonly trail: readonly { readonly key: string; readonly cells: readonly string[] }[];
  readonly candidates: readonly { readonly key: string; readonly cells: readonly string[] }[];
}

/** Table cell strings are ids, codes and dates only — never record text. */
export function tableRows(model: AwarenessViewModel): AwarenessTableRows {
  if (model.kind !== 'CASE_VIEW') return { trail: [], candidates: [] };
  return {
    trail: model.entries.map((entry) => ({
      key: entry.entryId,
      cells: [
        entry.kind,
        entry.status,
        entry.receivedDateEntered ?? 'not recorded',
        entry.enteredAt,
        entry.strength ?? 'Not shown',
      ],
    })),
    candidates: model.candidates.map((candidate) => ({
      key: `${candidate.entryId}:${candidate.basis}`,
      cells: [candidate.label, candidate.entryId, candidate.strength ?? 'Not shown'],
    })),
  };
}

export type ReceiptProblem = 'EMPTY' | 'FORMAT' | 'FUTURE' | null;

/** Client-side courtesy check; the server gate and trail service still decide. */
export function receiptDateProblem(value: string, asOfDate: string): ReceiptProblem {
  if (value.length === 0) return 'EMPTY';
  if (!ISO_DATE.test(value) || !ISO_DATE.test(asOfDate)) return 'FORMAT';
  return value > asOfDate ? 'FUTURE' : null;
}
