import { describe, expect, it, vi } from 'vitest';
import type { GateContext, GateDecision } from '../src/contracts/authorisation';
import { createLookbackHandlers } from '../src/handlers/lookback';
import type { LookbackService } from '../src/services/lookback';

const context: GateContext = { accountId: 'qp-1', canBrowseResource: true };
const qp: Extract<GateDecision, { allow: true }> = { allow: true, role: 'QUALIFIED_PERSON' };
const reviewer: Extract<GateDecision, { allow: true }> = { allow: true, role: 'REVIEWER' };
const viewer: Extract<GateDecision, { allow: true }> = { allow: true, role: 'VIEWER' };

function service(): LookbackService {
  return {
    runStep: vi.fn().mockResolvedValue({ status: 'COMPLETED', candidates: [] }),
    list: vi.fn().mockResolvedValue([]),
    show: vi.fn().mockResolvedValue({ status: 'FOUND', segments: [] }),
    decide: vi.fn().mockResolvedValue({ status: 'DECIDED', state: 'ACCEPTED' }),
  } as unknown as LookbackService;
}

const payload = { caseId: 'case-1', anchorEntryId: 'entry-1' };

describe('P8.A4 lookback handlers (C-03.6, I-4/I-6/I-11)', () => {
  it('refuses a Viewer and strips any role or anchor claim from a step payload', async () => {
    const handlers = createLookbackHandlers({ lookback: service() });
    expect(await handlers.RUN_LOOKBACK!(context, viewer, payload)).toMatchObject({
      code: 'NOT_PERMITTED',
      data: null,
    });
    expect(
      await handlers.RUN_LOOKBACK!(context, qp, {
        ...payload,
        role: 'QUALIFIED_PERSON',
        anchorRecordTs: '2026-11-24T15:00:00.000Z',
      }),
    ).toMatchObject({ code: 'INVALID_REQUEST', data: null });
  });

  it('passes only ids and the server identity to the service', async () => {
    const svc = service();
    const handlers = createLookbackHandlers({ lookback: svc });
    const result = await handlers.RUN_LOOKBACK!(context, reviewer, { ...payload, cursor: 'c2' });
    expect(result).toMatchObject({ code: 'OK' });
    expect(svc.runStep).toHaveBeenCalledWith(
      { caseId: 'case-1', anchorEntryId: 'entry-1', cursor: 'c2' },
      'qp-1',
    );
  });

  it('supports list and live segment metadata without returning record text', async () => {
    const svc = service();
    const handlers = createLookbackHandlers({ lookback: svc });
    await handlers.RUN_LOOKBACK!(context, reviewer, { caseId: 'case-1', view: 'LIST' });
    expect(svc.list).toHaveBeenCalledWith('case-1');
    await handlers.RUN_LOOKBACK!(context, reviewer, {
      caseId: 'case-1',
      candidateId: 'cand-1',
      view: 'SHOW',
    });
    expect(svc.show).toHaveBeenCalledWith('case-1', 'cand-1', 'qp-1');
  });

  it('keeps the same-event answer QP-only and cannot be granted by a payload role', async () => {
    const svc = service();
    const handlers = createLookbackHandlers({ lookback: svc });
    const decision = {
      caseId: 'case-1',
      candidateId: 'cand-1',
      decision: 'YES' as const,
      choice: { segmentKey: 's0', wholeSegment: true },
    };
    expect(
      await handlers.CONFIRM_SAME_EVENT!(context, reviewer, {
        ...decision,
        role: 'QUALIFIED_PERSON',
      }),
    ).toMatchObject({ code: 'NOT_PERMITTED', data: null });
    expect(svc.decide).not.toHaveBeenCalled();
    await handlers.CONFIRM_SAME_EVENT!(context, qp, decision);
    expect(svc.decide).toHaveBeenCalledWith({
      caseId: 'case-1',
      candidateId: 'cand-1',
      decision: 'YES',
      role: 'QUALIFIED_PERSON',
      actor: 'qp-1',
      viewerAccountId: 'qp-1',
      choice: { segmentKey: 's0', wholeSegment: true },
    });
  });

  it('registers no lookback handler when no service is injected', () => {
    const handlers = createLookbackHandlers({});
    expect(handlers.RUN_LOOKBACK).toBeUndefined();
    expect(handlers.CONFIRM_SAME_EVENT).toBeUndefined();
  });
});
