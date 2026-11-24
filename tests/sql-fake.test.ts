import { describe, expect, it } from 'vitest';
import {
  CORE_TABLE_KEYS,
  CORE_TABLE_NAMES,
  ddlTableNames,
  type CoreTable,
  type SqlPort,
  type SqlRow,
} from '../src/services/sql';
import { createSqlFake } from './support/sql-fake';

const CASE: SqlRow = {
  id: 'case-1',
  anchor_issue_id: '10001',
  case_seq: 1,
  state: 'OPEN',
  origin: 'MANUAL',
  created_at: '2026-11-24T12:00:00.000Z',
};

const insert = (port: SqlPort, table: CoreTable, row: SqlRow) =>
  port
    .prepare(
      `INSERT INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.keys(row)
        .map(() => '?')
        .join(', ')})`,
    )
    .bindParams(...Object.values(row))
    .execute();

describe('P2.A2 in-memory SQL fake built from verified facts (PF-DB-1/2/3/4/5)', () => {
  it('enforces PRIMARY KEY and UNIQUE constraints transcribed from Arch §5.3', async () => {
    const fake = createSqlFake();
    await insert(fake, 'review_case', CASE);
    await expect(insert(fake, 'review_case', CASE)).rejects.toThrow('SQL_DUPLICATE_KEY');
    await expect(
      insert(fake, 'review_case', { ...CASE, id: 'case-2' }), // same (anchor, seq)
    ).rejects.toThrow('SQL_DUPLICATE_KEY');
    await expect(
      insert(fake, 'review_case', { ...CASE, id: 'case-3', case_seq: 2 }),
    ).resolves.toBeDefined();
  });

  it('binds every value as a parameter: semicolons stay data, not a second statement', async () => {
    const fake = createSqlFake();
    const row: SqlRow = { ...CASE, id: "case-'; DROP TABLE review_case; --" };
    await insert(fake, 'review_case', row);
    expect(fake.dump('review_case')).toHaveLength(1);
    expect(fake.dump('review_case')[0]!.id).toBe(row.id);
  });

  it('rejects a multi-statement query at prepare time (PF-DB-5)', () => {
    expect(() =>
      createSqlFake().prepare('SELECT * FROM review_case; DELETE FROM review_case'),
    ).toThrow('SQL_MULTI_STATEMENT');
  });

  it('reports affectedRows from UPDATE and DELETE (PF-DB-2)', async () => {
    const fake = createSqlFake();
    await insert(fake, 'review_case', CASE);
    const updated = await fake
      .prepare('UPDATE review_case SET state = ? WHERE id = ?')
      .bindParams('CLOSED', 'case-1')
      .execute();
    expect(updated.affectedRows).toBe(1);
    const noMatch = await fake
      .prepare('UPDATE review_case SET state = ? WHERE id = ?')
      .bindParams('CLOSED', 'missing')
      .execute();
    expect(noMatch.affectedRows).toBe(0);

    const deleted = await fake
      .prepare('DELETE FROM review_case WHERE id = ?')
      .bindParams('case-1')
      .execute();
    expect(deleted.affectedRows).toBe(1);
  });

  it('implements IS NULL for null predicates (three-valued SQL semantics)', async () => {
    const fake = createSqlFake();
    await insert(fake, 'review_case', CASE);
    const none = await fake
      .prepare('SELECT * FROM review_case WHERE decided_at IS NULL')
      .bindParams()
      .execute();
    expect(none.rows).toHaveLength(1);
    const some = await fake
      .prepare('SELECT * FROM review_case WHERE id IS NULL')
      .bindParams()
      .execute();
    expect(some.rows).toHaveLength(0);
  });

  it('has no foreign keys: deleting a parent does not cascade (PF-DB-4)', async () => {
    const fake = createSqlFake();
    await insert(fake, 'review_case', CASE);
    await insert(fake, 'trail_entry', { id: 'trail-1', case_id: 'case-1' });
    await fake.prepare('DELETE FROM review_case WHERE id = ?').bindParams('case-1').execute();
    expect(fake.dump('trail_entry')).toHaveLength(1);
  });

  it('rejects a query against an unknown table', () => {
    expect(() => createSqlFake().prepare('SELECT * FROM dropped_table')).toThrow(
      'SQL_UNKNOWN_TABLE',
    );
  });

  it('transcribes a key for every Core table (15 owners, no missing spec)', () => {
    expect(Object.keys(CORE_TABLE_KEYS)).toHaveLength(15);
    for (const [table, keys] of Object.entries(CORE_TABLE_KEYS)) {
      expect(keys.primary.length, table).toBeGreaterThan(0);
    }
  });

  it('keeps the fake table list in step with the frozen migration DDL', () => {
    expect([...ddlTableNames()]).toEqual([...CORE_TABLE_NAMES]);
  });
});
