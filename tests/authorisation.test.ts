import { describe, expect, it, vi } from 'vitest';
import {
  assertRegistryMatchesMatrix,
  contextFromPlatform,
  createGate,
  type AuditEvent,
  type AuditSink,
  type GatedHandler,
  type HandlerRegistry,
  type RoleResolver,
  decide,
  isRegisteredHandler,
} from '../src/handlers/authorisation';
import {
  ACTIONS,
  HANDLER_ACTIONS,
  ROLES,
  ROLE_MATRIX,
  type Action,
  type GateContext,
  type Role,
} from '../src/contracts/authorisation';

const ctx = (overrides: Partial<GateContext> = {}): GateContext => ({
  accountId: 'acct-check-1',
  canBrowseResource: true,
  ...overrides,
});

const roles: RoleResolver = async () => ['VIEWER'];
const fullRegistry = (): HandlerRegistry =>
  Object.fromEntries(
    HANDLER_ACTIONS.map((action) => [action, async () => action]),
  ) as unknown as HandlerRegistry;

describe('P2.D1 authorisation gate (G-4, I-4; Arch §13.3)', () => {
  it('allows an action for a role the matrix grants', async () => {
    const result = await decide(ctx(), 'SEE_SIGNAL', roles);
    expect(result.allow).toBe(true);
  });

  it('denies an action the role does not have and attributes the code-only audit event', async () => {
    const events: AuditEvent[] = [];
    const sink: AuditSink = async (event) => {
      events.push({ ...event });
    };
    const result = await decide(ctx(), 'DECIDE', roles, sink);
    expect(result.allow).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0]!.actionCode).toBe('DECIDE');
    expect(events[0]!.errorCode).toBe('DENIED');
    expect(events[0]!.actorAccountId).toBe('acct-check-1');
    const codes = { actionCode: events[0]!.actionCode, errorCode: events[0]!.errorCode };
    expect(JSON.stringify(codes)).not.toContain('acct-check-1');
  });

  it('denies when the caller cannot browse the resource', async () => {
    const result = await decide(ctx({ canBrowseResource: false }), 'DECIDE', async () => [
      'QUALIFIED_PERSON',
    ]);
    expect(result.allow).toBe(false);
  });

  it('fails closed when dependency resolution throws (no fail-open path)', async () => {
    const broken: RoleResolver = async () => {
      throw new Error('dependency down');
    };
    const result = await decide(ctx(), 'SEE_SIGNAL', broken);
    expect(result.allow).toBe(false);
    if (!result.allow) expect(result.code).toBe('DEPENDENCY_FAILED');
  });

  it('attributes a dependency-failure denial to the caller, never to SYSTEM', async () => {
    const events: AuditEvent[] = [];
    const broken: RoleResolver = async () => {
      throw new Error('dependency down');
    };
    await decide(ctx(), 'SEE_SIGNAL', broken, async (event) => {
      events.push(event);
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.errorCode).toBe('DEPENDENCY_FAILED');
    expect(events[0]!.actorAccountId).toBe('acct-check-1');
  });

  it('fails closed on an empty role set (first-run state)', async () => {
    const result = await decide(ctx(), 'VIEW_CASE', async () => []);
    expect(result.allow).toBe(false);
  });

  it('rejects unknown actions: unregistered handlers cannot be gated', () => {
    expect(isRegisteredHandler('DEFINITELY_NOT_AN_ACTION' as Action)).toBe(false);
    expect(isRegisteredHandler('DECIDE')).toBe(true);
  });

  it('enforces the full handler × role × browse matrix (Arch §13.3)', async () => {
    for (const action of ACTIONS) {
      for (const role of ROLES) {
        for (const canBrowseResource of [true, false]) {
          const outcome = await decide(ctx({ canBrowseResource }), action, async () => [role]);
          expect(outcome.allow, `${action}/${role}/browse=${canBrowseResource}`).toBe(
            canBrowseResource && ROLE_MATRIX[action].includes(role),
          );
        }
      }
    }
  });

  it('drops any role claim supplied with platform context (I-4)', async () => {
    const built = contextFromPlatform({
      accountId: 'acct-check-2',
      canBrowseResource: true,
      roles: ['QUALIFIED_PERSON'],
    });
    expect(built).toEqual({ accountId: 'acct-check-2', canBrowseResource: true });
    const outcome = await decide(built, 'DECIDE', async () => ['VIEWER']);
    expect(outcome.allow).toBe(false);
  });
});

describe('P2.D1 handler registry equality (Arch §13.3; plan P2.D1)', () => {
  it('accepts a registry with exactly the twelve matrix handlers', () => {
    expect(() => assertRegistryMatchesMatrix(fullRegistry())).not.toThrow();
  });

  it('rejects a missing handler and an extra handler', () => {
    const missing = { ...fullRegistry() };
    delete (missing as Record<string, GatedHandler>)['DECIDE'];
    expect(() => assertRegistryMatchesMatrix(missing)).toThrow('REGISTRY_MATRIX_MISMATCH');
    expect(() =>
      assertRegistryMatchesMatrix({ ...fullRegistry(), EXTRA_ACTION: async () => null }),
    ).toThrow('REGISTRY_MATRIX_MISMATCH');
  });

  it('refuses to construct a gate from a mismatched registry', () => {
    expect(() => createGate({} as HandlerRegistry, roles)).toThrow('REGISTRY_MATRIX_MISMATCH');
  });

  it('runs the registered handler only when the gate allows the call', async () => {
    const handler = vi.fn(async () => 'done') as GatedHandler;
    const registry = { ...fullRegistry(), DECIDE: handler } as HandlerRegistry;
    const gate = createGate(registry, async () => ['QUALIFIED_PERSON']);

    await expect(gate.dispatch('DECIDE', ctx())).resolves.toEqual({
      decision: { allow: true, role: 'QUALIFIED_PERSON' },
      result: 'done',
    });
    expect(handler).toHaveBeenCalledTimes(1);

    const denied = createGate(registry, async () => ['VIEWER'] as readonly Role[]);
    await expect(denied.dispatch('DECIDE', ctx())).resolves.toEqual({
      decision: { allow: false, code: 'DENIED' },
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
