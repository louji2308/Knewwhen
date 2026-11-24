/**
 * P2.A2 — the SQL access port and parameterised query builders. Pure: no
 * @forge/* import; the real driver is wrapped in adapters/forge-sql.ts.
 *
 * Built from the Verified platform facts, not assumptions:
 *  - one parameter per `?`, values bound with bindParams (PF-DB-1);
 *  - UPDATE/DELETE expose affectedRows (PF-DB-2);
 *  - upsert is Unresolved, so idempotency is read-after-write (PF-DB-3);
 *  - one statement per call — semicolons are never query separators (PF-DB-5);
 *  - no foreign keys or cascades (PF-DB-4).
 *
 * Only the 14 frozen Core tables are addressable. Column identifiers are
 * validated; every value is a bound parameter, never interpolated.
 */

import { CORE_TABLE_MIGRATIONS } from '../handlers/migration';

/** Values that may be bound. Objects, dates and undefined are not acceptable. */
export type SqlValue = string | number | null;
export type SqlRow = Readonly<Record<string, SqlValue>>;

export interface SqlResponse {
  readonly rows: readonly SqlRow[];
  readonly affectedRows: number;
}

/** Mirrors @forge/sql: bindParams is chainable, execute returns the result. */
export interface SqlStatement {
  bindParams(...values: SqlValue[]): SqlStatement;
  execute(): Promise<SqlResponse>;
}

export interface SqlPort {
  prepare(query: string): SqlStatement;
}

export interface QuerySpec {
  readonly sql: string;
  readonly values: readonly SqlValue[];
}

export const CORE_TABLE_NAMES = Object.freeze([
  'review_case',
  'scan',
  'segment_state',
  'evidence_item',
  'trail_entry',
  'lookback_run',
  'candidate_match',
  'deadline_calc',
  'decision_record',
  'follow_up',
  'writeback_task',
  'audit_event',
  'usage_counter',
  'scan_lease',
  'writeback_attempt',
] as const);

export type CoreTable = (typeof CORE_TABLE_NAMES)[number];

const TABLE_SET: ReadonlySet<string> = new Set<string>(CORE_TABLE_NAMES);

/** PRIMARY and UNIQUE columns transcribed from Architecture §5.2/§5.3. */
export interface TableKeys {
  readonly primary: readonly string[];
  readonly unique: readonly (readonly string[])[];
}

export const CORE_TABLE_KEYS: Readonly<Record<CoreTable, TableKeys>> = Object.freeze({
  review_case: { primary: ['id'], unique: [['anchor_issue_id', 'case_seq']] },
  scan: { primary: ['id'], unique: [] },
  segment_state: { primary: ['issue_id', 'segment_key'], unique: [] },
  evidence_item: { primary: ['id'], unique: [] },
  trail_entry: { primary: ['id'], unique: [] },
  lookback_run: { primary: ['id'], unique: [] },
  candidate_match: {
    primary: ['id'],
    unique: [['case_id', 'candidate_issue_id', 'candidate_segment_key']],
  },
  deadline_calc: { primary: ['id'], unique: [] },
  decision_record: { primary: ['id'], unique: [['case_id', 'version']] },
  follow_up: { primary: ['id'], unique: [] },
  writeback_task: { primary: ['id'], unique: [['case_id', 'kind', 'dedupe_key']] },
  audit_event: { primary: ['id'], unique: [] },
  usage_counter: { primary: ['bucket', 'kind'], unique: [] },
  scan_lease: { primary: ['issue_id'], unique: [] },
  writeback_attempt: { primary: ['task_id'], unique: [] },
});

/** The table list must stay in step with the frozen migration DDL. */
export function ddlTableNames(): readonly string[] {
  return CORE_TABLE_MIGRATIONS.map(
    (operation) => /^CREATE TABLE IF NOT EXISTS ([a-z_]+)/.exec(operation.ddl)?.[1] ?? '',
  );
}

const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

function guardTable(table: string): void {
  if (!TABLE_SET.has(table)) throw new Error('SQL_UNKNOWN_TABLE');
}

function guardIdentifier(column: string): void {
  if (!IDENTIFIER.test(column)) throw new Error('SQL_IDENTIFIER');
}

function guardRow(row: SqlRow): readonly string[] {
  const columns = Object.keys(row);
  if (columns.length === 0) throw new Error('SQL_EMPTY_ROW');
  for (const column of columns) {
    guardIdentifier(column);
    const value = row[column];
    if (value !== null && typeof value !== 'string' && typeof value !== 'number') {
      throw new Error('SQL_VALUE');
    }
  }
  return columns;
}

function predicate(where: SqlRow): { text: string; values: readonly SqlValue[] } {
  const columns = Object.keys(where);
  if (columns.length === 0) throw new Error('SQL_WHERE_REQUIRED');
  for (const column of columns) guardIdentifier(column);
  const values: SqlValue[] = [];
  const parts = columns.map((column) => {
    const value = where[column] ?? null;
    if (value === null) return `${column} IS NULL`;
    values.push(value);
    return `${column} = ?`;
  });
  return { text: parts.join(' AND '), values };
}

export function insertQuery(table: CoreTable, row: SqlRow): QuerySpec {
  guardTable(table);
  const columns = guardRow(row);
  return {
    sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    values: columns.map((column) => row[column] ?? null),
  };
}

export function selectQuery(table: CoreTable, where: SqlRow): QuerySpec {
  guardTable(table);
  if (Object.keys(where).length === 0) return { sql: `SELECT * FROM ${table}`, values: [] };
  const clause = predicate(where);
  return { sql: `SELECT * FROM ${table} WHERE ${clause.text}`, values: clause.values };
}

export function updateQuery(table: CoreTable, set: SqlRow, where: SqlRow): QuerySpec {
  guardTable(table);
  const setColumns = guardRow(set);
  const clause = predicate(where);
  return {
    sql: `UPDATE ${table} SET ${setColumns.map((column) => `${column} = ?`).join(', ')} WHERE ${clause.text}`,
    values: [...setColumns.map((column) => set[column] ?? null), ...clause.values],
  };
}

export function deleteQuery(table: CoreTable, where: SqlRow): QuerySpec {
  guardTable(table);
  const clause = predicate(where);
  return { sql: `DELETE FROM ${table} WHERE ${clause.text}`, values: clause.values };
}

/** Duplicate detection supports both the fake and a real MySQL driver message. */
export function isDuplicateKeyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code ?? '';
  return (
    code === 'SQL_DUPLICATE_KEY' ||
    error.message.includes('SQL_DUPLICATE_KEY') ||
    error.message.includes('Duplicate entry')
  );
}
