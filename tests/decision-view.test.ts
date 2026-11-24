import { describe, expect, it } from 'vitest';
import type { ResolverEnvelope } from '../src/contracts/envelope';
import { decisionViewModel, DECISION_UI_STRINGS } from '../src/frontend/decision-view';
import { scanWording } from '../src/core/wording';

function envelope(
  data: unknown,
  code: ResolverEnvelope<unknown>['code'] = 'OK',
): ResolverEnvelope<unknown> {
  return { data, code, roleHint: 'QUALIFIED_PERSON', correlationId: 'corr-1' };
}

describe('P9.C1 decision view model (C-06.3, G-1, I-5/I-6)', () => {
  it('renders loaded questions with no default answer and drops authored text', () => {
    const model = decisionViewModel(
      envelope({
        status: 'LOADED',
        questionSet: {
          id: 'qs-1',
          version: '1',
          ruleStatus: 'REVIEWED',
          productKey: 'SYNTHETIC_PRODUCT',
          questions: [{ id: 'Q1', prompt: 'Synthetic question one?', answerCodes: ['YES', 'NO'] }],
        },
      }),
    );
    expect(model.kind).toBe('QUESTIONS');
    expect(model.questions).toEqual([
      { id: 'Q1', prompt: 'Synthetic question one?', answerCodes: ['YES', 'NO'] },
    ]);
    expect(model.canFinalise).toBe(true);
    expect(JSON.stringify(model)).not.toContain('default');
    expect(JSON.stringify(model)).not.toContain('selected');
  });

  it('keeps Finalise disabled when no product mapping was supplied', () => {
    const model = decisionViewModel(
      envelope({
        status: 'LOADED',
        questionSet: {
          id: 'qs-1',
          version: '1',
          questions: [{ id: 'Q1', prompt: 'Synthetic question one?', answerCodes: ['YES', 'NO'] }],
        },
      }),
    );
    expect(model.kind).toBe('QUESTIONS');
    expect(model.canFinalise).toBe(false);
  });

  it('keeps Finalise disabled when question data is missing', () => {
    const model = decisionViewModel(
      envelope({
        status: 'MISSING',
        message: 'Decision questions are not available (rule data missing)',
      }),
    );
    expect(model.kind).toBe('MISSING');
    expect(model.message).toBe(DECISION_UI_STRINGS.questionsMissing);
    expect(model.canFinalise).toBe(false);
  });

  it('shows final state without rationale or record text', () => {
    const model = decisionViewModel(
      envelope({
        id: 'decision-1',
        caseId: 'case-1',
        version: 2,
        state: 'FINAL',
        awarenessDate: '2026-11-01',
        awarenessBasis: 'JIRA_RECORD_TIMESTAMP',
        rationale: 'private authored text',
        quote: 'record text',
      }),
    );
    expect(model.kind).toBe('FINAL');
    expect(model.decision).toMatchObject({ id: 'decision-1', version: 2, state: 'FINAL' });
    expect(JSON.stringify(model)).not.toContain('private authored text');
    expect(JSON.stringify(model)).not.toContain('record text');
    expect(scanWording([model.message, DECISION_UI_STRINGS.notice])).toEqual({ status: 'CLEAN' });
  });
});
