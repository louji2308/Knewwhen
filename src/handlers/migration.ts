/**
 * P1.B2 — first, empty Forge SQL migration. The official @forge/sql runner is
 * injected at the adapter boundary so this handler stays pure and testable.
 *
 * No DDL operations are enqueued in P1: run() provisions the platform's
 * migration-tracking table and verifies database access before any schema is
 * designed (I-7, AGENTS §5.5). Retry logic is unnecessary with zero DDL
 * operations because the per-install DDL rate limit cannot be reached.
 */
export interface MigrationRunner {
  run(): Promise<readonly unknown[]>;
}

export interface MigrationOutcome {
  readonly status: 'migration-ok';
  readonly applied: number;
}

export async function runEmptyMigration(runner: MigrationRunner): Promise<MigrationOutcome> {
  const applied = await runner.run();
  return { status: 'migration-ok', applied: applied.length };
}
