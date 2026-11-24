/**
 * P2.C2 — the single append-only audit() function (Arch §12, §5.3). Every
 * service calls this, never the audit_event table directly. The repository
 * interface exposes INSERT only: no update or delete path exists (I-8).
 *
 * Details carry codes, ids, counts and timestamps only — never record text,
 * quotes, model I/O or secrets. The guard rejects unsafe fields and canary
 * probes before any write (I-6), and no value is logged.
 */

import { canaryScan } from '../contracts/canary';

export interface AuditInput {
  readonly actorType: 'USER' | 'APP' | 'SYSTEM';
  readonly actorAccountId: string | null;
  readonly actionCode: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly details: Readonly<Record<string, string | number>>;
  readonly at: string;
}

export interface AuditStoredEvent {
  readonly id: string;
  readonly actorType: string;
  readonly actorAccountId: string | null;
  readonly actionCode: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly at: string;
  readonly detailsJson: string;
}

/** INSERT-only by design; a repository cannot be built with update/delete. */
export interface AuditRepository {
  insert(event: AuditStoredEvent): Promise<void>;
}

const FORBIDDEN_FIELDS = new Set([
  'text',
  'body',
  'quote',
  'summary',
  'description',
  'comment',
  'recordtext',
  'modelio',
]);

/** Validate before writing; throw typed codes, never echo the offending value. */
export function guardDetails(details: Readonly<Record<string, string | number>>): void {
  for (const [key, value] of Object.entries(details)) {
    if (FORBIDDEN_FIELDS.has(key.toLowerCase())) throw new Error('AUDIT_FIELD');
    if (canaryScan(String(value))) throw new Error('AUDIT_LEAK');
  }
}

/**
 * Append one audit event. `id` is generated here with the built-in UUID so the
 * single-writer rule is not broken by callers supplying ids.
 */
export async function audit(
  repository: AuditRepository,
  input: AuditInput,
  id: string = globalThis.crypto.randomUUID(),
): Promise<void> {
  if (!input.actionCode) throw new Error('AUDIT_INVALID');
  guardDetails(input.details);
  await repository.insert({
    id,
    actorType: input.actorType,
    actorAccountId: input.actorAccountId,
    actionCode: input.actionCode,
    targetType: input.targetType,
    targetId: input.targetId,
    at: input.at,
    detailsJson: JSON.stringify(input.details),
  });
}
