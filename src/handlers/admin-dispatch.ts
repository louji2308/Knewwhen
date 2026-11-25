/**
 * P10 — the single gated entry point for the admin resolver action. It reuses
 * the frozen twelve-action matrix: a payload can choose an admin sub-action,
 * but it cannot choose a role, an action outside the matrix or a second gate.
 */

import {
  HANDLER_ACTIONS,
  type Action,
  type GateContext,
  type Role,
} from '../contracts/authorisation';
import type { ResolverEnvelope } from '../contracts/envelope';
import type { AdminSettingsStore } from '../services/admin-settings';
import {
  createGate,
  type AuditSink,
  type GatedHandler,
  type HandlerRegistry,
  type RoleResolver,
} from './authorisation';
import { createAdminHandlers, type AdminHandlerDependencies } from './admin';

export const ADMIN_ACTION: Action = 'ADMIN_SETTINGS';

export function isAdminAction(value: unknown): boolean {
  return value === ADMIN_ACTION;
}

export interface AdminDispatcherDependencies extends AdminHandlerDependencies {
  readonly resolveRoles: RoleResolver;
  readonly recordAudit: AuditSink;
}

function unavailable(): GatedHandler {
  return async (_context, decision) =>
    ({
      data: null,
      roleHint: decision.role,
      correlationId: globalThis.crypto.randomUUID(),
      code: 'NOT_FOUND',
    }) satisfies ResolverEnvelope<null>;
}

function envelope(code: ResolverEnvelope<null>['code'], role: string): ResolverEnvelope<null> {
  return {
    data: null,
    roleHint: role,
    correlationId: globalThis.crypto.randomUUID(),
    code,
  };
}

/** Build a complete matrix registry with only the injected admin handler live. */
export function createAdminDispatcher(
  deps: AdminDispatcherDependencies,
): (action: unknown, payload: unknown, context: GateContext) => Promise<ResolverEnvelope<unknown>> {
  const admin = createAdminHandlers({
    ...(deps.settingsStore === undefined ? {} : { settingsStore: deps.settingsStore }),
    ...(deps.loadSample === undefined ? {} : { loadSample: deps.loadSample }),
    ...(deps.health === undefined ? {} : { health: deps.health }),
    ...(deps.recordAudit === undefined ? {} : { recordAudit: deps.recordAudit }),
  });
  const missing = unavailable();
  const registry = Object.fromEntries(
    HANDLER_ACTIONS.map((action) => [action, admin[action] ?? missing]),
  ) as unknown as HandlerRegistry;
  const gate = createGate(registry, deps.resolveRoles, deps.recordAudit);

  return async (action, payload, context) => {
    if (!isAdminAction(action)) return envelope('NOT_PERMITTED', 'UNKNOWN');
    const outcome = await gate.dispatch(ADMIN_ACTION, context, payload);
    const role = 'role' in outcome.decision ? outcome.decision.role : 'UNKNOWN';
    if (!outcome.decision.allow) {
      return envelope(
        outcome.decision.code === 'DEPENDENCY_FAILED' ? 'DEPENDENCY_FAILED' : 'NOT_PERMITTED',
        role,
      );
    }
    return outcome.result as ResolverEnvelope<unknown>;
  };
}

export type { AdminSettingsStore, Role };
