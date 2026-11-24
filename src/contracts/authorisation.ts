/**
 * IF-7 — authorisation gate and handler registry (Arch §13.3). Pinned by P2.D2.
 * Pure contract: the role matrix is transcribed from Architecture §13.3.
 * Identity always comes from platform context; a client never supplies a role.
 */

export const ROLES = Object.freeze([
  'VIEWER',
  'REVIEWER',
  'QUALIFIED_PERSON',
  'SITE_ADMIN',
] as const);

export type Role = (typeof ROLES)[number];

/** The twelve gated actions. Every registered resolver handler is one of these. */
export const ACTIONS = Object.freeze([
  'SEE_SIGNAL',
  'ROUTE_TO_COMPLAINT_UNIT',
  'MANUAL_SCAN',
  'VIEW_CASE',
  'RUN_LOOKBACK',
  'ENTER_RECEIPT_DATE',
  'CONFIRM_SAME_EVENT',
  'CONFIRM_TRAIL_ENTRY',
  'COMPUTE_DEADLINES',
  'DECIDE',
  'RETRY_WRITEBACK',
  'ADMIN_SETTINGS',
] as const);

export type Action = (typeof ACTIONS)[number];

/** Deny by default: an action absent from this map has no permitted roles. */
export const ROLE_MATRIX: Readonly<Record<Action, readonly Role[]>> = Object.freeze({
  SEE_SIGNAL: ['VIEWER', 'REVIEWER', 'QUALIFIED_PERSON', 'SITE_ADMIN'],
  ROUTE_TO_COMPLAINT_UNIT: ['VIEWER', 'REVIEWER', 'QUALIFIED_PERSON', 'SITE_ADMIN'],
  MANUAL_SCAN: ['REVIEWER', 'QUALIFIED_PERSON'],
  VIEW_CASE: ['REVIEWER', 'QUALIFIED_PERSON'],
  RUN_LOOKBACK: ['REVIEWER', 'QUALIFIED_PERSON'],
  ENTER_RECEIPT_DATE: ['REVIEWER', 'QUALIFIED_PERSON'],
  CONFIRM_SAME_EVENT: ['QUALIFIED_PERSON'],
  CONFIRM_TRAIL_ENTRY: ['QUALIFIED_PERSON'],
  COMPUTE_DEADLINES: ['REVIEWER', 'QUALIFIED_PERSON'],
  DECIDE: ['QUALIFIED_PERSON'],
  RETRY_WRITEBACK: ['REVIEWER', 'QUALIFIED_PERSON'],
  ADMIN_SETTINGS: ['SITE_ADMIN'],
});

/**
 * The handler registry must list exactly the matrix actions (plan §11 P2.D1).
 * Kept as a separate constant so a test can assert the two never drift apart.
 */
export const HANDLER_ACTIONS = Object.freeze([...ACTIONS]);

export type GateDecision =
  | { readonly allow: true; readonly role: Role }
  | { readonly allow: false; readonly code: 'DENIED' | 'DEPENDENCY_FAILED' };

/**
 * Platform context only. A request payload must never supply a role or identity.
 * Roles are deliberately absent: they are resolved fresh for every request by
 * the server-side RoleResolver. Keeping them out makes a spoofed role claim
 * unrepresentable at the gate boundary (Arch §13.3 steps 1 and 3, I-4).
 */
export interface GateContext {
  readonly accountId: string;
  readonly canBrowseResource: boolean;
}
