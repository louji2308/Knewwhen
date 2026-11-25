/** P10.B1 — case header tests (C-09.1–6, WF-9, WF-10, G-1, I-5/I-6). */
import { describe, expect, it } from 'vitest';
import type { ResolverEnvelope } from '../src/contracts/envelope';
import { scanWording } from '../src/core/wording';
import {
  CASE_HEADER_UI_STRINGS,
  caseHeaderViewModel,
  nextStep,
  type CaseHeaderFlags,
  type CaseHeaderInput,
} from '../src/frontend/case-header-view';

type Code = ResolverEnvelope<unknown>['code'];

const envelope = (data: unknown, code: Code = 'OK'): ResolverEnvelope<unknown> => ({
  data,
  code,
  roleHint: 'REVIEWER',
  correlationId: 'corr-header-1',
});

const baseCase = {
  caseId: 'case-1',
  state: 'FLAGGED',
  aiScreeningEnabled: false,
  ruleSetId: 'FDA',
  ruleSetVersion: '1.0.0',
  ruleSetStatus: 'REVIEWED',
  newInfoSinceFinal: false,
  decisionVersion: 1,
  evidenceChangedCount: 0,
  quote: 'secret record text',
  rationale: 'private authored text',
};

const input = (overrides: Partial<CaseHeaderInput> = {}): CaseHeaderInput => ({
  roleHint: 'REVIEWER',
  caseView: envelope(baseCase),
  scan: null,
  lookback: null,
  decision: null,
  writeback: null,
  ...overrides,
});

const flags = (overrides: Partial<CaseHeaderFlags> = {}): CaseHeaderFlags => ({
  casePresent: true,
  waitingForScan: false,
  caseState: 'FLAGGED',
  lookbackRun: false,
  awaitingCandidateCount: 0,
  proposedEntryCount: 0,
  confirmedEntryCount: 0,
  currentCalculation: false,
  decisionState: 'NONE',
  writebackState: '',
  newInfoSinceFinal: false,
  decisionVersion: 1,
  evidenceChangedCount: 0,
  aiUnavailable: false,
  searchIncomplete: false,
  aiScreeningEnabled: false,
  ruleSetId: 'FDA',
  ruleSetVersion: '1.0.0',
  ruleSetStatus: 'REVIEWED',
  ...overrides,
});

function strings(value: unknown, into: string[] = []): readonly string[] {
  if (typeof value === 'string') {
    into.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) strings(item, into);
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) strings(item, into);
  }
  return into;
}

describe('P10.B1 case header role views (C-09.1, §7.2, I-6)', () => {
  it('gives a Reviewer case actions but never quotes or authored rationale', () => {
    const model = caseHeaderViewModel(input());
    expect(model.roleView).toBe('CASE_ACTIONS');
    expect(model.canShowCaseHeader).toBe(true);
    expect(model.actions).toEqual([
      'MANUAL_SCAN',
      'OPEN_CASE',
      'RUN_LOOKBACK',
      'ENTER_RECEIPT_DATE',
      'COMPUTE_DEADLINES',
      'RETRY_WRITEBACK',
    ]);
    expect(model.caseId).toBe('case-1');
    const json = JSON.stringify(model);
    expect(json).not.toContain('secret record text');
    expect(json).not.toContain('private authored text');
  });

  it('gives a qualified person the decision actions as well', () => {
    const model = caseHeaderViewModel(input({ roleHint: 'QUALIFIED_PERSON' }));
    expect(model.roleView).toBe('DECISIONS');
    expect(model.actions).toEqual([
      'MANUAL_SCAN',
      'OPEN_CASE',
      'RUN_LOOKBACK',
      'ENTER_RECEIPT_DATE',
      'COMPUTE_DEADLINES',
      'RETRY_WRITEBACK',
      'CONFIRM_SAME_EVENT',
      'CONFIRM_TRAIL_ENTRY',
      'DECIDE',
    ]);
  });

  it('shows only nudge and route to a Viewer and nothing case-related to a site admin', () => {
    const viewer = caseHeaderViewModel(input({ roleHint: 'VIEWER' }));
    expect(viewer.roleView).toBe('NUDGE_ROUTE');
    expect(viewer.canShowCaseHeader).toBe(false);
    expect(viewer.actions).toEqual([]);
    expect(viewer.nextStep).toBeNull();
    expect(viewer.chips).toEqual([]);
    expect(viewer.banners).toEqual([]);
    expect(viewer.caseId).toBe('');
    expect(JSON.stringify(viewer)).not.toContain('secret record text');

    const admin = caseHeaderViewModel(input({ roleHint: 'SITE_ADMIN' }));
    expect(admin.roleView).toBe('RESTRICTED');
    expect(admin.canShowCaseHeader).toBe(false);
    expect(admin.actions).toEqual([]);
    expect(admin.message).toBe(CASE_HEADER_UI_STRINGS.restricted);
    expect(admin.nextStep).toBeNull();
  });
});

