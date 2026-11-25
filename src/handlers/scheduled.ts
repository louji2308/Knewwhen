/**
 * P10.B2 — daily scheduled assembly (N-01(c), Arch §15.2).
 *
 * Pure: no @forge/* import. The adapter injects the migration runner, the
 * reconciler and the observation time; this module only fixes their order.
 * Migration always runs first and its failure is never masked (AGENTS §17.1).
 * The reconciler runs only when injected; the P10.B3 personal-data cycle is
 * Blocked on U-5 and is deliberately not wired here.
 */

import type { ReconcilerResult } from '../services/reconciler';
import type { MigrationOutcome } from './migration';

export type MigrationRun = () => Promise<MigrationOutcome>;
export type ReconcilerRun = (nowISO: string) => Promise<ReconcilerResult>;

export interface ScheduledOutcome {
  readonly migration: MigrationOutcome;
  readonly reconciler: ReconcilerResult | null;
}

/** Rebuild the allow-listed shape so an injected runner cannot echo free text. */
function migrationCounts(outcome: MigrationOutcome): MigrationOutcome {
  const { status, applied } = outcome;
  const operations =
    'operations' in outcome && typeof outcome.operations === 'number'
      ? { operations: outcome.operations }
      : {};
  return { status, applied, ...operations };
}

export function runScheduled(migration: MigrationRun, nowISO?: string): Promise<ScheduledOutcome>;
export function runScheduled(
  migration: MigrationRun,
  reconciler: ReconcilerRun | null | undefined,
  nowISO?: string,
): Promise<ScheduledOutcome>;
export async function runScheduled(
  migration: MigrationRun,
  reconcilerOrNowISO?: ReconcilerRun | string | null,
  nowISO = '',
): Promise<ScheduledOutcome> {
  const performed = await migration();
  const migrationOutcome = migrationCounts(performed);
  const reconciler = typeof reconcilerOrNowISO === 'function' ? reconcilerOrNowISO : null;
  const observedAt = typeof reconcilerOrNowISO === 'string' ? reconcilerOrNowISO : nowISO;
  if (!reconciler) return { migration: migrationOutcome, reconciler: null };
  const reconcilerOutcome = await reconciler(observedAt);
  return { migration: migrationOutcome, reconciler: reconcilerOutcome };
}
