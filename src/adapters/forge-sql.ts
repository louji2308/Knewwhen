import { migrationRunner } from '@forge/sql';
import { runEmptyMigration, type MigrationOutcome } from '../handlers/migration';

/**
 * P1.B2 — the only runtime bridge to @forge/sql. The shared runner has zero
 * enqueued migrations in P1, so run() creates the platform tracking table only.
 */
export async function runSchemaMigration(): Promise<MigrationOutcome> {
  return runEmptyMigration(migrationRunner);
}
