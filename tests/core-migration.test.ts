import { describe, expect, it, vi } from 'vitest';
import {
  CORE_TABLE_MIGRATIONS,
  runCoreMigration,
  type CoreMigrationRunner,
} from '../src/handlers/migration';

// Independent literals transcribed from Architecture §5.2 (ER diagram), §5.3
// (key columns and constraints) and §14.3/§14.5 (operational tables). These are
// the authority; the migration module must match them, not the reverse.
const EXPECTED_TABLES = [
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
] as const;

const KEY_COLUMNS: Record<string, readonly string[]> = {
  review_case: ['id', 'anchor_issue_id', 'case_seq', 'state', 'origin'],
  scan: [
    'id',
    'issue_id',
    'trigger',
    'method',
    'status',
    'result',
    'reason_code',
    'lexicon_version',
  ],
  segment_state: [
    'issue_id',
    'segment_key',
    'body_hash',
    'hash_key_id',
    'extractor_version',
    'state',
    'last_scan_id',
  ],
  evidence_item: [
    'id',
    'issue_id',
    'segment_key',
    'span_hash',
    'body_hash',
    'validation_status',
    'record_created_at',
    'record_updated_at',
    'hash_key_id',
    'captured_by',
    'strength',
  ],
  trail_entry: [
    'id',
    'kind',
    'evidence_id',
    'received_date_entered',
    'entered_by',
    'entered_at',
    'status',
    'decided_by',
    'decided_at',
    'supersedes_id',
  ],
  lookback_run: [
    'id',
    'anchor_entry_id',
    'profile_version',
    'cursor_json',
    'examined_issues',
    'search_calls',
    'caps_hit_json',
  ],
  candidate_match: [
    'id',
    'case_id',
    'candidate_issue_id',
    'candidate_segment_key',
    'reasons_json',
    'overlap',
    'confidence',
    'state',
    'decided_by',
    'decided_at',
  ],
  deadline_calc: [
    'id',
    'awareness_date',
    'awareness_basis',
    'regime',
    'rule_set_id',
    'rule_set_version',
    'rule_set_digest',
    'rule_set_status',
    'engine_version',
    'tz_rule_id',
    'as_of_date',
    'result_json',
  ],
  decision_record: [
    'id',
    'case_id',
    'version',
    'state',
    'awareness_entry_id',
    'awareness_date',
    'awareness_basis',
    'deadline_calc_id',
    'question_set_id',
    'question_set_version',
    'answers_json',
    'rationale',
    'evidence_snapshot_json',
    'features_json',
    'decided_by',
    'decided_at',
    'supersedes_id',
    'supersede_reason',
  ],
  follow_up: ['id', 'decision_id', 'owner_account_id', 'due_date', 'status', 'note'],
  writeback_task: [
    'id',
    'case_id',
    'kind',
    'dedupe_key',
    'status',
    'attempts',
    'last_error_code',
    'comment_id',
  ],
  audit_event: [
    'id',
    'actor_type',
    'actor_account_id',
    'action_code',
    'target_type',
    'target_id',
    'at',
    'details_json',
  ],
  usage_counter: ['bucket', 'kind', 'count'],
  scan_lease: ['issue_id', 'owner_job', 'lease_until'],
};

const UNIQUE_KEYS: Record<string, readonly string[]> = {
  review_case: ['anchor_issue_id', 'case_seq'],
  candidate_match: ['case_id', 'candidate_issue_id', 'candidate_segment_key'],
  decision_record: ['case_id', 'version'],
  writeback_task: ['case_id', 'kind', 'dedupe_key'],
};

