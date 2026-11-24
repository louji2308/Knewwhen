import { describe, expect, it, vi } from 'vitest';
import {
  JiraError,
  classifyStatus,
  createJiraWriter,
  retryDelaySeconds,
  type JiraGatewayDeps,
  type JiraTransportResponse,
} from '../src/services/jira-client';
import { createJiraGateway } from '../src/services/jira-client';
import type { JiraCallDescriptor, JiraIdentity } from '../src/contracts/jira';

const USER: JiraIdentity = { kind: 'user', accountId: 'acct-1' };
const DESC = { method: 'GET' as const, resource: '/rest/api/3/issue/1' };

const deps = (overrides: Partial<JiraGatewayDeps> = {}): JiraGatewayDeps => ({
  transport: { request: async () => ({ status: 200, body: { ok: true } }) },
  meter: { tryReserve: () => true },
  clock: () => new Date('2026-11-24T12:34:56.000Z'),
  wait: async () => undefined,
  jitter: () => 0,
  maxAttempts: 3,
  ...overrides,
});

describe('P2.B1 status classification (Arch §14.4)', () => {
  it('maps statuses with independent literals', () => {
    for (const s of [200, 201, 204]) expect(classifyStatus(s)).toBe('ok');
    for (const s of [429, 500, 502, 503, 504]) expect(classifyStatus(s)).toBe('transient');
    for (const s of [400, 403, 404, 410]) expect(classifyStatus(s)).toBe('permanent');
    for (const s of [401, 302]) expect(classifyStatus(s)).toBe('auth');
  });
});

describe('P2.B1 bounded retry delay (PF-Q-2)', () => {
  it('honours Retry-After capped at 900 seconds', () => {
    expect(retryDelaySeconds(30, 1, () => 0)).toBe(30);
    expect(retryDelaySeconds(5000, 1, () => 0)).toBe(900);
  });

  it('uses exponential backoff with injectable jitter when no hint is present', () => {
    expect(retryDelaySeconds(undefined, 0, () => 0)).toBe(1);
    expect(retryDelaySeconds(undefined, 2, () => 0)).toBe(4);
    expect(retryDelaySeconds(undefined, 20, () => 0)).toBe(900);
  });
});

describe('P2.B1 single Jira client (IF-6; Arch §14.4)', () => {
  it('returns a 2xx body and reserves budget once', async () => {
    const tryReserve = vi.fn(() => true);
    const gateway = createJiraGateway(deps({ meter: { tryReserve } }));
    await expect(gateway.call(DESC, USER, 'panel', 5000)).resolves.toEqual({ ok: true });
    expect(tryReserve).toHaveBeenCalledTimes(1);
    expect(tryReserve).toHaveBeenCalledWith('2026-11-24T12', 'panel', 1);
  });

  it('retries a transient failure then succeeds', async () => {
    const responses: JiraTransportResponse[] = [
      { status: 429, retryAfterSeconds: 2 },
      { status: 200, body: { done: true } },
    ];
    const request = vi.fn(async () => responses.shift()!);
    const wait = vi.fn(async () => undefined);
    const gateway = createJiraGateway(deps({ transport: { request }, wait }));
    await expect(gateway.call(DESC, USER, 'scan', 5000)).resolves.toEqual({ done: true });
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(2);
  });

  it('does not retry a permanent or auth failure', async () => {
    for (const [status, code] of [
      [404, 'JIRA_PERMANENT'],
      [401, 'JIRA_AUTH'],
    ] as const) {
      const request = vi.fn(async () => ({ status }));
      const gateway = createJiraGateway(deps({ transport: { request } }));
      await expect(gateway.call(DESC, USER, 'panel', 5000)).rejects.toMatchObject({ code });
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it('ends in a typed exhausted state with a retry hint after the attempt limit', async () => {
    const gateway = createJiraGateway(
      deps({
        transport: {
          request: async () => ({ status: 503, retryAfterSeconds: 7 }),
        },
      }),
    );
    await expect(gateway.call(DESC, USER, 'sweep', 5000)).rejects.toMatchObject({
      code: 'JIRA_EXHAUSTED',
      retryAfterSeconds: 7,
    });
  });

  it('fails closed on budget exhaustion before any request', async () => {
    const request = vi.fn();
    const gateway = createJiraGateway(
      deps({ transport: { request }, meter: { tryReserve: () => false } }),
    );
    await expect(gateway.call(DESC, USER, 'sweep', 5000)).rejects.toMatchObject({
      code: 'JIRA_BUDGET_EXHAUSTED',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('never echoes a response body or canary probe into an error (I-6)', async () => {
    const gateway = createJiraGateway(
      deps({
        transport: {
          request: async () => ({ status: 404, body: { text: 'canary-record-text-alpha-7f3a' } }),
        },
      }),
    );
    const error = await gateway.call(DESC, USER, 'panel', 5000).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(JiraError);
    expect((error as Error).message).not.toContain('canary');
    expect((error as Error).message).not.toContain('text');
  });
});

describe('P2.B1 five-operation JiraWriter (C-07.10; Arch §13.2)', () => {
  it('exposes exactly the five approved writes and no sixth', () => {
    const gateway = createJiraGateway(deps());
    const writer = createJiraWriter(gateway);
    expect(Object.keys(writer).sort()).toEqual(
      ['setIssueProperty', 'setCommentProperty', 'addComment', 'addLabel', 'createIssue'].sort(),
    );
    expect('deleteIssue' in writer).toBe(false);
    expect('write' in writer).toBe(false);
  });

  it('maps each method to the correct method and resource', async () => {
    const request = vi.fn(
      async (_descriptor: JiraCallDescriptor, _identity: JiraIdentity, _timeoutMs: number) => ({
        status: 200,
        body: { id: '99' },
      }),
    );
    const writer = createJiraWriter(createJiraGateway(deps({ transport: { request } })));
    await writer.setIssueProperty('1', 'knewwhen.case', { caseId: 'uuid' });
    await writer.setCommentProperty('1', '55', 'knewwhen.case', { caseId: 'uuid' });
    await writer.addLabel('1', 'knewwhen-flag');
    await writer.createIssue({ project: 'KW' });
    await writer.addComment('1', { type: 'doc' });
    const calls = request.mock.calls.map(([d]) => ({
      method: d.method,
      resource: d.resource,
    }));
    expect(calls).toEqual([
      { method: 'PUT', resource: '/rest/api/3/issue/1/properties/knewwhen.case' },
      { method: 'PUT', resource: '/rest/api/3/issue/1/comment/55/properties/knewwhen.case' },
      { method: 'PUT', resource: '/rest/api/3/issue/1' },
      { method: 'POST', resource: '/rest/api/3/issue' },
      { method: 'POST', resource: '/rest/api/3/issue/1/comment' },
    ]);
  });

  it('uses the writeback budget class and the explicit identity', async () => {
    const request = vi.fn(async () => ({ status: 200 }));
    const tryReserve = vi.fn(() => true);
    const writer = createJiraWriter(
      createJiraGateway(deps({ transport: { request }, meter: { tryReserve } })),
    );
    await writer.addLabel('7', 'knewwhen-flag', USER);
    expect(request).toHaveBeenCalledWith(expect.any(Object), USER, expect.any(Number));
    expect(tryReserve).toHaveBeenCalledWith('2026-11-24T12', 'writeback', 2);
  });
});
