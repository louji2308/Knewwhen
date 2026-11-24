/**
 * The single handler registry. Every matrix action must have exactly one
 * handler; actions for later phases return an honest NOT_FOUND envelope rather
 * than a hidden demo path or an implicit fail-open (Arch §13.3, I-11).
 */

import { HANDLER_ACTIONS, type Action } from '../contracts/authorisation';
import type { AwarenessRoleHint } from '../contracts/awareness';
import type { ResolverEnvelope } from '../contracts/envelope';
import {
  assertRegistryMatchesMatrix,
  type GatedHandler,
  type HandlerRegistry,
} from './authorisation';
import { createAwarenessHandlers, type AwarenessDependencies } from './awareness';
import { createDecisionHandlers, type DecisionDependencies } from './decision';
import { createOperationHandlers } from './operations';

function unavailable(): GatedHandler {
  return async (_context, decision) =>
    ({
      data: null,
      roleHint: decision.role as AwarenessRoleHint,
      correlationId: globalThis.crypto.randomUUID(),
      code: 'NOT_FOUND',
    }) satisfies ResolverEnvelope<null>;
}

export function createHandlerRegistry(
  deps: AwarenessDependencies,
  operationDeps?: Parameters<typeof createOperationHandlers>[0],
  decisionDeps?: DecisionDependencies,
): HandlerRegistry {
  const awareness = createAwarenessHandlers(deps);
  const operations = createOperationHandlers(operationDeps ?? { now: () => deps.now() });
  const decisions = createDecisionHandlers(decisionDeps ?? { now: () => deps.now() });
  const missing = unavailable();
  const registry = Object.fromEntries(
    HANDLER_ACTIONS.map((action) => [
      action,
      awareness[action as Action] ??
        operations[action as Action] ??
        decisions[action as keyof typeof decisions] ??
        missing,
    ]),
  ) as unknown as HandlerRegistry;
  assertRegistryMatchesMatrix(registry);
  return registry;
}
