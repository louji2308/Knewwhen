/**
 * P5.D1 — the only entry point for client-aware Awareness calls. It narrows the
 * client's action choice to three trail actions and turns a gate decision into
 * an envelope. The authoritative role is resolved inside the gate; a payload
 * cannot supply it (I-4). No payload value is logged or echoed.
 */

import type { GateContext, GateDecision } from '../contracts/authorisation';
import type { ResolverEnvelope } from '../contracts/envelope';
import { createGate } from './authorisation';
import type { AwarenessDependencies } from './awareness';
import { createHandlerRegistry } from './registry';

export const AWARENESS_ACTIONS = Object.freeze([
  'VIEW_CASE',
  'ENTER_RECEIPT_DATE',
  'CONFIRM_TRAIL_ENTRY',
] as const);

export type AwarenessAction = (typeof AWARENESS_ACTIONS)[number];

export function isAwarenessAction(value: unknown): value is AwarenessAction {
  return typeof value === 'string' && AWARENESS_ACTIONS.some((action) => action === value);
}

function envelope(code: ResolverEnvelope<unknown>['code']): ResolverEnvelope<null> {
  return {
    data: null,
    roleHint: 'UNKNOWN',
    correlationId: globalThis.crypto.randomUUID(),
    code,
  };
}

function denial(
  decision: Extract<GateDecision, { readonly allow: false }>,
): ResolverEnvelope<null> {
  return envelope(decision.code === 'DEPENDENCY_FAILED' ? 'DEPENDENCY_FAILED' : 'NOT_PERMITTED');
}

/**
 * Build the dispatcher from exactly the twelve matrix handlers. Actions outside
 * the Awareness slice are unavailable here even though the gate knows them.
 */
export function createAwarenessDispatcher(
  deps: AwarenessDependencies,
): (action: unknown, payload: unknown, context: GateContext) => Promise<ResolverEnvelope<unknown>> {
  const gate = createGate(createHandlerRegistry(deps), deps.resolveRoles, deps.recordAudit);
  return async (action, payload, context) => {
    if (!isAwarenessAction(action)) return envelope('NOT_PERMITTED');
    const outcome = await gate.dispatch(action, context, payload);
    if (!outcome.decision.allow) return denial(outcome.decision);
    return outcome.result as ResolverEnvelope<unknown>;
  };
}
