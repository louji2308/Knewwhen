/**
 * P8.A2/A3/A4 — resumable lookback and the QP-only "same event?" flow
 * (Arch §8, C-03.1–13, I-4/I-6/I-8). Pure service: the authoritative anchor,
 * Jira search, live segment list and acceptance side-effects are injected.
 * Candidate text is scored in memory and never reaches SQL, logs, errors,
 * envelope responses or evidence. One bad record never fails a step.
 */

import type { Role } from '../contracts/authorisation';
import type {
  CandidateChoice,
  CandidateRecord,
  CandidateState,
  CapCode,
  LookbackAnchor,
  LookbackCandidateView,
  LookbackConfidence,
  LookbackReasonCode,
  LookbackSegmentOption,
  LookbackStepInput,
  UnavailableRelationshipCode,
} from '../contracts/lookback';
import {
  CONFIDENCE_ORDER,
  DEFAULT_LOOKBACK_CAPS,
  distinctiveTokens,
  LOOKBACK_PROFILE_VERSION,
  matchReasons,
  rankCandidate,
} from '../core/lookback-matcher';

export type AnchorResult =
  LookbackAnchor | { readonly status: 'NOT_FOUND' | 'DENIED' | 'UNAVAILABLE' };

export interface AnchorRequest {
  readonly caseId: string;
  readonly anchorEntryId: string;
  readonly viewerAccountId: string;
}

export interface LookbackSearchRequest {
  readonly caseId: string;
  readonly anchorEntryId: string;
  readonly anchorIssueKey: string;
  readonly beforeISO: string;
  readonly watchedProjects: readonly string[];
  readonly tokens: readonly string[];
  readonly relationships: LookbackAnchor['relationships'];
  readonly maxIssues: number;
  readonly viewerAccountId: string;
  readonly cursor?: string;
}

export type LookbackSearchResult =
  | {
      readonly status: 'OK' | 'RATE_LIMITED';
      readonly records: readonly CandidateRecord[];
      readonly examined: number;
      readonly nextCursor: string | null;
      readonly retryAfterSeconds?: number;
      readonly unavailableRelationships?: readonly UnavailableRelationshipCode[];
    }
  | { readonly status: 'FAILED'; readonly reasonCode: 'JIRA_PERMANENT' | 'JIRA_AUTH' };

export interface LookbackSearchPort {
  search(request: LookbackSearchRequest): Promise<LookbackSearchResult>;
}

export interface StoredRun {
  readonly cursor: string | null;
  readonly examined: number;
  readonly searchCalls: number;
  readonly capsHit: readonly CapCode[];
  readonly status: 'ACTIVE' | 'DONE';
}

export interface StoredCandidate {
  readonly id: string;
  readonly issueId: string;
  readonly state: CandidateState;
  readonly caseId: string;
}

export interface LookbackStatePort {
  getRun(key: string): Promise<StoredRun | null>;
  saveRun(key: string, run: StoredRun): Promise<void>;
  getCandidate(id: string): Promise<StoredCandidate | null>;
  /** Receives ids, codes, dates and the overlap only — never record text. */
  saveCandidate(view: LookbackCandidateView, issueId: string): Promise<string>;
  updateCandidateState(id: string, state: CandidateState, decidedBy?: string): Promise<void>;
  listCandidates(caseId: string): Promise<readonly StoredCandidate[]>;
  /** Stored pointers and codes only; used when a finished run is re-opened. */
  listCandidateViews(caseId: string): Promise<readonly LookbackCandidateView[]>;
}

export interface LookbackAcceptResult {
  readonly evidenceItemId: string;
  readonly trailEntryId: string;
}

export interface AcceptCandidateInput {
  readonly caseId: string;
  readonly candidateId: string;
  readonly actor: string;
  readonly choice: CandidateChoice;
}

export interface LookbackDependencies {
  readonly search: LookbackSearchPort;
  readonly state: LookbackStatePort;
  readonly resolveAnchor: (request: AnchorRequest) => Promise<AnchorResult>;
  readonly acceptCandidate?: (input: AcceptCandidateInput) => Promise<LookbackAcceptResult>;
  readonly showCandidate?: (input: {
    readonly caseId: string;
    readonly candidateId: string;
    readonly viewerAccountId: string;
  }) => Promise<
    | { readonly status: 'FOUND'; readonly segments: readonly LookbackSegmentOption[] }
    | { readonly status: 'DENIED' | 'DELETED' | 'ISSUE_UNAVAILABLE' | 'NOT_FOUND' }
  >;
  readonly recordAudit?: (event: {
    readonly actionCode: string;
    readonly errorCode: string;
  }) => Promise<void>;
}

