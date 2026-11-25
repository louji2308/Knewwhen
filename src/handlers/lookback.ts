/**
 * P8.A4 — gated lookback resolvers (Arch §13.3, C-03.6, I-4/I-6).
 * RUN_LOOKBACK is a Reviewer/QP action with three read forms (step, list and
 * live segment metadata); CONFIRM_SAME_EVENT is QP-only. The client supplies
 * ids, codes, dates and authored phrases only — never a role, anchor timestamp,
 * token set, record text or awareness date. No service means no handler, so the
 * registry's honest NOT_FOUND applies (I-11).
 */

import { ROLE_MATRIX } from '../contracts/authorisation';
import type { CandidateChoice, LookbackStepInput } from '../contracts/lookback';
import type { ResolverEnvelope } from '../contracts/envelope';
import type { LookbackService } from '../services/lookback';
import type { GatedHandler } from './authorisation';

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

function runPayload(value: unknown):
  | LookbackStepInput
  | { caseId: string; view: 'LIST' }
  | {
      caseId: string;
      candidateId: string;
      view: 'SHOW';
    }
  | null {
  if (!isRecord(value) || text(value.caseId) === undefined) return null;
  const caseId = String(value.caseId);
  if (value.view === undefined) {
    if (
      !onlyKeys(value, ['caseId', 'anchorEntryId', 'cursor']) ||
      text(value.anchorEntryId) === undefined ||
      !(value.cursor === undefined || typeof value.cursor === 'string')
    ) {
      return null;
    }
    return {
      caseId,
      anchorEntryId: String(value.anchorEntryId),
      ...(value.cursor === undefined ? {} : { cursor: String(value.cursor) }),
    };
  }
  if (value.view === 'LIST') {
    return onlyKeys(value, ['caseId', 'view']) ? { caseId, view: 'LIST' } : null;
  }
  if (value.view === 'SHOW') {
    return onlyKeys(value, ['caseId', 'candidateId', 'view']) &&
      text(value.candidateId) !== undefined
      ? { caseId, candidateId: String(value.candidateId), view: 'SHOW' }
      : null;
  }
  return null;
}

function choiceFrom(value: unknown): CandidateChoice | null {
  if (!isRecord(value) || !onlyKeys(value, ['segmentKey', 'quote', 'wholeSegment'])) return null;
  if (text(value.segmentKey) === undefined) return null;
  if (value.wholeSegment !== undefined && typeof value.wholeSegment !== 'boolean') return null;
  if (value.quote !== undefined && typeof value.quote !== 'string') return null;
  return {
    segmentKey: String(value.segmentKey),
    ...(value.quote === undefined ? {} : { quote: String(value.quote) }),
    ...(value.wholeSegment === undefined ? {} : { wholeSegment: value.wholeSegment === true }),
  };
}

export interface LookbackHandlerDependencies {
  readonly lookback?: LookbackService;
}

export function createLookbackHandlers(
  deps: LookbackHandlerDependencies,
): Partial<Record<'RUN_LOOKBACK' | 'CONFIRM_SAME_EVENT', GatedHandler>> {
  const handlers: Partial<Record<'RUN_LOOKBACK' | 'CONFIRM_SAME_EVENT', GatedHandler>> = {};
  if (deps.lookback === undefined) return handlers;

  handlers.RUN_LOOKBACK = async (context, decision, payload) => {
    if (!ROLE_MATRIX.RUN_LOOKBACK.includes(decision.role)) {
      return envelope(null, decision.role, 'NOT_PERMITTED');
    }
    const parsed = runPayload(payload);
    if (parsed === null) return envelope(null, decision.role, 'INVALID_REQUEST');
    try {
      if ('view' in parsed && parsed.view === 'LIST') {
        return envelope(
          {
            kind: 'LOOKBACK_LIST' as const,
            candidates: await deps.lookback!.list(parsed.caseId),
          },
          decision.role,
          'OK',
        );
      }
      if ('view' in parsed && parsed.view === 'SHOW') {
        const shown = await deps.lookback!.show(
          parsed.caseId,
          parsed.candidateId,
          context.accountId,
        );
        if (shown.status === 'NOT_FOUND') return envelope(null, decision.role, 'NOT_FOUND');
        return envelope({ ...shown, kind: 'LOOKBACK_SEGMENTS' as const }, decision.role, 'OK');
      }
      const data = await deps.lookback!.runStep(parsed, context.accountId);
      if (data.status === 'UNAVAILABLE') return envelope(null, decision.role, 'NOT_FOUND');
      return envelope({ ...data, kind: 'LOOKBACK_STEP' as const }, decision.role, 'OK');
    } catch {
      return envelope(null, decision.role, 'DEPENDENCY_FAILED');
    }
  };

  handlers.CONFIRM_SAME_EVENT = async (context, decision, payload) => {
    if (!ROLE_MATRIX.CONFIRM_SAME_EVENT.includes(decision.role)) {
      return envelope(null, decision.role, 'NOT_PERMITTED');
    }
    if (
      !isRecord(payload) ||
      !onlyKeys(payload, ['caseId', 'candidateId', 'decision', 'choice']) ||
      text(payload.caseId) === undefined ||
      text(payload.candidateId) === undefined ||
      (payload.decision !== 'YES' &&
        payload.decision !== 'NO' &&
        payload.decision !== 'UNSURE' &&
        payload.decision !== 'REOPEN')
    ) {
      return envelope(null, decision.role, 'INVALID_REQUEST');
    }
    const choice = payload.choice === undefined ? undefined : choiceFrom(payload.choice);
    if (payload.choice !== undefined && choice === null) {
      return envelope(null, decision.role, 'INVALID_REQUEST');
    }
    try {
      const data = await deps.lookback!.decide({
        caseId: String(payload.caseId),
        candidateId: String(payload.candidateId),
        decision: payload.decision,
        role: decision.role,
        actor: context.accountId,
        viewerAccountId: context.accountId,
        ...(choice !== undefined && choice !== null ? { choice } : {}),
      });
      if (data.status === 'NOT_PERMITTED') return envelope(null, decision.role, 'NOT_PERMITTED');
      if (data.status === 'NOT_FOUND') return envelope(null, decision.role, 'NOT_FOUND');
      if (data.status === 'INVALID') return envelope(null, decision.role, 'INVALID_REQUEST');
      if (data.status === 'DEPENDENCY_FAILED') {
        return envelope(null, decision.role, 'DEPENDENCY_FAILED');
      }
      return envelope({ ...data, kind: 'LOOKBACK_DECISION' as const }, decision.role, 'OK');
    } catch {
      return envelope(null, decision.role, 'DEPENDENCY_FAILED');
    }
  };

  return handlers;
}
