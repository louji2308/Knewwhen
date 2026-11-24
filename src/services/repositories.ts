/**
 * P2.A2 — one owning repository per Core table (Arch §12). Every table has
 * exactly one owner; no other service builds SQL for it.
 *
 * Idempotency uses read-after-write because upsert is Unresolved (PF-DB-3):
 * read by the table's key, insert only when absent, and if a competing insert
 * wins, adopt the winner rather than regenerating or overwriting. No transaction
 * is assumed (PF-DB-5). Every parameter is canary-scanned before binding (I-6).
 */

import { canaryScan } from '../contracts/canary';
import {
  CORE_TABLE_KEYS,
  CORE_TABLE_NAMES,
  deleteQuery,
  insertQuery,
  isDuplicateKeyError,
  selectQuery,
  updateQuery,
  type CoreTable,
  type QuerySpec,
  type SqlPort,
  type SqlResponse,
  type SqlRow,
  type TableKeys,
} from './sql';

export interface InsertOutcome {
  readonly inserted: boolean;
  readonly row: SqlRow;
}

export interface TableRepository {
  insert(row: SqlRow): Promise<InsertOutcome>;
  findBy(where: SqlRow): Promise<readonly SqlRow[]>;
  updateWhere(set: SqlRow, where: SqlRow): Promise<number>;
  deleteWhere(where: SqlRow): Promise<number>;
}

export type Repositories = Readonly<Record<CoreTable, TableRepository>>;

/** Guard every value that would become a bound SQL parameter. */
function execute(port: SqlPort, spec: QuerySpec): Promise<SqlResponse> {
  for (const value of spec.values) {
    if (value !== null && canaryScan(String(value))) throw new Error('SQL_CANARY');
  }
  return port
    .prepare(spec.sql)
    .bindParams(...spec.values)
    .execute();
}

function keyOf(keys: TableKeys, row: SqlRow): SqlRow {
  const key: Record<string, SqlRow[string]> = {};
  for (const column of keys.primary) {
    const value = row[column];
    if (value === undefined || value === null) throw new Error('SQL_KEY_REQUIRED');
    key[column] = value;
  }
  return key;
}

function createRepository(port: SqlPort, table: CoreTable, keys: TableKeys): TableRepository {
  const findBy = async (where: SqlRow): Promise<readonly SqlRow[]> =>
    (await execute(port, selectQuery(table, where))).rows;

  return {
    async insert(row) {
      const key = keyOf(keys, row);
      const existing = await findBy(key);
      if (existing.length > 0) return { inserted: false, row: existing[0]! };
      try {
        await execute(port, insertQuery(table, row));
        return { inserted: true, row };
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        const winner = await findBy(key);
        if (winner.length === 0) throw error;
        return { inserted: false, row: winner[0]! };
      }
    },
    findBy,
    async updateWhere(set, where) {
      return (await execute(port, updateQuery(table, set, where))).affectedRows;
    },
    async deleteWhere(where) {
      return (await execute(port, deleteQuery(table, where))).affectedRows;
    },
  };
}

/** The complete set of table owners, keyed by the exact Core table name. */
export function createRepositories(port: SqlPort): Repositories {
  const owners = {} as Record<CoreTable, TableRepository>;
  for (const table of CORE_TABLE_NAMES) {
    owners[table] = createRepository(port, table, CORE_TABLE_KEYS[table]);
  }
  return owners;
}
