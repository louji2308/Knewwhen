/**
 * P9.A2 — strict question-set loader (Arch §10.2, §11.2, C-06.3, WF-15, I-5/I-7).
 * This is rule data, never app content. A missing or non-conforming set fails
 * closed: the Decision tab keeps Finalise disabled and shows the fixed message.
 * There is no default answer, pre-fill, ranking or free-text answer vocabulary.
 */

import { createHash } from 'node:crypto';
import {
  QUESTION_SET_STATUSES,
  type DecisionQuestion,
  type QuestionSet,
} from '../contracts/question-set';

export type LoadedQuestionSet =
  | { readonly status: 'LOADED'; readonly questionSet: QuestionSet; readonly digest: string }
  | { readonly status: 'FAILED'; readonly code: 'MISSING' | 'INVALID' };

const ANSWER_CODE = /^[A-Z][A-Z0-9_]*$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

function parseQuestion(raw: unknown): DecisionQuestion | null {
  if (
    !isRecord(raw) ||
    !exactKeys(raw, ['answerCodes', 'id', 'prompt']) ||
    typeof raw.id !== 'string' ||
    !ANSWER_CODE.test(raw.id) ||
    typeof raw.prompt !== 'string' ||
    raw.prompt.length === 0 ||
    raw.prompt.length > 2_000 ||
    !Array.isArray(raw.answerCodes) ||
    raw.answerCodes.length === 0 ||
    !raw.answerCodes.every(
      (code) => typeof code === 'string' && ANSWER_CODE.test(code) && code.length <= 64,
    )
  ) {
    return null;
  }
  const answerCodes = raw.answerCodes as string[];
  if (new Set(answerCodes).size !== answerCodes.length) return null;
  return { id: raw.id, prompt: raw.prompt, answerCodes };
}

/** `null`/`undefined` is a distinct, honest missing-set state. */
export function loadQuestionSet(raw: unknown): LoadedQuestionSet {
  if (raw === null || raw === undefined) return { status: 'FAILED', code: 'MISSING' };
  if (
    !isRecord(raw) ||
    !exactKeys(raw, ['id', 'questions', 'status', 'version']) ||
    typeof raw.id !== 'string' ||
    raw.id.length === 0 ||
    typeof raw.version !== 'string' ||
    raw.version.length === 0 ||
    typeof raw.status !== 'string' ||
    !QUESTION_SET_STATUSES.includes(raw.status as QuestionSet['status']) ||
    !Array.isArray(raw.questions) ||
    raw.questions.length === 0
  ) {
    return { status: 'FAILED', code: 'INVALID' };
  }

  const questions: DecisionQuestion[] = [];
  const ids = new Set<string>();
  for (const entry of raw.questions) {
    const question = parseQuestion(entry);
    if (question === null || ids.has(question.id)) return { status: 'FAILED', code: 'INVALID' };
    ids.add(question.id);
    questions.push(question);
  }

  const questionSet: QuestionSet = {
    id: raw.id,
    version: raw.version,
    status: raw.status as QuestionSet['status'],
    questions,
  };
  const digest = createHash('sha256')
    .update(JSON.stringify(questionSet))
    .digest('hex')
    .toUpperCase();
  return { status: 'LOADED', questionSet, digest };
}