describe('P10.B1 next-step table (C-09.4, WF-9, WF-10)', () => {
  it('follows the fixed first-match order, never a colour', () => {
    expect(nextStep(flags({ casePresent: false, waitingForScan: true }))).toMatchObject({
      code: 'WAIT_FOR_SCAN',
      tab: 'THIS_ISSUE',
    });
    expect(nextStep(flags())).toMatchObject({
      code: 'SEARCH_EARLIER_RECORDS',
      tab: 'EARLIER_RECORDS',
    });
    expect(nextStep(flags({ lookbackRun: true, awaitingCandidateCount: 2 }))).toMatchObject({
      code: 'ANSWER_SAME_EVENT',
      text: "A qualified person answers 'Same event?' for 2 records",
    });
    expect(nextStep(flags({ lookbackRun: true, proposedEntryCount: 3 }))).toMatchObject({
      code: 'CONFIRM_TRAIL',
      text: 'A qualified person confirms or rejects 3 trail entries',
    });
    expect(nextStep(flags({ lookbackRun: true, confirmedEntryCount: 1 }))).toMatchObject({
      code: 'CALCULATE_DEADLINES',
      tab: 'AWARENESS_DEADLINES',
    });
    expect(
      nextStep(flags({ lookbackRun: true, confirmedEntryCount: 1, currentCalculation: true })),
    ).toMatchObject({
      code: 'RECORD_DECISION',
      tab: 'DECISION',
    });
    expect(
      nextStep(flags({ lookbackRun: true, caseState: 'IN_REVIEW', decisionState: 'DRAFT' })),
    ).toMatchObject({
      code: 'FINISH_DRAFT',
      tab: 'DECISION',
    });
    expect(
      nextStep(
        flags({
          caseState: 'DECIDED',
          decisionState: 'FINAL',
          writebackState: 'FAILED',
          newInfoSinceFinal: true,
        }),
      ),
    ).toMatchObject({ code: 'CHECK_WRITEBACK', tab: 'DECISION' });
    expect(
      nextStep(
        flags({
          caseState: 'DECIDED',
          decisionState: 'FINAL',
          writebackState: 'DONE',
          newInfoSinceFinal: true,
        }),
      ),
    ).toMatchObject({ code: 'REVIEW_NEW_INFO', tab: 'AWARENESS_DEADLINES' });
    expect(
      nextStep(
        flags({
          caseState: 'DECIDED',
          decisionState: 'FINAL',
          writebackState: 'DONE',
          newInfoSinceFinal: false,
        }),
      ),
    ).toBeNull();
  });

  it('selects the earlier rule when several conditions are true', () => {
    const step = nextStep(
      flags({
        caseState: 'FLAGGED',
        awaitingCandidateCount: 4,
        proposedEntryCount: 5,
        currentCalculation: true,
        decisionState: 'DRAFT',
      }),
    );
    expect(step?.code).toBe('SEARCH_EARLIER_RECORDS');
  });
});

