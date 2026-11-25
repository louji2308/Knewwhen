/**
 * P8.C1 — pure view model for the Earlier records slice (C-03, C-09.2–3, G-8).
 * It accepts resolver envelopes only: ids, codes, dates, counts and authored
 * phrases. No Jira record text can enter or leave this view (I-1/I-6).
 */

import type { ResolverEnvelope } from '../contracts/envelope';

export const LOOKBACK_UI_STRINGS = Object.freeze({
  title: 'Earlier records',
  notice: 'Decision support, not a regulatory determination or legal advice.',
  idle: 'Run a lookback to see earlier records that may describe the same event.',
  unavailable: 'Lookback is not available on this installation.',
  error: 'The lookback result could not be loaded.',
  run: 'Run lookback',
  continue: 'Search earlier than this record',
  sameEvent: 'Same event?',
  yes: 'Yes',
  no: 'No',
  unsure: 'Unsure',
  reopen: 'Reopen',
  restricted: 'You can review candidates; only a Qualified person can answer.',
  incomplete: 'Search incomplete. Other records may exist.',
  noCandidates: 'No earlier candidates were proposed in this step.',
  noAnchor: 'Open a case with a Jira-backed trail entry first.',
  strength: Object.freeze({
    JIRA_RECORD_TIMESTAMP: 'Jira record time',
    JIRA_COMMENT_TIMESTAMP: 'Jira comment time',
  }),
  states: Object.freeze({
    PROPOSED: 'Proposed',
    ACCEPTED: 'Accepted by a person',
    REJECTED: 'Rejected by a person',
    UNSURE: 'Unsure',
    REOPENED: 'Reopened',
  }),
  confidence: Object.freeze({
    HIGH: 'A relationship and matching distinctive terms',
    MEDIUM: 'A strong single signal',
    LOW: 'Worth a look; weak support',
  }),
  unavailableRelationships: Object.freeze({
    ORG_JSM_ABSENT: 'organisation could not be checked (JSM unavailable)',
    PRODUCT_NOT_MAPPED: 'product could not be checked (no product field mapped)',
  }),
  caps: Object.freeze({
    MAX_SEARCH_CALLS: 'search-call limit reached',
    MAX_ISSUES_EXAMINED: 'issue limit reached',
    MAX_CANDIDATES_SHOWN: 'candidate limit reached',
    MAX_DEPTH: 'link-depth limit reached',
    RATE_LIMITED: 'Jira rate limit reached',
  }),
  retry: 'Jira asked KnewWhen to wait before another search.',
  decideMessage: 'The same-event answer was recorded.',
  segmentsTitle: 'Choose the record segment',
  wholeSegment: 'Use the whole segment',
  phrase: 'Your words to locate in the live segment',
  phraseWarning: 'Your own words only. Do not paste text from a Jira record.',
  confirmChoice: 'Record answer',
  cancel: 'Cancel',
});

type Data = Readonly<Record<string, unknown>>;

const record = (value: unknown): Data | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Data) : null;

const text = (value: unknown): string =>
  typeof value === 'string' && value.length > 0 ? value : '';

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

export interface LookbackCandidateRow {
  readonly id: string;
  readonly issueKey: string;
  readonly recordTs: string;
  readonly strength: string;
  readonly reasons: readonly string[];
  readonly confidence: string;
  readonly confidenceHelp: string;
  readonly state: string;
  readonly rawState: string;
  readonly segmentKey: string;
}

export interface LookbackSegmentRow {
  readonly key: string;
  readonly authorAccountId: string;
  readonly recordCreatedAt: string;
  readonly strength: string;
  readonly wholeSegmentAllowed: boolean;
}

export type LookbackViewModel =
  | { readonly kind: 'IDLE'; readonly message: string; readonly canRun: boolean }
  | { readonly kind: 'UNAVAILABLE' | 'ERROR'; readonly message: string; readonly canRun: boolean }
  | {
      readonly kind: 'RESULT';
      readonly message: string;
      readonly canRun: boolean;
      readonly canAnswer: boolean;
      readonly incomplete: boolean;
      readonly done: boolean;
      readonly nextCursor: string | null;
      readonly coverage: readonly string[];
      readonly candidates: readonly LookbackCandidateRow[];
      readonly examined: number;
      readonly searchCalls: number;
    }
  | {
      readonly kind: 'SEGMENTS';
      readonly message: string;
      readonly canRun: boolean;
      readonly canAnswer: boolean;
      readonly incomplete: boolean;
      readonly done: boolean;
      readonly nextCursor: string | null;
      readonly coverage: readonly string[];
      readonly candidates: readonly LookbackCandidateRow[];
      readonly examined: number;
      readonly searchCalls: number;
      readonly segments: readonly LookbackSegmentRow[];
    }
  | {
      readonly kind: 'DECISION';
      readonly message: string;
      readonly canRun: boolean;
      readonly canAnswer: boolean;
      readonly incomplete: boolean;
      readonly done: boolean;
      readonly nextCursor: string | null;
      readonly coverage: readonly string[];
      readonly candidates: readonly LookbackCandidateRow[];
      readonly examined: number;
      readonly searchCalls: number;
      readonly newAnchorEntryId: string | null;
    };

const empty = (kind: 'IDLE' | 'UNAVAILABLE' | 'ERROR', message: string): LookbackViewModel => ({
  kind,
  message,
  canRun: false,
});

