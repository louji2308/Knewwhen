import { describe, expect, it } from 'vitest';
import { loadQuestionSet } from '../src/services/question-set';

const valid = {
  id: 'qs-synthetic-v1',
  version: '1',
  status: 'REVIEWED',
  questions: [
    { id: 'Q1', prompt: 'Synthetic question one?', answerCodes: ['YES', 'NO'] },
    { id: 'Q2', prompt: 'Synthetic question two?', answerCodes: ['A', 'B', 'C'] },
  ],
};

describe('P9.A2 decision question-set loader (C-06.3, WF-15, I-5/I-7)', () => {
  it('loads only strict rule data and never supplies a default answer', () => {
    const loaded = loadQuestionSet(valid);
    expect(loaded.status).toBe('LOADED');
    if (loaded.status !== 'LOADED') return;
    expect(loaded.questionSet.questions.map((question) => question.answerCodes)).toEqual([
      ['YES', 'NO'],
      ['A', 'B', 'C'],
    ]);
    expect(JSON.stringify(loaded.questionSet)).not.toContain('default');
    expect(JSON.stringify(loaded.questionSet)).not.toContain('selected');
  });

  it('rejects missing, unknown or free-text answer vocabularies', () => {
    expect(loadQuestionSet(null)).toMatchObject({ status: 'FAILED', code: 'MISSING' });
    expect(loadQuestionSet({ ...valid, extra: 1 })).toMatchObject({
      status: 'FAILED',
      code: 'INVALID',
    });
    expect(
      loadQuestionSet({ ...valid, questions: [{ id: 'Q1', prompt: 'p', answerCodes: [] }] }),
    ).toMatchObject({ status: 'FAILED', code: 'INVALID' });
    expect(
      loadQuestionSet({
        ...valid,
        questions: [{ id: 'Q1', prompt: 'p', answerCodes: ['Free text answer'] }],
      }),
    ).toMatchObject({ status: 'FAILED', code: 'INVALID' });
    expect(loadQuestionSet({ ...valid, status: 'UNKNOWN' })).toMatchObject({
      status: 'FAILED',
      code: 'INVALID',
    });
  });
});
