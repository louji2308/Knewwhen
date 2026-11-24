/**
 * P9 — gated deadline/decision resolvers. The handler accepts only metadata and
 * human-authored rationale from the client; identity and authority come from the
 * gate context and authoritative `decision.role`. Responses carry ids, codes,
 * dates and states only — never rationale, record text or a suggested answer.
 */

import { ROLE_MATRIX, type Role } from '../contracts/authorisation';
import { AWARENESS_BASES } from '../contracts/evidence';
import type { ResolverEnvelope } from '../contracts/envelope';
import type { QuestionSet } from '../contracts/question-set';
import type { DeadlineCandidate } from '../services/deadline';
import type { FinaliseInput, StartDraftInput, SupersedeInput } from '../services/decision';
import type { GatedHandler } from './authorisation';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const CODE = /^[A-Z][A-Z0-9_]*$/u;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

function onlyKeys(raw: Readonly<Record<string, unknown>>, allowed: readonly string[]): boolean {
  return Object.keys(raw).every((key) => allowed.includes(key));
}

function envelope<T>(
  data: T | null,
  role: string,
  code: ResolverEnvelope<T>['code'],
): ResolverEnvelope<T> {
  return {
    data,
    roleHint: role,
    correlationId: globalThis.crypto.randomUUID(),
    code,
  };
}

function safeDecision(row: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return {
    id: row['id'],
    caseId: row['case_id'],
    version: row['version'],
    state: row['state'],
    awarenessDate: row['awareness_date'],
    awarenessBasis: row['awareness_basis'],
  };
}

function candidatesFrom(raw: unknown): readonly DeadlineCandidate[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) return null;
  const candidates: DeadlineCandidate[] = [];
  for (const entry of raw) {
    if (
      !isRecord(entry) ||
      !onlyKeys(entry, ['entryId', 'basis', 'effectiveDate', 'reasonCode']) ||
      text(entry.entryId) === undefined ||
      typeof entry.basis !== 'string' ||
      !AWARENESS_BASES.includes(entry.basis as DeadlineCandidate['basis']) ||
      (entry.effectiveDate !== null &&
        (typeof entry.effectiveDate !== 'string' || !ISO_DATE.test(entry.effectiveDate))) ||
      (entry.reasonCode !== null &&
        (typeof entry.reasonCode !== 'string' || !CODE.test(entry.reasonCode)))
    ) {
      return null;
    }
    candidates.push({
      entryId: String(entry.entryId),
      basis: entry.basis as DeadlineCandidate['basis'],
      effectiveDate: typeof entry.effectiveDate === 'string' ? entry.effectiveDate : null,
      reasonCode: typeof entry.reasonCode === 'string' ? entry.reasonCode : null,
    });
  }
  return candidates;
}

export interface DecisionDependencies {
  readonly now: () => string;
  readonly computeDeadlines?: (
    input: { readonly caseId: string; readonly asOfDate: string; readonly nowISO: string },
    candidates: readonly DeadlineCandidate[],
  ) => Promise<unknown>;
  readonly startDraft?: (input: StartDraftInput) => Promise<Readonly<Record<string, unknown>>>;
  readonly finalise?: (input: FinaliseInput) => Promise<Readonly<Record<string, unknown>>>;
  readonly supersede?: (input: SupersedeInput) => Promise<Readonly<Record<string, unknown>>>;
  readonly getQuestionSet?: () => QuestionSet | null;
}

function computeHandler(
  deps: DecisionDependencies,
  compute: NonNullable<DecisionDependencies['computeDeadlines']>,
): GatedHandler {
  return async (context, decision, payload) => {
    if (!ROLE_MATRIX.COMPUTE_DEADLINES.includes(decision.role)) {
      return envelope(null, decision.role, 'NOT_PERMITTED');
    }
    if (
      !isRecord(payload) ||
      !onlyKeys(payload, ['asOfDate', 'caseId', 'candidates']) ||
      text(payload.caseId) === undefined ||
      typeof payload.asOfDate !== 'string' ||
      !ISO_DATE.test(payload.asOfDate)
    ) {
      return envelope(null, decision.role, 'INVALID_REQUEST');
    }
    const candidates = candidatesFrom(payload.candidates);
    if (candidates === null) return envelope(null, decision.role, 'INVALID_REQUEST');
    try {
      const data = await compute(
        {
          caseId: String(payload.caseId),
          asOfDate: payload.asOfDate,
          nowISO: deps.now(),
        },
        candidates,
      );
      return envelope(data, decision.role, 'OK');
    } catch {
      return envelope(null, decision.role, 'DEPENDENCY_FAILED');
    }
  };
}

