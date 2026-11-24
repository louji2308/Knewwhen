import { migrationRunner } from '@forge/sql';
import { runCoreMigration, type CoreMigrationOutcome } from '../handlers/migration';

/**
 * The only runtime bridge to @forge/sql. P2.A1 enqueues the 14 Core tables and
 * runs the official migration runner; it is idempotent by operation name.
 */
export async function runSchemaMigration(): Promise<CoreMigrationOutcome> {
  return runCoreMigration(migrationRunner);
}
