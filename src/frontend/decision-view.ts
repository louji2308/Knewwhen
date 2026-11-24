/**
 * P9.C1 — pure Decision tab view model (Arch §7, §11.2, C-06.3, G-1, I-5/I-6).
 * It never holds authority, never supplies an answer and never carries rationale
 * or Jira record text into the rendered model. Finalise is enabled only when a
 * strict question set was loaded.
 */

import type { ResolverEnvelope } from '../contracts/envelope';

export const DECISION_UI_STRINGS = Object.freeze({
  title: 'Decision record',
  notice: 'Decision support, not a regulatory determination or legal advice.',
  idle: 'Start a draft to review the questions.',
  unavailable: 'Decision recording is not available on this installation.',
  error: 'The decision record could not be loaded.',
  questionsMissing: 'Decision questions are not available (rule data missing)',
  startDraft: 'Start decision draft',
  finalise: 'Finalise',
  supersede: 'Record a new version',
  noteWarning:
    'Your own words. Do not paste text from Jira records: KnewWhen stores what you type here.',
  save: 'Save',
  cancel: 'Cancel',
  notAnswered: 'Not answered',
  finalMessage: 'The decision is recorded in KnewWhen.',
  draftMessage: 'The draft is not recorded yet.',
  jqlHeading: 'Find this issue in Jira with',
});

interface ViewQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly answerCodes: readonly string[];
}

export interface DecisionSummary {
  readonly id: string;
  readonly caseId: string;
  readonly version: number;
  readonly state: string;
  readonly awarenessDate: string;
  readonly awarenessBasis: string;
}

export interface DecisionViewModel {
  readonly kind: 'IDLE' | 'QUESTIONS' | 'MISSING' | 'DRAFT' | 'FINAL' | 'UNAVAILABLE' | 'ERROR';
  readonly message: string;
  readonly canFinalise: boolean;
  readonly questions: readonly ViewQuestion[];
  readonly questionSetId: string;
  readonly questionSetVersion: string;
  readonly productKey: string;
  readonly decision: DecisionSummary | null;
}

const text = (value: unknown): string =>
  typeof value === 'string' && value.length > 0 ? value : '';

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;

const empty = (kind: DecisionViewModel['kind'], message: string): DecisionViewModel => ({
  kind,
  message,
  canFinalise: false,
  questions: [],
  questionSetId: '',
  questionSetVersion: '',
  productKey: '',
  decision: null,
});

function summary(data: Readonly<Record<string, unknown>>): DecisionSummary {
  const value = data.version;
  return {
    id: text(data.id),
    caseId: text(data.caseId),
    version: typeof value === 'number' && Number.isInteger(value) ? value : 0,
    state: text(data.state),
    awarenessDate: text(data.awarenessDate),
    awarenessBasis: text(data.awarenessBasis),
  };
}

export function decisionViewModel(envelope: ResolverEnvelope<unknown> | null): DecisionViewModel {
  if (envelope === null) return empty('IDLE', DECISION_UI_STRINGS.idle);
  if (envelope.code === 'NOT_FOUND' || envelope.code === 'NOT_PERMITTED') {
    return empty('UNAVAILABLE', DECISION_UI_STRINGS.unavailable);
  }
  if (envelope.code !== 'OK') return empty('ERROR', DECISION_UI_STRINGS.error);
  const data = record(envelope.data);
  if (data === null) return empty('ERROR', DECISION_UI_STRINGS.error);

  if (data.status === 'MISSING') {
    return empty('MISSING', DECISION_UI_STRINGS.questionsMissing);
  }
  if (data.status === 'LOADED') {
    const set = record(data.questionSet);
    if (set === null || !Array.isArray(set.questions)) {
      return empty('MISSING', DECISION_UI_STRINGS.questionsMissing);
    }
    const questions: ViewQuestion[] = [];
    for (const item of set.questions) {
      const question = record(item);
      if (
        question === null ||
        text(question.id) === '' ||
        text(question.prompt) === '' ||
        !Array.isArray(question.answerCodes) ||
        question.answerCodes.length === 0 ||
        question.answerCodes.some((code) => typeof code !== 'string' || code.length === 0)
      ) {
        return empty('MISSING', DECISION_UI_STRINGS.questionsMissing);
      }
      questions.push({
        id: text(question.id),
        prompt: text(question.prompt),
        answerCodes: question.answerCodes as readonly string[],
      });
    }
    const productKey = text(set.productKey);
    return {
      ...empty('QUESTIONS', ''),
      canFinalise: questions.length > 0 && productKey.length > 0,
      questions,
      questionSetId: text(set.id),
      questionSetVersion: text(set.version),
      productKey,
    };
  }

  const decision = summary(data);
  if (decision.state === 'FINAL') {
    return { ...empty('FINAL', DECISION_UI_STRINGS.finalMessage), decision };
  }
  if (decision.state === 'DRAFT') {
    return { ...empty('DRAFT', DECISION_UI_STRINGS.draftMessage), decision };
  }
  return empty('ERROR', DECISION_UI_STRINGS.error);
}