function candidateRow(value: unknown): LookbackCandidateRow | null {
  const row = record(value);
  if (row === null || text(row.id) === '' || text(row.issueKey) === '') return null;
  const confidence = text(row.confidence);
  const rawState = text(row.state);
  return {
    id: text(row.id),
    issueKey: text(row.issueKey),
    recordTs: text(row.recordTs),
    strength:
      LOOKBACK_UI_STRINGS.strength[
        text(row.tsStrength) as keyof typeof LOOKBACK_UI_STRINGS.strength
      ] ?? 'Jira time',
    reasons: Array.isArray(row.reasons)
      ? row.reasons.filter((reason): reason is string => typeof reason === 'string')
      : [],
    confidence: confidence || 'LOW',
    confidenceHelp:
      LOOKBACK_UI_STRINGS.confidence[confidence as keyof typeof LOOKBACK_UI_STRINGS.confidence] ??
      'Weak support',
    state:
      LOOKBACK_UI_STRINGS.states[rawState as keyof typeof LOOKBACK_UI_STRINGS.states] ?? rawState,
    rawState,
    segmentKey: text(row.candidateSegmentKey),
  };
}

function base(data: Data, roleHint: string) {
  const coverage: string[] = [];
  if (Array.isArray(data.capsHit)) {
    for (const cap of data.capsHit) {
      if (typeof cap !== 'string') continue;
      coverage.push(LOOKBACK_UI_STRINGS.caps[cap as keyof typeof LOOKBACK_UI_STRINGS.caps] ?? cap);
    }
  }
  if (Array.isArray(data.unavailableRelationships)) {
    for (const code of data.unavailableRelationships) {
      if (typeof code !== 'string') continue;
      coverage.push(
        LOOKBACK_UI_STRINGS.unavailableRelationships[
          code as keyof typeof LOOKBACK_UI_STRINGS.unavailableRelationships
        ] ?? code,
      );
    }
  }
  if (data.retryAfterSeconds !== undefined) coverage.push(LOOKBACK_UI_STRINGS.retry);
  const incomplete = data.incomplete === true;
  const rawCandidates = Array.isArray(data.candidates) ? data.candidates : [];
  return {
    message: incomplete ? LOOKBACK_UI_STRINGS.incomplete : '',
    canRun: true,
    canAnswer: roleHint === 'QUALIFIED_PERSON',
    incomplete,
    done: data.done === true,
    nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
    coverage,
    candidates: rawCandidates
      .map(candidateRow)
      .filter((row): row is LookbackCandidateRow => row !== null),
    examined: count(data.examined),
    searchCalls: count(data.searchCalls),
  };
}

/** Translate one envelope. Unknown shapes fail closed without showing text. */
export function lookbackViewModel(envelope: ResolverEnvelope<unknown> | null): LookbackViewModel {
  if (envelope === null) return empty('IDLE', LOOKBACK_UI_STRINGS.idle);
  if (envelope.code === 'NOT_FOUND' || envelope.code === 'NOT_PERMITTED') {
    return empty('UNAVAILABLE', LOOKBACK_UI_STRINGS.unavailable);
  }
  if (envelope.code !== 'OK') return empty('ERROR', LOOKBACK_UI_STRINGS.error);
  const data = record(envelope.data);
  if (data === null) return empty('ERROR', LOOKBACK_UI_STRINGS.error);
  const common = base(data, envelope.roleHint);

  if (data.kind === 'LOOKBACK_STEP') return { kind: 'RESULT', ...common };
  if (data.kind === 'LOOKBACK_LIST') return { kind: 'RESULT', ...common };
  if (data.kind === 'LOOKBACK_SEGMENTS') {
    const segments: LookbackSegmentRow[] = Array.isArray(data.segments)
      ? data.segments
          .map(record)
          .filter((row): row is Data => row !== null && text(row.key) !== '')
          .map((row) => ({
            key: text(row.key),
            authorAccountId: text(row.authorAccountId),
            recordCreatedAt: text(row.recordCreatedAt),
            strength: text(row.strength),
            wholeSegmentAllowed: row.wholeSegmentAllowed === true,
          }))
      : [];
    return { kind: 'SEGMENTS', ...common, segments };
  }
  if (data.kind === 'LOOKBACK_DECISION') {
    return {
      kind: 'DECISION',
      ...common,
      message: LOOKBACK_UI_STRINGS.decideMessage,
      newAnchorEntryId: text(data.trailEntryId) || null,
    };
  }
  return empty('ERROR', LOOKBACK_UI_STRINGS.error);
}

const JIRA_ENTRY_KIND = 'From a Jira record';

/** Only a Jira-backed trail entry can anchor a strictly-earlier search (I-3). */
export function lookbackAnchorEntryId(
  entries: readonly { readonly entryId: string; readonly kind: string }[],
  selectedEntryId?: string,
): string | null {
  if (selectedEntryId !== undefined) {
    const chosen = entries.find(
      (entry) => entry.entryId === selectedEntryId && entry.kind === JIRA_ENTRY_KIND,
    );
    if (chosen !== undefined) return chosen.entryId;
  }
  return entries.find((entry) => entry.kind === JIRA_ENTRY_KIND)?.entryId ?? null;
}

export interface LookbackCandidateGroup {
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly rows: readonly LookbackCandidateRow[];
}

/** Display order is fixed; a person may re-sort the table in the panel later. */
export function groupLookbackCandidates(
  candidates: readonly LookbackCandidateRow[],
): readonly LookbackCandidateGroup[] {
  const order: readonly LookbackCandidateGroup['confidence'][] = ['HIGH', 'MEDIUM', 'LOW'];
  return order
    .map((confidence) => ({
      confidence,
      rows: candidates.filter((candidate) => candidate.confidence === confidence),
    }))
    .filter((group) => group.rows.length > 0);
}
