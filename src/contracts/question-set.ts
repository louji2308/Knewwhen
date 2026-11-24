/**
 * P9.0 — IF-16 question-set contract (Arch §10.2, §11.2, C-06.3, I-5/I-7).
 * Question prompts and answer codes are rule data. The app supplies no default,
 * ranking, free text, answer suggestion or regulatory interpretation.
 */

import { RULE_STATUSES, type RuleStatus } from './deadlines';

export type QuestionSetStatus = RuleStatus;

export interface DecisionQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly answerCodes: readonly string[];
}

export interface QuestionSet {
  readonly id: string;
  readonly version: string;
  readonly status: QuestionSetStatus;
  readonly questions: readonly DecisionQuestion[];
}

export const QUESTION_SET_STATUSES: readonly QuestionSetStatus[] = RULE_STATUSES;
