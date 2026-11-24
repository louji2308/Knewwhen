/**
 * Forge SQL migration handler. Pure: the official @forge/sql migrationRunner is
 * injected at the adapter boundary so this module stays testable and imports no
 * Forge package (Arch §3).
 *
 * P1 baseline: `runEmptyMigration` enqueued zero DDL and only provisioned the
 * platform tracking table. It is retained because the P1 evidence depends on it.
 *
 * P2.A1: `runCoreMigration` enqueues the Core schema. Forward-only, one
 * CREATE TABLE IF NOT EXISTS statement per operation, idempotent by operation
 * name (PF-SQL-1). No foreign keys, no upsert, no multi-statement calls
 * (PF-DB-3/4/5). Integrity comes from UNIQUE/PRIMARY keys and the owning
 * services' conditional updates plus reconciliation (Arch §5.3, §15).
 *
 * Timestamp columns are VARCHAR(24) ISO-8601 UTC with milliseconds: this
 * preserves the architecture's millisecond precision and the three distinct
 * time notions (I-3) without depending on an unverified SQL DATETIME precision.
 */

export interface MigrationRunner {
  run(): Promise<readonly unknown[]>;
}

/** The real @forge/sql migrationRunner also exposes enqueue (PF-SQL-1). */
export interface CoreMigrationRunner extends MigrationRunner {
  enqueue(name: string, ddl: string): void;
}

export interface MigrationOperation {
  readonly name: string;
  readonly ddl: string;
}

export interface MigrationOutcome {
  readonly status: 'migration-ok';
  readonly applied: number;
}

export interface CoreMigrationOutcome extends MigrationOutcome {
  readonly operations: number;
}

export async function runEmptyMigration(runner: MigrationRunner): Promise<MigrationOutcome> {
  const applied = await runner.run();
  return { status: 'migration-ok', applied: applied.length };
}

/**
 * The complete Core schema, transcribed from Architecture §5.2/§5.3 and
 * §14.3/§14.5. Frozen data: a change here is a new forward-only operation,
 * never an edit to an applied one (Arch §12.4 on frozen versions).
 */
