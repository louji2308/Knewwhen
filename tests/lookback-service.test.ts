import { describe, expect, it, vi } from 'vitest';
import type {
  LookbackAnchor,
  LookbackCandidateView,
  CandidateRecord,
} from '../src/contracts/lookback';
import {
  createLookbackService,
  type LookbackSearchPort,
  type LookbackStatePort,
  type StoredRun,
} from '../src/services/lookback';
import { distinctiveTokens } from '../src/core/lookback-matcher';

const ANCHOR_TS = '2026-11-24T15:00:00.000Z';
const OLD_TS = '2026-11-05T09:12:00.000Z';
const VIEWER = 'qp-1';

const anchor: LookbackAnchor = {
  entryId: 'entry-1',
  issueKey: 'KW-9',
  recordTs: ANCHOR_TS,
  tokens: distinctiveTokens('Dose calculation froze and the patient went to the ER.'),
  watchedProjects: ['KW'],
  relationships: { reporterId: 'reporter-1' },
  unavailableRelationships: ['PRODUCT_NOT_MAPPED'],
};

function candidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    issueId: 'issue-1',
    issueKey: 'KW-1',
    projectKey: 'KW',
    recordTs: OLD_TS,
    tsStrength: 'JIRA_RECORD_TIMESTAMP',
    relationships: { linkedDepth: 1, sameReporter: true },
    segments: [
      { key: 's0', text: 'The dose calculation froze again and the patient went to the ER.' },
    ],
    ...overrides,
  };
}

function state(seed?: { run?: StoredRun; views?: readonly LookbackCandidateView[] }): {
  port: LookbackStatePort;
  views: Map<string, LookbackCandidateView>;
} {
  const runs = new Map<string, StoredRun>();
  const candidates = new Map<
    string,
    { id: string; state: string; caseId: string; issueId: string }
  >();
  const views = new Map<string, LookbackCandidateView>();
  if (seed?.run) runs.set('case-1|entry-1|lookback-profile-v1', seed.run);
  for (const view of seed?.views ?? []) {
    views.set(view.id, view);
    candidates.set(view.id, {
      id: view.id,
      state: view.state,
      caseId: view.caseId,
      issueId: view.issueId,
    });
  }
  return {
    views,
    port: {
      async getRun(key) {
        return runs.get(key) ?? null;
      },
      async saveRun(key, value) {
        runs.set(key, value);
      },
      async getCandidate(id) {
        const row = candidates.get(id);
        return row === undefined ? null : { ...row, state: row.state as never };
      },
      async saveCandidate(view, issueId) {
        views.set(view.id, view);
        candidates.set(view.id, {
          id: view.id,
          state: view.state,
          caseId: view.caseId,
          issueId,
        });
        return view.id;
      },
      async updateCandidateState(id, nextState) {
        const row = candidates.get(id);
        if (!row) return;
        candidates.set(id, { ...row, state: nextState });
        const view = views.get(id);
        if (view) views.set(id, { ...view, state: nextState });
      },
      async listCandidates(caseId) {
        return [...candidates.values()]
          .filter((row) => row.caseId === caseId)
          .map((row) => ({ ...row, state: row.state as never }));
      },
      async listCandidateViews(caseId) {
        return [...views.values()].filter((view) => view.caseId === caseId);
      },
    },
  };
}

function service(
  search: LookbackSearchPort,
  store = state(),
  overrides: Partial<Parameters<typeof createLookbackService>[0]> = {},
) {
  return createLookbackService({
    search,
    state: store.port,
    resolveAnchor: async () => anchor,
    ...overrides,
  });
}

const stepInput = { caseId: 'case-1', anchorEntryId: 'entry-1' };

