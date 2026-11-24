import { describe, expect, it, vi } from 'vitest';
import {
  CORE_TABLE_NAMES,
  deleteQuery,
  insertQuery,
  isDuplicateKeyError,
  selectQuery,
  updateQuery,
  type SqlRow,
} from '../src/services/sql';
import { createRepositories } from '../src/services/repositories';
import { createSqlFake } from './support/sql-fake';

const CASE: SqlRow = {
  id: 'case-1',
  anchor_issue_id: '10001',
  case_seq: 1,
  state: 'OPEN',
  origin: 'MANUAL',
  created_at: '2026-11-24T12:00:00.000Z',
};

describe('P2.A2 parameterised query builders (PF-DB-1/5; I-6)', () => {
  it('places values in bindParams, never in the SQL text', () => {
    const spec = insertQuery('review_case', CASE);
    expect(spec.sql).toContain('?');
    expect(spec.sql).not.toContain('case-1');
    expect(spec.values).toEqual(Object.values(CASE));
  });

  it('emits IS NULL for null predicates and rejects an empty UPDATE/DELETE predicate', () => {
    expect(selectQuery('review_case', { decided_at: null }).sql).toContain('decided_at IS NULL');
    expect(() => updateQuery('review_case', { state: 'X' }, {})).toThrow('SQL_WHERE_REQUIRED');
    expect(() => deleteQuery('review_case', {})).toThrow('SQL_WHERE_REQUIRED');
  });

  it('rejects an unsafe column identifier before a query is built', () => {
    expect(() => insertQuery('review_case', { 'id) VALUES (1); --': 'x' })).toThrow(
      'SQL_IDENTIFIER',
    );
  });

  it('recognises a duplicate-key failure for the read-after-write fallback (PF-DB-3)', () => {
    expect(isDuplicateKeyError(new Error('SQL_DUPLICATE_KEY'))).toBe(true);
    expect(isDuplicateKeyError(new Error('OTHER'))).toBe(false);
  });
});

describe('P2.A2 one owning repository per Core table (Arch §12)', () => {
  it('exposes exactly the 14 table owners', () => {
    const repos = createRepositories(createSqlFake());
    expect(Object.keys(repos).sort()).toEqual(CORE_TABLE_NAMES.slice().sort());
  });

  it('routes each owner to its own table only', async () => {
    const fake = createSqlFake();
    const repos = createRepositories(fake);
    await repos.review_case.insert(CASE);
    expect(fake.dump('review_case')).toHaveLength(1);
    expect(fake.dump('trail_entry')).toHaveLength(0);
  });
});

describe('P2.A2 repository semantics (read-after-write; no upsert — PF-DB-3)', () => {
  it('is idempotent by key: a repeat insert adopts the existing row without duplication', async () => {
    const repos = createRepositories(createSqlFake());
    const first = await repos.review_case.insert(CASE);
    const second = await repos.review_case.insert(CASE);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(second.row).toEqual(CASE);
  });

  it('adopts the winner when a competing insert wins the race', async () => {
    const fake = createSqlFake();
    const repos = createRepositories(fake);
    const spy = vi.spyOn(fake, 'prepare');
    await fake
      .prepare(
        'INSERT INTO review_case (id, anchor_issue_id, case_seq, state, origin, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bindParams('case-1', '10001', 1, 'OPEN', 'MANUAL', '2026-11-24T12:00:00.000Z')
      .execute();
    spy.mockClear();
    const outcome = await repos.review_case.insert({ ...CASE, state: 'OTHER' });
    expect(outcome.inserted).toBe(false);
    expect(outcome.row.state).toBe('OPEN');
  });

  it('supports conditional finalise: UPDATE ... WHERE state = DRAFT reports affectedRows', async () => {
    const repos = createRepositories(createSqlFake());
    await repos.decision_record.insert({
      id: 'decision-1',
      case_id: 'case-1',
      version: 1,
      state: 'DRAFT',
    });
    expect(
      await repos.decision_record.updateWhere(
        { state: 'FINAL', decided_at: '2026-11-24T12:00:00.000Z' },
        { id: 'decision-1', state: 'DRAFT' },
      ),
    ).toBe(1);
    expect(
      await repos.decision_record.updateWhere(
        { state: 'FINAL' },
        { id: 'decision-1', state: 'DRAFT' },
      ),
    ).toBe(0);
  });

  it('rejects a canary probe in a SQL parameter before binding (P2.B2, I-6)', async () => {
    const repos = createRepositories(createSqlFake());
    await expect(
      repos.follow_up.insert({
        id: 'fu-1',
        decision_id: 'd-1',
        due_date: '2026-11-25',
        status: 'OPEN',
        note: 'canary-record-text-alpha-7f3a',
      }),
    ).rejects.toThrow('SQL_CANARY');
    await expect(repos.follow_up.findBy({ id: 'fu-1' })).resolves.toEqual([]);
  });
});