export const CORE_TABLE_MIGRATIONS: readonly MigrationOperation[] = Object.freeze([
  {
    name: '001-review_case',
    ddl: `CREATE TABLE IF NOT EXISTS review_case (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  anchor_issue_id VARCHAR(32) NOT NULL,
  case_seq INT NOT NULL,
  state VARCHAR(32) NOT NULL,
  origin VARCHAR(32) NOT NULL,
  created_at VARCHAR(24) NOT NULL,
  UNIQUE KEY uq_review_case_anchor_seq (anchor_issue_id, case_seq)
)`,
  },
  {
    name: '002-scan',
    ddl: `CREATE TABLE IF NOT EXISTS scan (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  issue_id VARCHAR(32) NOT NULL,
  trigger VARCHAR(64) NOT NULL,
  method VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  result VARCHAR(32) NOT NULL,
  reason_code VARCHAR(64) NULL,
  lexicon_version VARCHAR(64) NULL,
  prompt_version VARCHAR(64) NULL,
  model_id VARCHAR(64) NULL,
  extractor_version VARCHAR(64) NULL,
  segments_seen INT NOT NULL DEFAULT 0,
  segments_scanned INT NOT NULL DEFAULT 0,
  quotes_proposed INT NOT NULL DEFAULT 0,
  quotes_rejected INT NOT NULL DEFAULT 0,
  started_at VARCHAR(24) NOT NULL,
  finished_at VARCHAR(24) NULL
)`,
  },
  {
    name: '003-segment_state',
    ddl: `CREATE TABLE IF NOT EXISTS segment_state (
  issue_id VARCHAR(32) NOT NULL,
  segment_key VARCHAR(255) NOT NULL,
  body_hash VARCHAR(64) NOT NULL,
  hash_key_id VARCHAR(36) NOT NULL,
  extractor_version VARCHAR(64) NOT NULL,
  state VARCHAR(64) NOT NULL,
  last_scan_id VARCHAR(36) NULL,
  PRIMARY KEY (issue_id, segment_key)
)`,
  },
  {
    name: '004-evidence_item',
    ddl: `CREATE TABLE IF NOT EXISTS evidence_item (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  issue_id VARCHAR(32) NOT NULL,
  segment_key VARCHAR(255) NOT NULL,
  author_account_id VARCHAR(255) NULL,
  record_created_at VARCHAR(24) NOT NULL,
  record_updated_at VARCHAR(24) NOT NULL,
  span_start INT NOT NULL,
  span_len INT NOT NULL,
  span_hash VARCHAR(64) NOT NULL,
  body_hash VARCHAR(64) NOT NULL,
  hash_key_id VARCHAR(36) NOT NULL,
  normalisation_version VARCHAR(64) NOT NULL,
  captured_by VARCHAR(32) NOT NULL,
  strength VARCHAR(32) NOT NULL,
  validation_status VARCHAR(32) NOT NULL,
  last_validated_at VARCHAR(24) NULL
)`,
  },
  {
    name: '005-trail_entry',
    ddl: `CREATE TABLE IF NOT EXISTS trail_entry (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  kind VARCHAR(16) NOT NULL,
  evidence_id VARCHAR(36) NULL,
  source VARCHAR(32) NOT NULL,
  received_date_entered DATE NULL,
  entered_by VARCHAR(255) NULL,
  entered_at VARCHAR(24) NOT NULL,
  entered_note TEXT NULL,
  status VARCHAR(32) NOT NULL,
  decided_by VARCHAR(255) NULL,
  decided_at VARCHAR(24) NULL,
  supersedes_id VARCHAR(36) NULL
)`,
  },
  {
    name: '006-lookback_run',
    ddl: `CREATE TABLE IF NOT EXISTS lookback_run (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  anchor_entry_id VARCHAR(36) NOT NULL,
  profile_version VARCHAR(64) NOT NULL,
  cursor_json TEXT NULL,
  examined_issues INT NOT NULL DEFAULT 0,
  search_calls INT NOT NULL DEFAULT 0,
  caps_hit_json TEXT NULL,
  status VARCHAR(32) NOT NULL
)`,
  },
  {
    name: '007-candidate_match',
    ddl: `CREATE TABLE IF NOT EXISTS candidate_match (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  candidate_issue_id VARCHAR(32) NOT NULL,
  candidate_segment_key VARCHAR(255) NOT NULL,
  reasons_json TEXT NOT NULL,
  overlap DECIMAL(10,6) NOT NULL DEFAULT 0,
  confidence VARCHAR(16) NOT NULL,
  candidate_record_ts VARCHAR(24) NULL,
  state VARCHAR(32) NOT NULL,
  decided_by VARCHAR(255) NULL,
  decided_at VARCHAR(24) NULL,
  UNIQUE KEY uq_candidate_match (case_id, candidate_issue_id, candidate_segment_key)
)`,
  },
  {
    name: '008-deadline_calc',
    ddl: `CREATE TABLE IF NOT EXISTS deadline_calc (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  awareness_date DATE NOT NULL,
  awareness_basis VARCHAR(32) NOT NULL,
  regime VARCHAR(32) NOT NULL,
  rule_set_id VARCHAR(64) NOT NULL,
  rule_set_version VARCHAR(64) NOT NULL,
  rule_set_digest VARCHAR(64) NOT NULL,
  rule_set_status VARCHAR(32) NOT NULL,
  engine_version VARCHAR(64) NOT NULL,
  tz_rule_id VARCHAR(64) NOT NULL,
  as_of_date DATE NOT NULL,
  result_json TEXT NOT NULL,
  created_at VARCHAR(24) NOT NULL
)`,
  },
  {
    name: '009-decision_record',
    ddl: `CREATE TABLE IF NOT EXISTS decision_record (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  version INT NOT NULL,
  state VARCHAR(32) NOT NULL,
  awareness_entry_id VARCHAR(36) NOT NULL,
  awareness_date DATE NOT NULL,
  awareness_basis VARCHAR(32) NOT NULL,
  deadline_calc_id VARCHAR(36) NULL,
  question_set_id VARCHAR(64) NOT NULL,
  question_set_version VARCHAR(64) NOT NULL,
  answers_json TEXT NOT NULL,
  rationale TEXT NULL,
  evidence_snapshot_json TEXT NOT NULL,
  features_json TEXT NOT NULL,
  decided_by VARCHAR(255) NULL,
  decided_at VARCHAR(24) NULL,
  supersedes_id VARCHAR(36) NULL,
  supersede_reason VARCHAR(64) NULL,
  UNIQUE KEY uq_decision_record_case_version (case_id, version)
)`,
  },
  {
    name: '010-follow_up',
    ddl: `CREATE TABLE IF NOT EXISTS follow_up (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  decision_id VARCHAR(36) NOT NULL,
  owner_account_id VARCHAR(255) NULL,
  due_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL,
  note TEXT NULL
)`,
  },
  {
    name: '011-writeback_task',
    ddl: `CREATE TABLE IF NOT EXISTS writeback_task (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  dedupe_key VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  last_error_code VARCHAR(64) NULL,
  comment_id VARCHAR(32) NULL,
  UNIQUE KEY uq_writeback_task (case_id, kind, dedupe_key)
)`,
  },
  {
    name: '012-audit_event',
    ddl: `CREATE TABLE IF NOT EXISTS audit_event (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  actor_type VARCHAR(32) NOT NULL,
  actor_account_id VARCHAR(255) NULL,
  action_code VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NULL,
  target_id VARCHAR(255) NULL,
  at VARCHAR(24) NOT NULL,
  details_json TEXT NOT NULL
)`,
  },
  {
    name: '013-usage_counter',
    ddl: `CREATE TABLE IF NOT EXISTS usage_counter (
  bucket VARCHAR(64) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, kind)
)`,
  },
  {
    name: '014-scan_lease',
    ddl: `CREATE TABLE IF NOT EXISTS scan_lease (
  issue_id VARCHAR(32) NOT NULL PRIMARY KEY,
  owner_job VARCHAR(255) NOT NULL,
  lease_until VARCHAR(24) NOT NULL
)`,
  },
]);

/**
 * Enqueue every Core operation, then run once. The runner is idempotent by
 * operation name, so re-running after a retry applies nothing twice. Only
 * counts are returned — no DDL text or runner output is logged (I-6).
 */
export async function runCoreMigration(runner: CoreMigrationRunner): Promise<CoreMigrationOutcome> {
  for (const operation of CORE_TABLE_MIGRATIONS) {
    runner.enqueue(operation.name, operation.ddl);
  }
  const applied = await runner.run();
  return {
    status: 'migration-ok',
    applied: applied.length,
    operations: CORE_TABLE_MIGRATIONS.length,
  };
}
