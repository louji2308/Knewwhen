import { describe, expect, it } from 'vitest';
import type { ResolverEnvelope } from '../src/contracts/envelope';
import { assertNoBannedWording } from '../src/core/wording';
import {
  AWARENESS_UI_STRINGS,
  awarenessViewModel,
  receiptDateProblem,
  tableRows,
} from '../src/frontend/awareness-view';

const caseEnvelope: ResolverEnvelope<unknown> = {
  code: 'OK',
  correlationId: 'corr-1',
  roleHint: 'QUALIFIED_PERSON',
  data: {
    kind: 'CASE_VIEW',
    caseId: 'case-1',
    state: 'IN_REVIEW',
    origin: 'SIGNAL',
    createdAt: '2026-11-24T12:00:00.000Z',
    entries: [
      {
        entryId: 'entry-1',
        kind: 'RECORD',
        status: 'CONFIRMED',
        source: 'SIGNAL',
        evidenceId: 'evidence-1',
        validationStatus: 'VALID',
        strength: 'SYSTEM_UNEDITED',
        receivedDateEntered: null,
        enteredAt: '2026-11-24T12:12:00.000Z',
        decidedAt: '2026-11-24T15:00:00.000Z',
        supersedesId: null,
      },
    ],
    candidates: [
      {
        entryId: 'entry-1',
        basis: 'JIRA_RECORD_TIMESTAMP',
        effectiveDate: '2026-11-05',
        reasonCode: null,
        observationAt: '2026-11-24T12:12:00.000Z',
        strength: 'SYSTEM_UNEDITED',
      },
      {
        entryId: 'entry-2',
        basis: 'ENTERED_RECEIPT_DATE',
        effectiveDate: null,
        reasonCode: 'RECEIPT_DATE_MISSING',
        observationAt: '2026-11-24T13:00:00.000Z',
        strength: null,
      },
    ],
    preselectedEntryId: null,
    preselectedBasis: null,
  },
};

describe('P5.D2 FE awareness view model (C-04.1-3, C-09.2-3, G-1)', () => {
  it('maps a case envelope to labelled rows and candidates without a preselection', () => {
    const model = awarenessViewModel(caseEnvelope);
    expect(model.kind).toBe('CASE_VIEW');
    if (model.kind !== 'CASE_VIEW') return;
    expect(model.caseId).toBe('case-1');
    expect(model.preselected).toBeNull();
    expect(model.entries).toHaveLength(1);
    expect(model.entries[0]).toMatchObject({
      entryId: 'entry-1',
      status: 'Confirmed',
      strength: 'System text, unedited',
    });
    expect(model.candidates.map((candidate) => candidate.label)).toEqual([
      'Jira record time: 2026-11-05',
      'Entered receipt date: not recorded',
    ]);
    expect(JSON.stringify(model)).not.toContain('overheated');
  });

  it('builds DynamicTable rows from ids and codes only', () => {
    const model = awarenessViewModel(caseEnvelope);
    const rows = tableRows(model);
    expect(rows.trail).toHaveLength(1);
    expect(rows.trail[0]?.key).toBe('entry-1');
    expect(rows.candidates.map((row) => row.key)).toEqual([
      'entry-1:JIRA_RECORD_TIMESTAMP',
      'entry-2:ENTERED_RECEIPT_DATE',
    ]);
    expect(JSON.stringify(rows)).not.toContain('overheated');
  });

  it.each([
    ['NOT_PERMITTED', AWARENESS_UI_STRINGS.denied],
    ['DEPENDENCY_FAILED', AWARENESS_UI_STRINGS.dependency],
    ['INVALID_REQUEST', AWARENESS_UI_STRINGS.invalid],
    ['NOT_FOUND', AWARENESS_UI_STRINGS.empty],
  ])('maps %s to an honest error state', (code, message) => {
    const model = awarenessViewModel({
      ...caseEnvelope,
      code: code as ResolverEnvelope<unknown>['code'],
      data: null,
    });
    expect(model).toMatchObject({ kind: 'ERROR', code, message });
  });

  it('maps a revalidation envelope to a state code, never to record text', () => {
    const model = awarenessViewModel({
      ...caseEnvelope,
      data: {
        kind: 'REVALIDATION_VIEW',
        evidenceId: 'evidence-1',
        caseId: 'case-1',
        state: 'MODIFIED',
        bodyEdited: true,
        updated: true,
      },
    });
    expect(model).toMatchObject({
      kind: 'REVALIDATION',
      state: 'Modified since capture',
      bodyEdited: true,
    });
    expect(JSON.stringify(model)).not.toContain('overheated');
  });

  it('validates a human-entered receipt date before calling the resolver', () => {
    expect(receiptDateProblem('2026-11-01', '2026-11-24')).toBeNull();
    expect(receiptDateProblem('', '2026-11-24')).toBe('EMPTY');
    expect(receiptDateProblem('01/11/2026', '2026-11-24')).toBe('FORMAT');
    expect(receiptDateProblem('2026-12-01', '2026-11-24')).toBe('FUTURE');
  });

  it('keeps every authored UI string free of banned wording', () => {
    const authored: string[] = [];
    for (const value of Object.values(AWARENESS_UI_STRINGS)) {
      if (typeof value === 'string') authored.push(value);
    }
    assertNoBannedWording([
      ...authored,
      ...Object.values(AWARENESS_UI_STRINGS.basisLabels),
      ...Object.values(AWARENESS_UI_STRINGS.statusLabels),
      ...Object.values(AWARENESS_UI_STRINGS.reasonLabels),
      ...Object.values(AWARENESS_UI_STRINGS.strengthLabels),
      ...Object.values(AWARENESS_UI_STRINGS.stateLabels),
      ...Object.values(AWARENESS_UI_STRINGS.headers),
    ]);
  });
});
