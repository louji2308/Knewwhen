import { makeResolver, type Request } from '@forge/resolver';
import type { ShellModule, ShellStatus } from '../contracts/shell';
import type { ResolverEnvelope } from '../contracts/envelope';
import { createAwarenessDispatcher } from '../handlers/awareness-dispatch';
import type { AuditSink } from '../handlers/authorisation';
import { shellStatus } from '../handlers/shell';
import { audit, type AuditRepository } from '../services/audit';
import type { HashKeyMaterial } from '../services/hash-key';
import { createRepositories } from '../services/repositories';
import { createTrailService } from '../services/trail';
import { createForgeSqlPort } from './forge-sql';

/**
 * P1.B2 + P5.D1 — the only runtime bridge to @forge/resolver. The pure handlers
 * decide everything; this adapter passes platform identity through and never
 * logs payloads, record text or results.
 *
 * Deliberate fail-closed defaults: no role resolver, browse-permission adapter,
 * hash-key store or live Jira segment reader is approved in the locked stack
 * yet. Roles resolve to an empty set and browse is false, so the gate denies
 * instead of inventing authority or a hidden demo allow-list. Revalidation
 * returns AMBIGUOUS and capture remains unavailable until those adapters are
 * approved (AGENTS §7.4, §10.2).
 */

interface ShellPayload {
  module?: ShellModule;
}

interface AwarenessPayload {
  action?: unknown;
  payload?: unknown;
}

type PlatformContext = Readonly<Record<string, unknown>>;

interface OperationsPayload {
  action?: unknown;
  payload?: unknown;
}

type Definition = {
  knewwhenShell: (request: Request<ShellPayload>) => ShellStatus;
  knewwhenAwareness: (request: Request<AwarenessPayload>) => Promise<ResolverEnvelope<unknown>>;
  knewwhenOperations: (request: Request<OperationsPayload>) => Promise<ResolverEnvelope<unknown>>;
};

function readString(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : '';
}

const repositories = createRepositories(createForgeSqlPort());
const auditRepository: AuditRepository = {
  async insert(event) {
    await repositories.audit_event.insert({
      id: event.id,
      actor_type: event.actorType,
      actor_account_id: event.actorAccountId,
      action_code: event.actionCode,
      target_type: event.targetType,
      target_id: event.targetId,
      at: event.at,
      details_json: event.detailsJson,
    });
  },
};
const trail = createTrailService(
  repositories.review_case,
  repositories.trail_entry,
  auditRepository,
);
const recordAudit: AuditSink = async (event) => {
  await audit(auditRepository, {
    actorType: 'SYSTEM',
    actorAccountId: null,
    actionCode: event.actionCode,
    targetType: 'authorisation',
    targetId: null,
    details: { errorCode: event.errorCode },
    at: new Date().toISOString(),
  });
};

const currentKey = async (): Promise<HashKeyMaterial | null> => null;
const keyFor = async (): Promise<string | null> => null;

const dispatchAwareness = createAwarenessDispatcher({
  repositories,
  audit: auditRepository,
  trail,
  liveSegment: async () => ({ status: 'ISSUE_UNAVAILABLE' }),
  currentKey,
  keyFor,
  now: () => new Date().toISOString(),
  timeZone: null,
  resolveRoles: async () => [],
  recordAudit,
});

const handlers: Definition = {
  knewwhenShell: (request) => shellStatus(request.payload, request.context as PlatformContext),
  async knewwhenAwareness(request) {
    const payload: AwarenessPayload = request.payload ?? {};
    const context = request.context as PlatformContext;
    return dispatchAwareness(payload.action, payload.payload, {
      accountId: readString(context['accountId']),
      canBrowseResource: false,
    });
  },
  async knewwhenOperations() {
    // No approved runtime scan/write-back ports exist yet. Fail closed rather
    // than expose an unauthorised or hardcoded operation (I-11, §10.2).
    return {
      data: null,
      roleHint: 'UNKNOWN',
      correlationId: globalThis.crypto.randomUUID(),
      code: 'NOT_FOUND',
    } satisfies ResolverEnvelope<null>;
  },
};

export const resolverHandler = makeResolver(handlers);
