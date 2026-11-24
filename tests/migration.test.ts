import { describe, expect, it, vi } from 'vitest';
import { runEmptyMigration, type MigrationRunner } from '../src/handlers/migration';

describe('P1.B2 first empty SQL migration (Arch §3.2, I-7, I-8)', () => {
  it('runs the official runner exactly once and reports zero applied DDL operations', async () => {
    const run = vi.fn().mockResolvedValue([]);
    const runner: MigrationRunner = { run };
    const outcome = await runEmptyMigration(runner);
    expect(run).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ status: 'migration-ok', applied: 0 });
  });

  it('propagates a runner failure instead of masking it (AGENTS §17.1)', async () => {
    const runner: MigrationRunner = { run: () => Promise.reject(new Error('DDL_FAILED')) };
    await expect(runEmptyMigration(runner)).rejects.toThrow('DDL_FAILED');
  });

  it('never returns runner text, only a count (I-6)', async () => {
    const runner: MigrationRunner = { run: () => Promise.resolve(['canary-record-text']) };
    const outcome = await runEmptyMigration(runner);
    expect(JSON.stringify(outcome)).not.toContain('canary-record-text');
  });
});
