import { describe, expect, it } from 'vitest';
import { CANARY_TOKENS } from '../src/contracts/canary';
import type { MigrationOutcome } from '../src/handlers/migration';
import { runScheduled, type ScheduledOutcome } from '../src/handlers/scheduled';
import type { ReconcilerResult } from '../src/services/reconciler';

const NOW = '2026-11-25T09:00:00.000Z';

function migrationOutcome(applied = 3): MigrationOutcome {
  return { status: 'migration-ok', applied };
}

function reconcilerResult(): ReconcilerResult {
  return {
    status: 'OK',
    cursor: '1003',
    counts: {
      issuesSwept: 3,
      stalledScans: 2,
      openCases: 2,
      missingWritebacks: 2,
      writebacksRetried: 2,
      countersPruned: 2,
      errors: 0,
    },
    errorCodes: [],
  };
}

describe('P10.B2 scheduled assembly (N-01(c), Arch §15.2)', () => {
  it('always runs migration first, then the injected reconciler', async () => {
    const order: string[] = [];
    const migration = async (): Promise<MigrationOutcome> => {
      order.push('migration');
      return migrationOutcome();
    };
    const reconciler = async (): Promise<ReconcilerResult> => {
      order.push('reconciler');
      return reconcilerResult();
    };

    const outcome = await runScheduled(migration, reconciler, NOW);

    expect(order).toEqual(['migration', 'reconciler']);
    expect(outcome.migration).toEqual({ status: 'migration-ok', applied: 3 });
    expect(outcome.reconciler).toEqual(reconcilerResult());
  });

  it('runs migration and returns reconciler: null when no reconciler is injected', async () => {
    let called = 0;
    const migration = async (): Promise<MigrationOutcome> => {
      called += 1;
      return migrationOutcome(0);
    };

    const outcome = await runScheduled(migration, undefined, NOW);

    expect(called).toBe(1);
    expect(outcome).toEqual({
      migration: { status: 'migration-ok', applied: 0 },
      reconciler: null,
    });
  });

  it('accepts the two-argument call shape with no reconciler', async () => {
    const outcome = await runScheduled(async () => migrationOutcome(1), NOW);
    expect(outcome.reconciler).toBeNull();
    expect(outcome.migration.applied).toBe(1);
  });

  it('forwards the injected observation time unchanged to the reconciler', async () => {
    let observed = '';
    const reconciler = async (nowISO: string): Promise<ReconcilerResult> => {
      observed = nowISO;
      return reconcilerResult();
    };
    await runScheduled(async () => migrationOutcome(), reconciler, NOW);
    expect(observed).toBe(NOW);
  });

  it('propagates a migration failure without starting the reconciler', async () => {
    let reconcilerCalled = false;
    const migration = async (): Promise<MigrationOutcome> => {
      throw new Error('MIGRATION_DOWN');
    };
    const reconciler = async (): Promise<ReconcilerResult> => {
      reconcilerCalled = true;
      return reconcilerResult();
    };

    await expect(runScheduled(migration, reconciler, NOW)).rejects.toThrow('MIGRATION_DOWN');
    expect(reconcilerCalled).toBe(false);
  });

  it('does not mask a reconciler failure after migration has run (AGENTS §17.1)', async () => {
    const order: string[] = [];
    const migration = async (): Promise<MigrationOutcome> => {
      order.push('migration');
      return migrationOutcome();
    };
    const reconciler = async (): Promise<ReconcilerResult> => {
      order.push('reconciler');
      throw new Error('RECONCILER_DOWN');
    };

    await expect(runScheduled(migration, reconciler, NOW)).rejects.toThrow('RECONCILER_DOWN');
    expect(order).toEqual(['migration', 'reconciler']);
  });

  it('carries counts and codes only: no free text or canary in the outcome (N-04, I-6)', async () => {
    // An unsafe caller may attach text to the migration outcome; the assembly
    // must not echo it into its typed result.
    const unsafeMigration = async () =>
      ({
        ...migrationOutcome(2),
        note: CANARY_TOKENS[0]!,
      }) as MigrationOutcome;
    const outcome: ScheduledOutcome = await runScheduled(
      unsafeMigration,
      async () => reconcilerResult(),
      NOW,
    );

    const json = JSON.stringify(outcome);
    for (const token of CANARY_TOKENS) expect(json).not.toContain(token);
    expect(Object.keys(outcome).sort()).toEqual(['migration', 'reconciler']);
    expect(Object.keys(outcome.migration).sort()).toEqual(['applied', 'status']);
    expect(outcome.migration.applied).toBe(2);
  });
});
