import { describe, expect, it, vi } from 'vitest';
import { createOperationHandlers, type OperationDependencies } from '../src/handlers/operations';
import type { GateContext, GateDecision } from '../src/contracts/authorisation';

const context: GateContext = { accountId: 'actor-1', canBrowseResource: true };
const decision: Extract<GateDecision, { allow: true }> = {
  allow: true,
  role: 'REVIEWER',
};

function deps(overrides: Partial<OperationDependencies> = {}): OperationDependencies {
  return {
    now: () => '2026-11-24T12:00:00.000Z',
    ...overrides,
  };
}

describe('P6/P7 gated operation handlers (Arch §13.3, I-4/I-11)', () => {
  it('MANUAL_SCAN takes only an issue id and delegates to injected ports', async () => {
    const scan = vi.fn().mockResolvedValue({ status: 'DONE', result: 'NO_SIGNAL' });
    const handlers = createOperationHandlers(deps({ manualScan: scan }));
    const result = await handlers.MANUAL_SCAN?.(context, decision, { issueId: 'KW-100' });
    expect(scan).toHaveBeenCalledWith('KW-100');
    expect(result).toMatchObject({
      data: { status: 'DONE', result: 'NO_SIGNAL' },
      roleHint: 'REVIEWER',
    });
  });

  it('MANUAL_SCAN refuses record text, role claims and missing ids', async () => {
    const scan = vi.fn();
    const handlers = createOperationHandlers(deps({ manualScan: scan }));
    for (const payload of [
      { issueId: 'KW-100', summary: 'untrusted' },
      { issueId: 'KW-100', role: 'QUALIFIED_PERSON' },
      { issueId: '' },
      null,
    ]) {
      const result = await handlers.MANUAL_SCAN?.(context, decision, payload);
      expect(result).toMatchObject({ code: 'INVALID_REQUEST', data: null });
    }
    expect(scan).not.toHaveBeenCalled();
  });

  it('RETRY_WRITEBACK delegates with no body, rationale or role claim', async () => {
    const retry = vi.fn().mockResolvedValue({ processed: 2, done: 2 });
    const handlers = createOperationHandlers(deps({ retryWriteback: retry }));
    const result = await handlers.RETRY_WRITEBACK?.(context, decision, { limit: 2 });
    expect(retry).toHaveBeenCalledWith(2);
    expect(result).toMatchObject({ data: { processed: 2, done: 2 }, roleHint: 'REVIEWER' });
    const refused = await handlers.RETRY_WRITEBACK?.(context, decision, { body: 'secret' });
    expect(refused).toMatchObject({ code: 'INVALID_REQUEST', data: null });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('omits handlers when no live port is injected, not a demo fallback', () => {
    const handlers = createOperationHandlers(deps());
    expect(handlers.MANUAL_SCAN).toBeUndefined();
    expect(handlers.RETRY_WRITEBACK).toBeUndefined();
  });
});
