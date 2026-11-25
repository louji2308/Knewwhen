import { makeResolver, type Request } from '@forge/resolver';
import type { ShellModule, ShellStatus } from '../contracts/shell';
import type { ResolverEnvelope } from '../contracts/envelope';
import { createAdminDispatcher, isAdminAction } from '../handlers/admin-dispatch';
import type { AwarenessDependencies } from '../handlers/awareness';
import { createAwarenessDispatcher } from '../handlers/awareness-dispatch';
import type { AuditSink } from '../handlers/authorisation';
import type { DecisionDependencies } from '../handlers/decision';
import { createOperationDispatcher } from '../handlers/operation-dispatch';
import { shellStatus } from '../handlers/shell';
import { actorFromAuditEvent, audit, type AuditRepository } from '../services/audit';
import { computeDeadlines } from '../services/deadline';
import { createDecisionService } from '../services/decision';
import type { HashKeyMaterial } from '../services/hash-key';
import { createRepositories } from '../services/repositories';
import { createTrailService } from '../services/trail';
import { currentQuestionSet, runtimeRuleBundle } from './rule-data';
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
    ...actorFromAuditEvent(event),
    actionCode: event.actionCode,
    targetType: 'authorisation',
    targetId: null,
    details: { errorCode: event.errorCode },
    at: new Date().toISOString(),
  });
};

const currentKey = async (): Promise<HashKeyMaterial | null> => null;
const keyFor = async (): Promise<string | null> => null;
const now = (): string => new Date().toISOString();

const awarenessDependencies: AwarenessDependencies = {
  repositories,
  audit: auditRepository,
  trail,
  liveSegment: async () => ({ status: 'ISSUE_UNAVAILABLE' }),
  currentKey,
  keyFor,
  now,
  timeZone: null,
  resolveRoles: async () => [],
  recordAudit,
};
const dispatchAwareness = createAwarenessDispatcher(awarenessDependencies);

const questionSet = currentQuestionSet();
const decisionService =
  questionSet === null
    ? null
    : createDecisionService({
        repositories,
        questionSet,
        nowISO: now(),
        rulesStatus: questionSet.status,
      });
const ruleBundle = runtimeRuleBundle;
const computeDeadlinesPort =
  ruleBundle === null
    ? undefined
    : (
        input: Parameters<typeof computeDeadlines>[0],
        candidates: Parameters<typeof computeDeadlines>[1],
      ) => computeDeadlines(input, candidates, ruleBundle, repositories.deadline_calc);

const decisionDependencies: DecisionDependencies = {
  now,
  getQuestionSet: currentQuestionSet,
  ...(computeDeadlinesPort === undefined ? {} : { computeDeadlines: computeDeadlinesPort }),
  ...(decisionService === null
    ? {}
    : {
        startDraft: decisionService.startDraft,
        finalise: decisionService.finalise,
        supersede: decisionService.supersede,
      }),
};
const dispatchOperations = createOperationDispatcher({
  awareness: awarenessDependencies,
  operations: { now },
  decisions: decisionDependencies,
});
/**
 * P10 admin ports are not injected: no KVS settings store, Jira create-issue
 * adapter, health query port or reconciler port is approved in the locked
 * stack. The gate denies before any port is consulted, so the live resolver
 * returns honest NOT_PERMITTED, never a demo configuration or hidden sample
 * path (I-11). The no-port registry's NOT_FOUND is the intended state once
 * browse/role adapters are approved.
 */
const dispatchAdmin = createAdminDispatcher({
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
  async knewwhenOperations(request) {
    const payload: OperationsPayload = request.payload ?? {};
    const context = request.context as PlatformContext;
    const gateContext = {
      accountId: readString(context['accountId']),
      canBrowseResource: false,
    };
    if (isAdminAction(payload.action)) {
      return dispatchAdmin(payload.action, payload.payload, gateContext);
    }
    return dispatchOperations(payload.action, payload.payload, gateContext);
  },
};

export const resolverHandler = makeResolver(handlers);
