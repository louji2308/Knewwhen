/**
 * P2.C1 — settings validation and audit (Arch §12, C-10.2/4, N-04(b), I-6).
 * Pure: KVS persistence is a later adapter. Rejects unsafe combinations and
 * first-run states that would silently block case actions (AGENTS §5.5).
 */

import type { AuditEvent } from '../handlers/authorisation';

export interface SettingsV1 {
  readonly version: 1;
  readonly watchedProjects: readonly string[];
  readonly reviewerRoles: readonly string[];
  readonly qualifiedRoles: readonly string[];
  readonly writeBackEnabled: boolean;
  readonly visibilityChosen: boolean;
  readonly aiEnabled: boolean;
  readonly killSwitch: boolean;
}

export type ValidationCode =
  'OK' | 'WRITE_BACK_NO_VISIBILITY' | 'NO_WATCHED_PROJECT' | 'BAD_VERSION';

export type ValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly code: ValidationCode };

export function validateSettings(settings: SettingsV1): ValidationResult {
  if (settings.version !== 1) return { ok: false, code: 'BAD_VERSION' };
  if (settings.watchedProjects.length === 0) return { ok: false, code: 'NO_WATCHED_PROJECT' };
  // Empty roles are the valid first-run state (Arch §13.1); the authorisation
  // gate blocks case actions until an admin adds roles. Settings must accept it.
  if (settings.writeBackEnabled && !settings.visibilityChosen) {
    return { ok: false, code: 'WRITE_BACK_NO_VISIBILITY' };
  }
  return { ok: true };
}

/**
 * Emit one audit event with a change code only. Values, group names and any
 * record text are never included (G-5, I-6). The comparison inspects booleans
 * but serialises only a fixed code vocabulary.
 */
export function auditSettingsChange(
  before: SettingsV1,
  after: SettingsV1,
  sink: (event: AuditEvent) => void,
): void {
  const codes: string[] = [];
  if (before.writeBackEnabled !== after.writeBackEnabled) codes.push('WRITE_BACK');
  if (before.visibilityChosen !== after.visibilityChosen) codes.push('VISIBILITY');
  if (before.aiEnabled !== after.aiEnabled) codes.push('AI_ENABLED');
  if (before.killSwitch !== after.killSwitch) codes.push('KILL_SWITCH');
  if (before.watchedProjects.length !== after.watchedProjects.length) codes.push('PROJECTS');
  if (before.reviewerRoles.length !== after.reviewerRoles.length) codes.push('REVIEWER_ROLES');
  if (before.qualifiedRoles.length !== after.qualifiedRoles.length) codes.push('QUALIFIED_ROLES');
  sink({
    actionCode: 'SETTINGS_CHANGED',
    errorCode: codes.join('|') || 'NO_OP',
  });
}
