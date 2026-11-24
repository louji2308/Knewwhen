/**
 * P2.B1 — the single Jira door (IF-6, Arch §12/§14.4). Pure: the transport,
 * budget meter, clock and wait are injected; this module imports no @forge/*.
 *
 * One client for every Jira call, with an explicit identity (as-user/as-app),
 * a budget class and a timeout. Status classification is fixed (§14.4);
 * transient failures retry within a bounded attempt count, honouring Retry-After
 * only up to 900 s (PF-Q-2). Auth/consent is an explicit state, not a blind
 * retry. Request/response bodies are never logged and never echoed into an
 * error (I-6).
 */

import type { BudgetClass, JiraCallDescriptor, JiraClient, JiraIdentity } from '../contracts/jira';

export type StatusClass = 'ok' | 'transient' | 'permanent' | 'auth';

export function classifyStatus(status: number): StatusClass {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 429 || status === 408 || status >= 500) return 'transient';
  if (status === 400 || status === 403 || status === 404 || status === 410) return 'permanent';
  return 'auth';
}

/** Retry-After is capped at 900 s; otherwise exponential backoff with jitter. */
export function retryDelaySeconds(
  hint: number | undefined,
  attempt: number,
  jitter: () => number = Math.random,
): number {
  const raw = hint === undefined ? 2 ** attempt + jitter() : hint;
  return Math.min(Math.max(0, raw), 900);
}

export type JiraErrorCode =
  'JIRA_TRANSIENT' | 'JIRA_PERMANENT' | 'JIRA_AUTH' | 'JIRA_BUDGET_EXHAUSTED' | 'JIRA_EXHAUSTED';

/** Message is the code only — no response body can reach a log or error. */
export class JiraError extends Error {
  constructor(
    readonly code: JiraErrorCode,
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = 'JiraError';
  }
}

export interface JiraTransportResponse {
  readonly status: number;
  readonly body?: unknown;
  readonly retryAfterSeconds?: number;
}

export interface JiraTransport {
  request(
    descriptor: JiraCallDescriptor,
    identity: JiraIdentity,
    timeoutMs: number,
  ): Promise<JiraTransportResponse>;
}

/** One reservation per attempt, per hour bucket and budget class (§14.4). */
export interface JiraMeter {
  tryReserve(bucket: string, budgetClass: BudgetClass, points: number): boolean;
}

export interface JiraGatewayDeps {
  readonly transport: JiraTransport;
  readonly meter: JiraMeter;
  /** Required injections: no real clock or sleep lives in the pure core. */
  readonly clock: () => Date;
  readonly wait: (seconds: number) => Promise<void>;
  readonly maxAttempts?: number;
  readonly jitter?: () => number;
}

function pointsFor(descriptor: JiraCallDescriptor): number {
  return descriptor.method === 'GET' ? 1 : 2;
}

export function createJiraGateway(deps: JiraGatewayDeps): JiraClient {
  const { clock, wait } = deps;
  const maxAttempts = deps.maxAttempts ?? 3;
  const jitter = deps.jitter ?? Math.random;

  return {
    async call(descriptor, identity, budgetClass, timeoutMs) {
      const bucket = clock().toISOString().slice(0, 13); // UTC hour, no real clock in tests
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!deps.meter.tryReserve(bucket, budgetClass, pointsFor(descriptor))) {
          throw new JiraError('JIRA_BUDGET_EXHAUSTED');
        }
        const response = await deps.transport.request(descriptor, identity, timeoutMs);
        const statusClass = classifyStatus(response.status);
        if (statusClass === 'ok') return response.body;
        if (statusClass === 'permanent') throw new JiraError('JIRA_PERMANENT');
        if (statusClass === 'auth') throw new JiraError('JIRA_AUTH');
        const delay = retryDelaySeconds(response.retryAfterSeconds, attempt, jitter);
        if (attempt === maxAttempts - 1) throw new JiraError('JIRA_EXHAUSTED', delay);
        await wait(delay);
      }
      throw new JiraError('JIRA_EXHAUSTED');
    },
  };
}

export interface JiraWriter {
  setIssueProperty(
    issueId: string,
    key: string,
    value: Readonly<Record<string, unknown>>,
    identity?: JiraIdentity,
  ): Promise<unknown>;
  setCommentProperty(
    issueId: string,
    commentId: string,
    key: string,
    value: Readonly<Record<string, unknown>>,
    identity?: JiraIdentity,
  ): Promise<unknown>;
  addComment(
    issueId: string,
    body: Readonly<Record<string, unknown>>,
    identity?: JiraIdentity,
  ): Promise<unknown>;
  addLabel(issueId: string, label: string, identity?: JiraIdentity): Promise<unknown>;
  createIssue(fields: Readonly<Record<string, unknown>>, identity?: JiraIdentity): Promise<unknown>;
}

/**
 * Exactly five write methods (C-07.10). No generic `write` or delete method
 * exists, so a sixth Jira write is unreachable by construction.
 */
export function createJiraWriter(client: JiraClient, timeoutMs = 5000): JiraWriter {
  const APP: JiraIdentity = { kind: 'app' };
  const call = (descriptor: JiraCallDescriptor, identity: JiraIdentity = APP): Promise<unknown> =>
    client.call(descriptor, identity, 'writeback', timeoutMs);
  return {
    setIssueProperty(issueId, key, value, identity) {
      return call(
        {
          method: 'PUT',
          resource: `/rest/api/3/issue/${issueId}/properties/${key}`,
          body: value,
        },
        identity,
      );
    },
    setCommentProperty(issueId, commentId, key, value, identity) {
      return call(
        {
          method: 'PUT',
          resource: `/rest/api/3/issue/${issueId}/comment/${commentId}/properties/${key}`,
          body: value,
        },
        identity,
      );
    },
    addComment(issueId, body, identity) {
      return call(
        { method: 'POST', resource: `/rest/api/3/issue/${issueId}/comment`, body },
        identity,
      );
    },
    addLabel(issueId, label, identity) {
      return call(
        {
          method: 'PUT',
          resource: `/rest/api/3/issue/${issueId}`,
          body: { update: { labels: [{ add: label }] } },
        },
        identity,
      );
    },
    createIssue(fields, identity) {
      return call({ method: 'POST', resource: '/rest/api/3/issue', body: fields }, identity);
    },
  };
}
