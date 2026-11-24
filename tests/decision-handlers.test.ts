import { describe, expect, it, vi } from 'vitest';
import { createDecisionHandlers, type DecisionDependencies } from '../src/handlers/decision';
import type { GateContext, GateDecision } from '../src/contracts/authorisation';

const context: GateContext = { accountId: 'qp-1', canBrowseResource: true };
const qp: Extract<GateDecision, { allow: true }> = { allow: true, role: 'QUALIFIED_PERSON' };

function deps(overrides: Partial<DecisionDependencies> = {}): DecisionDependencies {
  return { now: () => '2026-11-24T12:00:00.000Z', ...overrides };
}

describe('P9 gated deadline and decision handlers (Arch §13.3, C-05/C-06, I-4/I-6)', () => {
  it('COMPUTE_DEADLINES accepts only candidate metadata and injects server time', async () => {
    const compute = vi
      .fn()
      .mockResolvedValue({ status: 'COMPUTED', results: [], missing: [], preview: false });
    const handlers = createDecisionHandlers(deps({ computeDeadlines: compute }));
    const candidates = [
      {
        entryId: 'entry-1',
        basis: 'JIRA_RECORD_TIMESTAMP',
        effectiveDate: '2026-11-01',
        reasonCode: null,
      },
    ];
    const result = await handlers.COMPUTE_DEADLINES?.(context, qp, {
      caseId: 'case-1',
      asOfDate: '2026-11-24',
      candidates,
    });
    expect(compute).toHaveBeenCalledWith(
      { caseId: 'case-1', asOfDate: '2026-11-24', nowISO: '2026-11-24T12:00:00.000Z' },
      candidates,
    );
    expect(result).toMatchObject({ code: 'OK', roleHint: 'QUALIFIED_PERSON' });
  });

  it('COMPUTE_DEADLINES refuses record text, role claims and unknown bases', async () => {
    const compute = vi.fn();
    const handlers = createDecisionHandlers(deps({ computeDeadlines: compute }));
    for (const payload of [
      {
        caseId: 'case-1',
        asOfDate: '2026-11-24',
        candidates: [{ entryId: 'e', basis: 'UNKNOWN' }],
      },
      {
        caseId: 'case-1',
        asOfDate: '2026-11-24',
        candidates: [{ entryId: 'e', basis: 'JIRA_RECORD_TIMESTAMP', quote: 'record text' }],
      },
      { caseId: 'case-1', asOfDate: '2026-11-24', role: 'QUALIFIED_PERSON', candidates: [] },
    ]) {
      const result = await handlers.COMPUTE_DEADLINES?.(context, qp, payload);
      expect(result).toMatchObject({ code: 'INVALID_REQUEST', data: null });
    }
    expect(compute).not.toHaveBeenCalled();
  });

  it('DECIDE uses the gate role, never a payload role claim, and hides rationale', async () => {
    const startDraft = vi.fn().mockResolvedValue({
      id: 'draft-1',
      case_id: 'case-1',
      version: 1,
      state: 'DRAFT',
      rationale: 'must not be returned',
    });
    const handlers = createDecisionHandlers(deps({ startDraft }));
    const spoofed = await handlers.DECIDE?.(context, qp, {
      action: 'START_DRAFT',
      caseId: 'case-1',
      role: 'QUALIFIED_PERSON',
    });
    expect(spoofed).toMatchObject({ code: 'INVALID_REQUEST', data: null });
    const result = await handlers.DECIDE?.(context, qp, {
      action: 'START_DRAFT',
      caseId: 'case-1',
    });
    expect(startDraft).toHaveBeenCalledWith({
      id: undefined,
      caseId: 'case-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'qp-1',
      at: '2026-11-24T12:00:00.000Z',
      awarenessEntryId: undefined,
      awarenessDate: undefined,
      awarenessBasis: undefined,
      productKey: undefined,
    });
    expect(result).toMatchObject({
      code: 'OK',
      roleHint: 'QUALIFIED_PERSON',
      data: { id: 'draft-1', caseId: 'case-1', version: 1, state: 'DRAFT' },
    });
    expect(JSON.stringify(result)).not.toContain('must not be returned');
  });

  it('denies DECIDE when the gate resolved a non-QP role', async () => {
    const finalise = vi.fn();
    const handlers = createDecisionHandlers(deps({ finalise }));
    const result = await handlers.DECIDE?.(
      context,
      { allow: true, role: 'REVIEWER' },
      {
        action: 'FINALISE',
        draftId: 'draft-1',
        caseId: 'case-1',
        answers: {},
        rationale: 'x',
        productKey: 'SYNTHETIC_PRODUCT',
        questionSetId: 'qs-1',
        questionSetVersion: '1',
      },
    );
    expect(result).toMatchObject({ code: 'NOT_PERMITTED', data: null });
    expect(finalise).not.toHaveBeenCalled();
  });

  it('GET_QUESTIONS returns rule-data prompts with no default or selected answer', async () => {
    const getQuestionSet = vi.fn().mockReturnValue({
      id: 'qs-synthetic-v1',
      version: '1',
      status: 'REVIEWED',
      questions: [{ id: 'Q1', prompt: 'Synthetic question one?', answerCodes: ['YES', 'NO'] }],
    });
    const handlers = createDecisionHandlers(deps({ getQuestionSet }));
    const result = await handlers.DECIDE?.(context, qp, { action: 'GET_QUESTIONS' });
    expect(result).toMatchObject({
      code: 'OK',
      data: {
        status: 'LOADED',
        questionSet: {
          id: 'qs-synthetic-v1',
          productKey: null,
          questions: [{ id: 'Q1', answerCodes: ['YES', 'NO'] }],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('default');
    expect(JSON.stringify(result)).not.toContain('selected');
  });

  it('GET_QUESTIONS gives the fixed missing-rule-data state', async () => {
    const handlers = createDecisionHandlers(deps({ getQuestionSet: () => null }));
    const result = await handlers.DECIDE?.(context, qp, { action: 'GET_QUESTIONS' });
    expect(result).toMatchObject({
      code: 'OK',
      data: {
        status: 'MISSING',
        message: 'Decision questions are not available (rule data missing)',
      },
    });
  });

  it('omits handlers when no live ports exist', () => {
    const handlers = createDecisionHandlers(deps());
    expect(handlers.COMPUTE_DEADLINES).toBeUndefined();
    expect(handlers.DECIDE).toBeUndefined();
  });
});
