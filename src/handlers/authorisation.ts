/**
 * P2.D1 — the single authorisation gate (IF-7, Arch §13.3). Deny by default.
 * Roles are resolved server-side for each request; identity and roles come
 * from platform context, never from a request payload (I-4). Audit events
 * carry only codes, never account ids as text (I-6).
 */

import {
  HANDLER_ACTIONS,
  ROLE_MATRIX,
  type Action,
  type GateContext,
  type GateDecision,
  type Role,
} from '../contracts/authorisation';

export type RoleResolver = (context: GateContext) => Promise<readonly Role[]>;

export interface AuditEvent {
  readonly actionCode: string;
  readonly errorCode: string;
}

export type AuditSink = (event: AuditEvent) => Promise<void>;

const registered = new Set<string>(HANDLER_ACTIONS);

/** A resolver handler may exist only if it is in the matrix (deny by default). */
export function isRegisteredHandler(action: Action | string): boolean {
  return registered.has(String(action));
}

/**
 * Decide one action. Any failure in role resolution, any absent role and any
 * browse denial returns deny. Denials are audited with codes only.
 */
export async function decide(
  context: GateContext,
  action: Action,
  resolveRoles: RoleResolver,
  audit?: AuditSink,
): Promise<GateDecision> {
  const deny = async (code: 'DENIED' | 'DEPENDENCY_FAILED'): Promise<GateDecision> => {
    if (audit) await audit({ actionCode: String(action), errorCode: code });
    return { allow: false, code };
  };

  if (!isRegisteredHandler(action) || !context.canBrowseResource || !context.accountId) {
    return deny('DENIED');
  }

  let roles: readonly Role[];
  try {
    roles = await resolveRoles(context);
  } catch {
    return deny('DEPENDENCY_FAILED');
  }

  const granted = ROLE_MATRIX[action] ?? [];
  const role = roles.find((candidate) => granted.includes(candidate));
  if (!role) return deny('DENIED');
  return { allow: true, role };
}
