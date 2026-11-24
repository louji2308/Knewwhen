/**
 * IF-6 — Jira client and the five-operation write allow-list (Arch §12, §13.2).
 * Pinned by P2.D2. Pure contract: no Forge import, no record text, no behaviour.
 * All Jira traffic in the finished app goes through one client implementing this.
 */

/** Exactly five writes are permitted. A sixth is a permission change (§7.4). */
export const JIRA_WRITE_OPERATIONS = Object.freeze([
  'SET_ISSUE_PROPERTY',
  'SET_COMMENT_PROPERTY',
  'ADD_COMMENT',
  'ADD_LABEL',
  'CREATE_ISSUE',
] as const);

export type JiraWriteOperation = (typeof JIRA_WRITE_OPERATIONS)[number];

/** Budget classes (plan §11 P2.B1) preserve headroom for interactive calls. */
export const BUDGET_CLASSES = Object.freeze([
  'panel',
  'lookback',
  'scan',
  'sweep',
  'writeback',
] as const);

export type BudgetClass = (typeof BUDGET_CLASSES)[number];

/** Typed failure classification; no free-text error is part of the contract. */
export const JIRA_ERROR_CLASSES = Object.freeze(['transient', 'permanent', 'auth'] as const);

export type JiraErrorClass = (typeof JIRA_ERROR_CLASSES)[number];

/** Identity is explicit at the client boundary: as the viewing user or as app. */
export type JiraIdentity =
  { readonly kind: 'user'; readonly accountId: string } | { readonly kind: 'app' };

/**
 * A call descriptor carries resource identifiers and codes only. Record text
 * is never a field: comment bodies cross the boundary through a write adapter
 * that is audited separately, and are never logged (I-6).
 */
export interface JiraCallDescriptor {
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly resource: string;
  readonly params?: Readonly<Record<string, string>>;
}

/** The single client interface (IF-6). Descriptors are validated by the adapter. */
export interface JiraClient {
  call(
    descriptor: JiraCallDescriptor,
    identity: JiraIdentity,
    budgetClass: BudgetClass,
    timeoutMs: number,
  ): Promise<unknown>;
}
