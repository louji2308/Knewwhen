import { migrationRunner, sql } from '@forge/sql';
import { runCoreMigration, type CoreMigrationOutcome } from '../handlers/migration';
import type { SqlPort, SqlResponse, SqlRow, SqlStatement, SqlValue } from '../services/sql';

/**
 * The only runtime bridge to @forge/sql. P2.A1 enqueues the 14 Core tables and
 * runs the official migration runner; it is idempotent by operation name.
 */
export async function runSchemaMigration(): Promise<CoreMigrationOutcome> {
  return runCoreMigration(migrationRunner);
}

/**
 * P2.A2 — wrap the verified driver shape (`prepare().bindParams().execute()`)
 * in the pure SqlPort. For writes the driver returns an UpdateQueryResponse in
 * `rows` rather than an array (PF-DB-2); normalise it to affectedRows here.
 * No query text, parameter value or result is logged (I-6).
 */
export function createForgeSqlPort(): SqlPort {
  return {
    prepare(query: string): SqlStatement {
      const statement = sql.prepare(query);
      const wrapper: SqlStatement = {
        bindParams(...values: SqlValue[]): SqlStatement {
          statement.bindParams(...values);
          return wrapper;
        },
        async execute(): Promise<SqlResponse> {
          const result = (await statement.execute()) as { rows: unknown };
          if (Array.isArray(result.rows)) {
            return { rows: result.rows as SqlRow[], affectedRows: 0 };
          }
          const update = result.rows as { affectedRows?: number } | null | undefined;
          return { rows: [], affectedRows: update?.affectedRows ?? 0 };
        },
      };
      return wrapper;
    },
  };
}
