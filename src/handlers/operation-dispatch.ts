/**
 * P9 — the only entry point for the four operation actions. It reuses the same
 * twelve-action gate and registry as the Awareness slice, then narrows the
 * client's action choice to scan, retry, deadlines and decision. An action
 * outside this slice never reaches a handler (I-4, I-11, Arch §13.3).
 */

import type { GateContext } from '../contracts/authorisation';
import type { ResolverEnvelope } from '../contracts/envelope';
import type { AwarenessDependencies } from './awareness';
import { createGate } from './authorisation';
import type { DecisionDependencies } from './decision';
import type { OperationDependencies } from './operations';
import { createHandlerRegistry } from './registry';

export const OPERATION_ACTIONS = Object.freeze([
  'MANUAL_SCAN',
  'RETRY_WRITEBACK',
  'COMPUTE_DEADLINES',
  'DECIDE',
] as const);

export type OperationAction = (typeof OPERATION_ACTIONS)[number];

export function isOperationAction(value: unknown): value is OperationAction {
  return typeof value === 'string' && OPERATION_ACTIONS.some((action) => action === value);
}

export interface OperationDispatcherDependencies {
  readonly awareness: AwarenessDependencies;
  readonly operations?: OperationDependencies;
  readonly decisions?: DecisionDependencies;
}

function envelope(code: ResolverEnvelope<null>['code']): ResolverEnvelope<null> {
  return {
    data: null,
    roleHint: 'UNKNOWN',
    correlationId: globalThis.crypto.randomUUID(),
    code,
  };
}

/** Build the dispatcher from the frozen matrix, not from a second action list. */
export function createOperationDispatcher(
  deps: OperationDispatcherDependencies,
): (action: unknown, payload: unknown, context: GateContext) => Promise<ResolverEnvelope<unknown>> {
  const gate = createGate(
    createHandlerRegistry(deps.awareness, deps.operations, deps.decisions),
    deps.awareness.resolveRoles,
    deps.awareness.recordAudit,
  );
  return async (action, payload, context) => {
    if (!isOperationAction(action)) return envelope('NOT_PERMITTED');
    const outcome = await gate.dispatch(action, context, payload);
    if (!outcome.decision.allow) {
      return envelope(
        outcome.decision.code === 'DEPENDENCY_FAILED' ? 'DEPENDENCY_FAILED' : 'NOT_PERMITTED',
      );
    }
    return outcome.result as ResolverEnvelope<unknown>;
  };
}