export interface LookbackStepResult {
  readonly status: 'COMPLETED' | 'PARTIAL' | 'UNAVAILABLE';
  readonly reasonCode?: string;
  readonly candidates: readonly LookbackCandidateView[];
  readonly nextCursor: string | null;
  readonly done: boolean;
  readonly incomplete: boolean;
  readonly capsHit: readonly CapCode[];
  readonly unavailableRelationships: readonly UnavailableRelationshipCode[];
  readonly examined: number;
  readonly searchCalls: number;
  readonly retryAfterSeconds?: number;
}

export interface DecideInput {
  readonly caseId: string;
  readonly candidateId: string;
  readonly decision: 'YES' | 'NO' | 'UNSURE' | 'REOPEN';
  /** Server-resolved role; a payload claim can never supply it (I-4). */
  readonly role: Role;
  readonly actor: string;
  readonly viewerAccountId: string;
  readonly choice?: CandidateChoice;
}

export type DecideResult =
  | {
      readonly status: 'DECIDED';
      readonly candidateId: string;
      readonly state: CandidateState;
      readonly effect: 'PROPOSED_ENTRY' | 'VISIBLE' | 'HIDDEN' | 'REOPENED';
      readonly evidenceItemId?: string;
      readonly trailEntryId?: string;
    }
  | { readonly status: 'NOT_PERMITTED' | 'NOT_FOUND' | 'DEPENDENCY_FAILED' | 'INVALID' };

export type ShowResult =
  | { readonly status: 'FOUND'; readonly segments: readonly LookbackSegmentOption[] }
  | { readonly status: 'DENIED' | 'DELETED' | 'ISSUE_UNAVAILABLE' | 'NOT_FOUND' };

const runKey = (input: LookbackStepInput): string =>
  `${input.caseId}|${input.anchorEntryId}|${LOOKBACK_PROFILE_VERSION}`;

const candidateId = (
  caseId: string,
  issueId: string,
  segmentKey: string,
  anchorEntryId: string,
): string => `${caseId}|${anchorEntryId}|${issueId}|${segmentKey}`;

function relationshipCodes(record: CandidateRecord): LookbackReasonCode[] {
  const codes: LookbackReasonCode[] = [];
  if (record.relationships.linkedDepth === 1) codes.push('LINKED');
  if (record.relationships.linkedDepth === 2) codes.push('LINKED_2');
  if (record.relationships.sameReporter === true) codes.push('SAME_REPORTER');
  if (record.relationships.sameOrg === true) codes.push('SAME_ORG');
  if (record.relationships.sameProduct === true) codes.push('SAME_PRODUCT');
  return codes;
}

function toView(
  input: LookbackStepInput,
  record: CandidateRecord,
  reasonCodes: readonly LookbackReasonCode[],
  confidence: LookbackConfidence,
  overlap: number,
  segmentKey: string,
  sharedTokens: number,
): LookbackCandidateView {
  return {
    id: candidateId(input.caseId, record.issueId, segmentKey, input.anchorEntryId),
    caseId: input.caseId,
    issueId: record.issueId,
    issueKey: record.issueKey,
    candidateSegmentKey: segmentKey,
    recordTs: record.recordTs,
    tsStrength: record.tsStrength,
    reasonCodes,
    reasons: matchReasons(reasonCodes, sharedTokens),
    overlap,
    confidence,
    state: 'PROPOSED',
    anchorEntryId: input.anchorEntryId,
  };
}

function sorted(candidates: readonly LookbackCandidateView[]): readonly LookbackCandidateView[] {
  return [...candidates].sort((left, right) => {
    const byConfidence = CONFIDENCE_ORDER[left.confidence] - CONFIDENCE_ORDER[right.confidence];
    return byConfidence !== 0 ? byConfidence : left.recordTs.localeCompare(right.recordTs);
  });
}