/** Parse column names from DDL lines (ignore KEY/CONSTRAINT/closing lines). */
function columnNames(ddl: string): string[] {
  return ddl
    .split('\n')
    .map((line) => line.trim().replace(/,$/, ''))
    .filter(
      (line) =>
        line.length > 0 && !/^(CREATE|UNIQUE|PRIMARY|KEY|CONSTRAINT|INDEX|\)|\()/i.test(line),
    )
    .map((line) => line.split(/\s+/)[0]!.replace(/`/g, '').toLowerCase());
}

describe('P2.A1 Core SQL migration (Arch §5.2/§5.3, §14.3/§14.5; PF-DB-3/4/5, PF-SQL-1)', () => {
  it('defines exactly 14 uniquely named forward-only operations', () => {
    expect(CORE_TABLE_MIGRATIONS).toHaveLength(14);
    const names = CORE_TABLE_MIGRATIONS.map((op) => op.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^\d{3}-/);
  });

  it('covers every Core table, including scan_lease and usage_counter', () => {
    const names = CORE_TABLE_MIGRATIONS.map((op) => op.name);
    for (const table of EXPECTED_TABLES) {
      expect(names.some((name) => name.endsWith(`-${table}`))).toBe(true);
    }
  });

  it('each operation is a single CREATE TABLE IF NOT EXISTS statement', () => {
    for (const op of CORE_TABLE_MIGRATIONS) {
      expect(op.ddl.trim()).toMatch(/^CREATE TABLE IF NOT EXISTS /i);
      expect(op.ddl).not.toMatch(/;\s*\S/); // no second statement after a semicolon
    }
  });

  it('key columns match Architecture §5.3 cell by cell', () => {
    for (const [table, columns] of Object.entries(KEY_COLUMNS)) {
      const op = CORE_TABLE_MIGRATIONS.find((candidate) => candidate.name.endsWith(`-${table}`));
      expect(op, `missing migration for ${table}`).toBeDefined();
      const parsed = columnNames(op!.ddl);
      for (const column of columns) {
        expect(parsed, `${table}.${column}`).toContain(column);
      }
    }
  });

  it('integrity unique keys match Architecture §5.3 (no foreign keys are relied on)', () => {
    for (const [table, columns] of Object.entries(UNIQUE_KEYS)) {
      const op = CORE_TABLE_MIGRATIONS.find((candidate) => candidate.name.endsWith(`-${table}`));
      for (const column of columns) expect(op!.ddl).toContain(column);
      expect(op!.ddl).toMatch(/UNIQUE KEY/i);
    }
    for (const op of CORE_TABLE_MIGRATIONS) {
      expect(op.ddl.toUpperCase()).not.toContain('FOREIGN KEY');
      expect(op.ddl.toUpperCase()).not.toContain('REFERENCES');
    }
  });

  it('stores no Jira record text: no body/quote/summary/text columns (I-6)', () => {
    const banned = new Set(['body', 'quote', 'summary', 'text', 'description', 'recordtext']);
    for (const op of CORE_TABLE_MIGRATIONS) {
      for (const column of columnNames(op.ddl)) {
        expect(banned.has(column), `${op.name}.${column}`).toBe(false);
      }
      expect(JSON.stringify(op)).not.toContain('canary-record-text');
    }
  });

  it('enqueues all operations then runs exactly once, reporting a count only', async () => {
    const enqueue = vi.fn();
    const run = vi.fn().mockResolvedValue(['a', 'b', 'c']);
    const runner: CoreMigrationRunner = { enqueue, run };
    const outcome = await runCoreMigration(runner);
    expect(enqueue).toHaveBeenCalledTimes(14);
    expect(run).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ status: 'migration-ok', applied: 3, operations: 14 });
  });

  it('is idempotent by operation name when run twice (PF-SQL-1, PF-DB-3)', async () => {
    const executed = new Map<string, string>();
    const runner: CoreMigrationRunner = {
      enqueue: (name, ddl) => {
        executed.set(name, ddl); // real runner is idempotent by name
      },
      run: async () => [...executed.keys()],
    };
    await runCoreMigration(runner);
    await runCoreMigration(runner);
    expect(executed.size).toBe(14);
  });

  it('propagates a runner failure without masking it (AGENTS §17.1)', async () => {
    const runner: CoreMigrationRunner = {
      enqueue: () => undefined,
      run: () => Promise.reject(new Error('DDL_FAILED')),
    };
    await expect(runCoreMigration(runner)).rejects.toThrow('DDL_FAILED');
  });
});