describe('P10.B1 chips and banners (C-09.2, C-09.3, G-8)', () => {
  it('shows fixed AI and rule-set chips with ids and statuses only', () => {
    const model = caseHeaderViewModel(
      input({
        caseView: envelope({
          ...baseCase,
          aiScreeningEnabled: true,
          ruleSetStatus: 'PREVIEW',
          quote: 'secret record text',
        }),
      }),
    );
    expect(model.chips).toEqual([
      { code: 'AI_SCREENING_ON', text: 'AI screening: on' },
      { code: 'RULE_SET_PREVIEW', text: 'Rule set FDA v1.0.0 · Preview' },
    ]);
    expect(JSON.stringify(model)).not.toContain('secret record text');
  });

  it('drops malformed rule-set ids instead of rendering them', () => {
    const model = caseHeaderViewModel(
      input({
        caseView: envelope({
          ...baseCase,
          ruleSetId: 'invalid id with spaces',
          ruleSetStatus: 'UNKNOWN_STATUS',
        }),
      }),
    );
    expect(JSON.stringify(model)).not.toContain('invalid id with spaces');
    expect(model.chips[1]?.code).toBe('RULE_SET_NOT_REVIEWED');
  });

  it('does not claim new information since a final decision when no final decision exists', () => {
    const model = caseHeaderViewModel(
      input({
        caseView: envelope({
          ...baseCase,
          state: 'DECIDED',
          newInfoSinceFinal: true,
          decisionVersion: 3,
        }),
      }),
    );
    expect(model.banners.map((banner) => banner.code)).not.toContain('NEW_INFO_SINCE_FINAL');
  });

  it('shows the four banners only when their fixed conditions hold', () => {
    const model = caseHeaderViewModel(
      input({
        caseView: envelope({
          ...baseCase,
          state: 'DECIDED',
          newInfoSinceFinal: true,
          decisionVersion: 3,
          evidenceChangedCount: 2,
        }),
        scan: envelope({ status: 'FAILED', result: 'SKIPPED', reasonCode: 'LLM_UNAVAILABLE' }),
        lookback: envelope({ kind: 'LOOKBACK_STEP', incomplete: true, candidates: [] }),
        decision: envelope({
          id: 'decision-1',
          caseId: 'case-1',
          version: 3,
          state: 'FINAL',
          awarenessDate: '2026-11-01',
          awarenessBasis: 'JIRA_RECORD_TIMESTAMP',
        }),
      }),
    );
    expect(model.banners).toEqual([
      { code: 'NEW_INFO_SINCE_FINAL', text: 'New information since final decision v3' },
      { code: 'EVIDENCE_CHANGED', text: 'Evidence changed in 2 cited records' },
      {
        code: 'AI_SCREENING_UNAVAILABLE',
        text: 'AI screening unavailable, rule-based screening used',
      },
      { code: 'SEARCH_INCOMPLETE', text: 'Search incomplete. Other records may exist.' },
    ]);
  });
});

describe('P10.B1 case header wording (C-09.3, G-1, I-5)', () => {
  it('states decision support and never names an outcome', () => {
    const model = caseHeaderViewModel(input());
    expect(CASE_HEADER_UI_STRINGS.notice).toBe(
      'Decision support, not a regulatory determination or legal advice.',
    );
    const json = JSON.stringify(model).toLowerCase();
    expect(json).not.toContain('reportable');
    expect(json).not.toContain('not reportable');
  });

  it('has no banned wording in exported strings or rendered text', () => {
    const model = caseHeaderViewModel(input());
    expect(scanWording(strings(CASE_HEADER_UI_STRINGS))).toEqual({ status: 'CLEAN' });
    expect(scanWording(strings(model))).toEqual({ status: 'CLEAN' });
  });
});
