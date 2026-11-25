/**
 * P2.D1 — the single authorisation gate and handler registry (IF-7, Arch §13.3).
 * Deny by default. Identity and the browse result come from the platform; roles
 * are resolved server-side for each request and are never accepted from a
 * caller (I-4). Audit events carry codes and the caller's account id as a
 * structured actor field, never inside message or details text (I-6, I-8).
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
  /** Structured actor field from GateContext only; never copied from payload. */
  readonly actorAccountId?: string;
}

export type AuditSink = (event: AuditEvent) => Promise<void>;

const registered = new Set<string>(HANDLER_ACTIONS);

/** A resolver handler may exist only if it is in the matrix (deny by default). */
export function isRegisteredHandler(action: Action | string): boolean {
  return registered.has(String(action));
}

/** Raw platform invocation fields. Any extra `roles` claim is discarded. */
export interface PlatformInvocation {
  readonly accountId: string;
  readonly canBrowseResource: boolean;
  readonly roles?: readonly Role[];
}

/** Build the gate context from platform facts alone; never copy a role claim. */
export function contextFromPlatform(invocation: PlatformInvocation): GateContext {
  return {
    accountId: invocation.accountId,
    canBrowseResource: invocation.canBrowseResource,
  };
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
    if (audit) {
      const actorAccountId = context.accountId || null;
      await audit({
        actionCode: String(action),
        errorCode: code,
        ...(actorAccountId === null ? {} : { actorAccountId }),
      });
    }
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

/**
 * A handler receives the gate's allow decision, never a client-supplied role.
 * The second argument is the authoritative server-side role for this call.
 */
export type GatedHandler = (
  context: GateContext,
  decision: Extract<GateDecision, { readonly allow: true }>,
  payload: unknown,
) => Promise<unknown>;
export type HandlerRegistry = Readonly<Record<Action, GatedHandler>>;

/** Matrix FK: the handler list and the role matrix must not drift apart. */
export function assertRegistryMatchesMatrix(
  registry: Readonly<Record<string, GatedHandler>>,
): void {
  const actual = Object.keys(registry).sort();
  const expected = [...HANDLER_ACTIONS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error('REGISTRY_MATRIX_MISMATCH');
  }
}

export interface GateOutcome {
  readonly decision: GateDecision;
  readonly result?: unknown;
}

/**
 * The only way to call a resolver handler: construct the gate from a complete
 * registry, then dispatch through the decision. An unregistered action cannot
 * be constructed or dispatched.
 */
export function createGate(
  registry: HandlerRegistry,
  resolveRoles: RoleResolver,
  audit?: AuditSink,
): {
  dispatch(action: Action, context: GateContext, payload?: unknown): Promise<GateOutcome>;
} {
  assertRegistryMatchesMatrix(registry);
  return {
    async dispatch(action, context, payload = null) {
      const decision = await decide(context, action, resolveRoles, audit);
      if (!decision.allow) return { decision };
      return { decision, result: await registry[action](context, decision, payload) };
    },
  };
}