describe('P8.A2/A3 lookback service (C-03.1-11, 13, Arch §8.8)', () => {
  it('keeps strictly earlier watched-project records, sorts them and stores no text', async () => {
    const search: LookbackSearchPort = {
      async search() {
        return {
          status: 'OK',
          examined: 4,
          nextCursor: null,
          records: [
            candidate({
              issueId: 'issue-low',
              issueKey: 'KW-3',
              relationships: { sameReporter: true },
              segments: [{ key: 's0', text: 'Invoices are late.' }],
            }),
            candidate({ issueId: 'issue-2', issueKey: 'KW-2', recordTs: ANCHOR_TS }),
            candidate({ issueId: 'issue-3', issueKey: 'OTHER-3', projectKey: 'OTHER' }),
            candidate({ issueId: 'issue-1' }),
          ],
        };
      },
    };
    const store = state();
    const result = await service(search, store).runStep(stepInput, VIEWER);
    expect(result.status).toBe('COMPLETED');
    expect(result.candidates.map((row) => row.issueKey)).toEqual(['KW-1', 'KW-3']);
    expect(result.candidates[0]).toMatchObject({ confidence: 'HIGH', state: 'PROPOSED' });
    expect(result.unavailableRelationships).toEqual(['PRODUCT_NOT_MAPPED']);
    expect(JSON.stringify([...store.views.values()])).not.toContain('froze');
  });

  it('returns partial results with a retry time and keeps the cursor on 429', async () => {
    const search: LookbackSearchPort = {
      async search() {
        return {
          status: 'RATE_LIMITED',
          retryAfterSeconds: 12,
          examined: 1,
          nextCursor: 'cursor-2',
          records: [candidate()],
        };
      },
    };
    const result = await service(search).runStep(stepInput, VIEWER);
    expect(result.status).toBe('PARTIAL');
    expect(result.retryAfterSeconds).toBe(12);
    expect(result.nextCursor).toBe('cursor-2');
    expect(result.capsHit).toContain('RATE_LIMITED');
  });

  it('reports incomplete coverage when a cap is hit and skips one bad record', async () => {
    const search: LookbackSearchPort = {
      async search(request) {
        expect(request.beforeISO).toBe(ANCHOR_TS);
        expect(request.viewerAccountId).toBe(VIEWER);
        return {
          status: 'OK',
          examined: 3,
          nextCursor: null,
          records: [
            candidate({ issueId: 'bad', recordTs: 'not-a-date' }),
            candidate({ issueId: 'issue-1' }),
            candidate({
              issueId: 'issue-2',
              issueKey: 'KW-2',
              recordTs: '2026-11-06T09:12:00.000Z',
            }),
          ],
        };
      },
    };
    const result = await service(search).runStep({ ...stepInput, cursor: 'start' }, VIEWER);
    expect(result.candidates).toHaveLength(2);
    expect(result.incomplete).toBe(true);
    expect(result.examined).toBeGreaterThanOrEqual(2);
  });

  it('does not resurface a rejected candidate', async () => {
    const store = state();
    const first = await service(
      {
        async search() {
          return {
            status: 'OK',
            examined: 1,
            nextCursor: null,
            records: [candidate()],
          };
        },
      },
      store,
    ).runStep(stepInput, VIEWER);
    const svc = service(
      {
        async search() {
          throw new Error('SEARCH_SHOULD_NOT_RUN');
        },
      },
      store,
    );
    await svc.decide({
      ...stepInput,
      caseId: 'case-1',
      candidateId: first.candidates[0]!.id,
      decision: 'NO',
      role: 'QUALIFIED_PERSON',
      actor: VIEWER,
      viewerAccountId: VIEWER,
    });
    const second = await svc.runStep(stepInput, VIEWER);
    expect(second.candidates).toHaveLength(0);
  });

  it('requires a Qualified person and a live segment choice for yes, with no date set', async () => {
    const accept = vi.fn().mockResolvedValue({ evidenceItemId: 'ev-1', trailEntryId: 'tr-1' });
    const search: LookbackSearchPort = {
      async search() {
        return {
          status: 'OK',
          examined: 1,
          nextCursor: null,
          records: [candidate()],
        };
      },
    };
    const svc = service(search, state(), { acceptCandidate: accept });
    const stepped = await svc.runStep(stepInput, VIEWER);
    const id = stepped.candidates[0]!.id;
    const denied = await svc.decide({
      ...stepInput,
      caseId: 'case-1',
      candidateId: id,
      decision: 'YES',
      role: 'REVIEWER',
      actor: VIEWER,
      viewerAccountId: VIEWER,
    });
    expect(denied.status).toBe('NOT_PERMITTED');
    expect(accept).not.toHaveBeenCalled();

    const missingChoice = await svc.decide({
      ...stepInput,
      caseId: 'case-1',
      candidateId: id,
      decision: 'YES',
      role: 'QUALIFIED_PERSON',
      actor: VIEWER,
      viewerAccountId: VIEWER,
    });
    expect(missingChoice.status).toBe('INVALID');

    const yes = await svc.decide({
      ...stepInput,
      caseId: 'case-1',
      candidateId: id,
      decision: 'YES',
      role: 'QUALIFIED_PERSON',
      actor: VIEWER,
      viewerAccountId: VIEWER,
      choice: { segmentKey: 's0', wholeSegment: true },
    });
    expect(yes).toMatchObject({
      status: 'DECIDED',
      state: 'ACCEPTED',
      effect: 'PROPOSED_ENTRY',
      evidenceItemId: 'ev-1',
      trailEntryId: 'tr-1',
    });
    expect(accept).toHaveBeenCalledWith({
      caseId: 'case-1',
      candidateId: id,
      actor: VIEWER,
      choice: { segmentKey: 's0', wholeSegment: true },
    });
    expect(JSON.stringify(yes)).not.toContain('awarenessDate');
  });

  it('shows live segment metadata only and never returns record text', async () => {
    const search: LookbackSearchPort = {
      async search() {
        return {
          status: 'OK',
          examined: 1,
          nextCursor: null,
          records: [candidate()],
        };
      },
    };
    const showCandidate = vi.fn().mockResolvedValue({
      status: 'FOUND',
      segments: [
        {
          key: 's0',
          authorAccountId: 'author-1',
          recordCreatedAt: OLD_TS,
          recordUpdatedAt: OLD_TS,
          strength: 'SYSTEM_UNEDITED',
          wholeSegmentAllowed: true,
        },
      ],
    });
    const svc = service(search, state(), { showCandidate });
    const stepped = await svc.runStep(stepInput, VIEWER);
    const shown = await svc.show('case-1', stepped.candidates[0]!.id, VIEWER);
    expect(shown).toMatchObject({ status: 'FOUND' });
    expect(JSON.stringify(shown)).not.toContain('froze');
    expect(showCandidate).toHaveBeenCalledWith({
      caseId: 'case-1',
      candidateId: stepped.candidates[0]!.id,
      viewerAccountId: VIEWER,
    });
  });

  it('reopens a finished run from stored pointers and lets a QP reopen a rejection', async () => {
    const first = await service({
      async search() {
        return {
          status: 'OK',
          examined: 1,
          nextCursor: null,
          records: [candidate()],
        };
      },
    }).runStep(stepInput, VIEWER);
    const store = state({
      run: {
        cursor: null,
        examined: 1,
        searchCalls: 1,
        capsHit: [],
        status: 'DONE',
      },
      views: first.candidates,
    });
    const svc = service(
      {
        async search() {
          throw new Error('SEARCH_SHOULD_NOT_RUN');
        },
      },
      store,
    );
    const resumed = await svc.runStep(stepInput, VIEWER);
    expect(resumed.candidates).toHaveLength(1);
    const reopened = await svc.decide({
      ...stepInput,
      caseId: 'case-1',
      candidateId: first.candidates[0]!.id,
      decision: 'REOPEN',
      role: 'QUALIFIED_PERSON',
      actor: VIEWER,
      viewerAccountId: VIEWER,
    });
    expect(reopened).toMatchObject({ status: 'DECIDED', state: 'REOPENED' });
  });
});