function decideHandler(deps: DecisionDependencies): GatedHandler {
  return async (context, decision, payload) => {
    if (!ROLE_MATRIX.DECIDE.includes(decision.role)) {
      return envelope(null, decision.role, 'NOT_PERMITTED');
    }
    if (!isRecord(payload) || typeof payload.action !== 'string') {
      return envelope(null, decision.role, 'INVALID_REQUEST');
    }
    const role = decision.role as Role;
    const actorAccountId = context.accountId;
    const at = deps.now();
    try {
      if (payload.action === 'GET_QUESTIONS') {
        if (!onlyKeys(payload, ['action']) || !deps.getQuestionSet) {
          return envelope(null, decision.role, 'INVALID_REQUEST');
        }
        const questionSet = deps.getQuestionSet();
        if (questionSet === null) {
          return envelope(
            {
              status: 'MISSING',
              message: 'Decision questions are not available (rule data missing)',
            },
            decision.role,
            'OK',
          );
        }
        return envelope(
          {
            status: 'LOADED',
            questionSet: {
              id: questionSet.id,
              version: questionSet.version,
              ruleStatus: questionSet.status,
              productKey: null,
              questions: questionSet.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                answerCodes: question.answerCodes,
              })),
            },
          },
          decision.role,
          'OK',
        );
      }

      if (payload.action === 'START_DRAFT') {
        if (
          !onlyKeys(payload, [
            'action',
            'awarenessBasis',
            'awarenessDate',
            'awarenessEntryId',
            'caseId',
            'productKey',
          ]) ||
          text(payload.caseId) === undefined
        ) {
          return envelope(null, decision.role, 'INVALID_REQUEST');
        }
        const startDraft = deps.startDraft;
        if (!startDraft) return envelope(null, decision.role, 'NOT_FOUND');
        const awarenessEntryId = text(payload.awarenessEntryId);
        const awarenessDate = text(payload.awarenessDate);
        const awarenessBasis = text(payload.awarenessBasis) as
          StartDraftInput['awarenessBasis'] | undefined;
        const productKey = text(payload.productKey);
        const input: StartDraftInput = {
          caseId: String(payload.caseId),
          actorRole: role,
          actorAccountId,
          at,
          ...(awarenessEntryId !== undefined ? { awarenessEntryId } : {}),
          ...(awarenessDate !== undefined ? { awarenessDate } : {}),
          ...(awarenessBasis !== undefined ? { awarenessBasis } : {}),
          ...(productKey !== undefined ? { productKey } : {}),
        };
        return envelope(safeDecision(await startDraft(input)), decision.role, 'OK');
      }

      if (payload.action === 'FINALISE') {
        if (
          !onlyKeys(payload, [
            'action',
            'answers',
            'caseId',
            'deadlineCalcId',
            'draftId',
            'featureReasonCodes',
            'notAComplaint',
            'productKey',
            'questionSetId',
            'questionSetVersion',
            'rationale',
          ]) ||
          text(payload.draftId) === undefined ||
          text(payload.caseId) === undefined ||
          text(payload.questionSetId) === undefined ||
          text(payload.questionSetVersion) === undefined ||
          typeof payload.rationale !== 'string' ||
          payload.rationale.length === 0 ||
          text(payload.productKey) === undefined ||
          !isRecord(payload.answers) ||
          Object.values(payload.answers).some(
            (value) => typeof value !== 'string' || !CODE.test(value),
          ) ||
          (payload.featureReasonCodes !== undefined &&
            (!Array.isArray(payload.featureReasonCodes) ||
              payload.featureReasonCodes.some(
                (value) => typeof value !== 'string' || !CODE.test(value),
              )))
        ) {
          return envelope(null, decision.role, 'INVALID_REQUEST');
        }
        const finalise = deps.finalise;
        if (!finalise) return envelope(null, decision.role, 'NOT_FOUND');
        const deadlineCalcId = text(payload.deadlineCalcId);
        const input: FinaliseInput = {
          draftId: String(payload.draftId),
          caseId: String(payload.caseId),
          actorRole: role,
          actorAccountId,
          at,
          questionSetId: String(payload.questionSetId),
          questionSetVersion: String(payload.questionSetVersion),
          answers: payload.answers as Readonly<Record<string, string>>,
          rationale: payload.rationale,
          productKey: String(payload.productKey),
          notAComplaint: payload.notAComplaint === true,
          featureReasonCodes: (payload.featureReasonCodes as string[] | undefined) ?? [],
          ...(deadlineCalcId !== undefined ? { deadlineCalcId } : {}),
        };
        return envelope(safeDecision(await finalise(input)), decision.role, 'OK');
      }

      if (payload.action === 'SUPERSEDE') {
        if (
          !onlyKeys(payload, ['action', 'caseId', 'priorId', 'productKey', 'reasonCode']) ||
          text(payload.caseId) === undefined ||
          text(payload.priorId) === undefined ||
          typeof payload.reasonCode !== 'string' ||
          !CODE.test(payload.reasonCode)
        ) {
          return envelope(null, decision.role, 'INVALID_REQUEST');
        }
        const supersede = deps.supersede;
        if (!supersede) return envelope(null, decision.role, 'NOT_FOUND');
        const productKey = text(payload.productKey);
        const input: SupersedeInput = {
          caseId: String(payload.caseId),
          priorId: String(payload.priorId),
          actorRole: role,
          actorAccountId,
          at,
          reasonCode: payload.reasonCode,
          ...(productKey !== undefined ? { productKey } : {}),
        };
        return envelope(safeDecision(await supersede(input)), decision.role, 'OK');
      }
      return envelope(null, decision.role, 'INVALID_REQUEST');
    } catch {
      return envelope(null, decision.role, 'DEPENDENCY_FAILED');
    }
  };
}

/** Returns only the actions for which a live service port was injected. */
export function createDecisionHandlers(
  deps: DecisionDependencies,
): Partial<Record<'COMPUTE_DEADLINES' | 'DECIDE', GatedHandler>> {
  const handlers: Partial<Record<'COMPUTE_DEADLINES' | 'DECIDE', GatedHandler>> = {};
  if (deps.computeDeadlines)
    handlers.COMPUTE_DEADLINES = computeHandler(deps, deps.computeDeadlines);
  if (deps.startDraft || deps.finalise || deps.supersede || deps.getQuestionSet) {
    handlers.DECIDE = decideHandler(deps);
  }
  return handlers;
}
