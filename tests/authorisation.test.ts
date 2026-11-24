import { describe, expect, it } from 'vitest';
import {
  type AuditSink,
  type RoleResolver,
  decide,
  isRegisteredHandler,
} from '../src/handlers/authorisation';
import { type Action, type GateContext } from '../src/contracts/authorisation';

const ctx = (overrides: Partial<GateContext> = {}): GateContext => ({
  accountId: 'acct-check-1',
  roles: ['VIEWER'],
  canBrowseResource: true,
  ...overrides,
});

const roles: RoleResolver = async () => ['VIEWER'];

describe('P2.D1 authorisation gate (G-4, I-4; Arch §13.3)', () => {
  it('allows an action for a role the matrix grants', async () => {
    const result = await decide(ctx(), 'SEE_SIGNAL', roles);
    expect(result.allow).toBe(true);
  });

  it('denies an action the role does not have, and writes an audit event', async () => {
    const events: Array<Record<string, string>> = [];
    const sink: AuditSink = async (event) => {
      events.push({ ...event });
    };
    const result = await decide(ctx({ roles: ['VIEWER'] }), 'DECIDE', roles, sink);
    expect(result.allow).toBe(false);
    expect(events).toHaveLength(1);
    expect(events[0]!.actionCode).toBe('DECIDE');
    expect(events[0]!.errorCode).toBe('DENIED');
    expect(JSON.stringify(events)).not.toContain('acct-check-1');
  });

  it('denies when the caller cannot browse the resource', async () => {
    const result = await decide(
      ctx({ canBrowseResource: false, roles: ['QUALIFIED_PERSON'] }),
      'DECIDE',
      roles,
    );
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

  it('fails closed on an empty role set (first-run state)', async () => {
    const result = await decide(ctx({ roles: [] }), 'VIEW_CASE', async () => []);
    expect(result.allow).toBe(false);
  });

  it('rejects unknown actions: unregistered handlers cannot be gated', () => {
    expect(isRegisteredHandler('DEFINITELY_NOT_AN_ACTION' as Action)).toBe(false);
    expect(isRegisteredHandler('DECIDE')).toBe(true);
  });
});