export function createLookbackService(deps: LookbackDependencies) {
  return {
    async runStep(input: LookbackStepInput, viewerAccountId: string): Promise<LookbackStepResult> {
      if (!input.caseId || !input.anchorEntryId) throw new Error('LOOKBACK_INPUT_INVALID');
      const resolved = await deps.resolveAnchor({
        caseId: input.caseId,
        anchorEntryId: input.anchorEntryId,
        viewerAccountId,
      });
      if ('status' in resolved) {
        return {
          status: 'UNAVAILABLE',
          reasonCode: resolved.status,
          candidates: [],
          nextCursor: null,
          done: true,
          incomplete: true,
          capsHit: [],
          unavailableRelationships: [],
          examined: 0,
          searchCalls: 0,
        };
      }
      const anchorTime = Date.parse(resolved.recordTs);
      if (!Number.isFinite(anchorTime)) throw new Error('LOOKBACK_ANCHOR_INVALID');

      const key = runKey(input);
      const prior = await deps.state.getRun(key);
      if (prior?.status === 'DONE') {
        const stored = await deps.state.listCandidateViews(input.caseId);
        return {
          status: 'COMPLETED',
          candidates: sorted(
            stored.filter(
              (view) => view.anchorEntryId === input.anchorEntryId && view.state !== 'REJECTED',
            ),
          ),
          nextCursor: null,
          done: true,
          incomplete: prior.capsHit.length > 0,
          capsHit: prior.capsHit,
          unavailableRelationships: [],
          examined: prior.examined,
          searchCalls: prior.searchCalls,
        };
      }

      const caps = DEFAULT_LOOKBACK_CAPS;
      const capsHit = new Set<CapCode>(prior?.capsHit ?? []);
      if ((prior?.searchCalls ?? 0) >= caps.maxSearchCalls) {
        capsHit.add('MAX_SEARCH_CALLS');
        await deps.state.saveRun(key, {
          cursor: prior?.cursor ?? null,
          examined: prior?.examined ?? 0,
          searchCalls: prior?.searchCalls ?? 0,
          capsHit: [...capsHit].sort(),
          status: 'ACTIVE',
        });
        return {
          status: 'PARTIAL',
          candidates: [],
          nextCursor: prior?.cursor ?? null,
          done: false,
          incomplete: true,
          capsHit: [...capsHit].sort(),
          unavailableRelationships: [],
          examined: prior?.examined ?? 0,
          searchCalls: prior?.searchCalls ?? 0,
        };
      }

      const cursor = input.cursor ?? prior?.cursor ?? undefined;
      const searchResult = await deps.search.search({
        caseId: input.caseId,
        anchorEntryId: input.anchorEntryId,
        anchorIssueKey: resolved.issueKey,
        beforeISO: resolved.recordTs,
        watchedProjects: resolved.watchedProjects,
        tokens: resolved.tokens,
        relationships: resolved.relationships,
        maxIssues: caps.maxIssues,
        viewerAccountId,
        ...(cursor !== undefined ? { cursor } : {}),
      });
      if (searchResult.status === 'FAILED') throw new Error(searchResult.reasonCode);
      if (searchResult.status === 'RATE_LIMITED') capsHit.add('RATE_LIMITED');

      const unavailable = new Set<UnavailableRelationshipCode>([
        ...resolved.unavailableRelationships,
        ...(searchResult.unavailableRelationships ?? []),
      ]);
      const known = await deps.state.listCandidates(input.caseId);
      const blockedIssues = new Set(
        known.filter((row) => row.state !== 'REOPENED').map((row) => row.issueId),
      );
      const candidates: LookbackCandidateView[] = [];
      const perLabel: Record<LookbackConfidence, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
      let examined = prior?.examined ?? 0;

      for (const record of searchResult.records) {
        const recordTime = Date.parse(record.recordTs);
        const project = record.projectKey ?? record.issueKey.split('-')[0] ?? '';
        if (
          !Number.isFinite(recordTime) ||
          recordTime >= anchorTime ||
          !resolved.watchedProjects.includes(project)
        ) {
          continue;
        }
        if (examined >= caps.maxIssues) {
          capsHit.add('MAX_ISSUES_EXAMINED');
          break;
        }
        examined += 1;
        const links = record.relationships.linkedDepth ?? 0;
        if (links > caps.depth) {
          capsHit.add('MAX_DEPTH');
          continue;
        }
        if (blockedIssues.has(record.issueId)) continue;

        const baseReasons = relationshipCodes(record);
        let best: LookbackCandidateView | null = null;
        const segments =
          record.segments.length > 0 ? record.segments : [{ key: '_ISSUE', text: '' }];
        for (const segment of segments) {
          const segmentTokens = distinctiveTokens(segment.text);
          const ranked = rankCandidate({
            reasonCodes: [...baseReasons, 'TEXT_OVERLAP'],
            anchorTokens: resolved.tokens,
            candidateTokens: segmentTokens,
          });
          const shared = ranked.reasonCodes.includes('TEXT_OVERLAP')
            ? segmentTokens.filter((token) => resolved.tokens.includes(token)).length
            : 0;
          if (
            best === null ||
            CONFIDENCE_ORDER[ranked.confidence] < CONFIDENCE_ORDER[best.confidence] ||
            (ranked.confidence === best.confidence && ranked.overlap > best.overlap)
          ) {
            best = toView(
              input,
              record,
              ranked.reasonCodes,
              ranked.confidence,
              ranked.overlap,
              segment.key,
              shared,
            );
          }
        }
        if (best === null) continue;
        if (perLabel[best.confidence] >= caps.maxCandidatesPerLabel) {
          capsHit.add('MAX_CANDIDATES_SHOWN');
          continue;
        }
        perLabel[best.confidence] += 1;
        await deps.state.saveCandidate(best, record.issueId);
        candidates.push(best);
      }

      const done = searchResult.nextCursor === null;
      const run: StoredRun = {
        cursor: searchResult.nextCursor,
        examined,
        searchCalls: (prior?.searchCalls ?? 0) + 1,
        capsHit: [...capsHit].sort(),
        status: done ? 'DONE' : 'ACTIVE',
      };
      await deps.state.saveRun(key, run);
      return {
        status: searchResult.status === 'RATE_LIMITED' ? 'PARTIAL' : 'COMPLETED',
        candidates: sorted(candidates),
        nextCursor: run.cursor,
        done,
        incomplete: run.capsHit.length > 0 || !done || unavailable.size > 0,
        capsHit: run.capsHit,
        unavailableRelationships: [...unavailable].sort(),
        examined,
        searchCalls: run.searchCalls,
        ...(searchResult.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: searchResult.retryAfterSeconds }
          : {}),
      };
    },

    async list(caseId: string): Promise<readonly StoredCandidate[]> {
      return deps.state.listCandidates(caseId);
    },

    async show(caseId: string, candidateId: string, viewerAccountId: string): Promise<ShowResult> {
      const row = await deps.state.getCandidate(candidateId);
      if (!row || row.caseId !== caseId) return { status: 'NOT_FOUND' };
      if (deps.showCandidate === undefined) return { status: 'ISSUE_UNAVAILABLE' };
      return deps.showCandidate({ caseId, candidateId, viewerAccountId });
    },

    async decide(input: DecideInput): Promise<DecideResult> {
      if (input.role !== 'QUALIFIED_PERSON') return { status: 'NOT_PERMITTED' };
      const row = await deps.state.getCandidate(input.candidateId);
      if (!row || row.caseId !== input.caseId) return { status: 'NOT_FOUND' };
      if (
        input.decision === 'YES' &&
        (deps.acceptCandidate === undefined ||
          input.choice === undefined ||
          !input.choice.segmentKey ||
          !(input.choice.wholeSegment === true || (input.choice.quote?.trim().length ?? 0) > 0))
      ) {
        return { status: 'INVALID' };
      }
      const stateByDecision = {
        YES: 'ACCEPTED',
        NO: 'REJECTED',
        UNSURE: 'UNSURE',
        REOPEN: 'REOPENED',
      } as const satisfies Record<DecideInput['decision'], CandidateState>;
      const effectByDecision = {
        YES: 'PROPOSED_ENTRY',
        NO: 'HIDDEN',
        UNSURE: 'VISIBLE',
        REOPEN: 'REOPENED',
      } as const satisfies Record<
        DecideInput['decision'],
        Extract<DecideResult, { status: 'DECIDED' }>['effect']
      >;
      const nextState = stateByDecision[input.decision];
      const effect = effectByDecision[input.decision];
      let accepted: LookbackAcceptResult | undefined;
      if (input.decision === 'YES') {
        accepted = await deps.acceptCandidate!({
          caseId: input.caseId,
          candidateId: input.candidateId,
          actor: input.actor,
          choice: input.choice!,
        });
      }
      await deps.state.updateCandidateState(input.candidateId, nextState, input.actor);
      await deps.recordAudit?.({
        actionCode: `LOOKBACK_${input.decision}`,
        errorCode: 'OK',
      });
      return {
        status: 'DECIDED',
        candidateId: input.candidateId,
        state: nextState,
        effect,
        ...(accepted !== undefined
          ? { evidenceItemId: accepted.evidenceItemId, trailEntryId: accepted.trailEntryId }
          : {}),
      };
    },
  };
}

export type LookbackService = ReturnType<typeof createLookbackService>;
