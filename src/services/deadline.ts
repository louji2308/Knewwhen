/**
 * P9.A1 — deadline calculation service (Arch §10.4/§10.5, C-05.7-10, C-11,
 * I-3/I-7/I-8). It composes confirmed trail candidates with loaded rule data,
 * calls the pure engine once per usable candidate date, and appends one
 * `deadline_calc` row per calculation. UNREVIEWED rule data never reaches the
 * engine; PREVIEW results are marked and never treated as operational.
 */

import { createHash } from 'node:crypto';
import type { AwarenessBasis } from '../contracts/evidence';
import type { HolidayCalendar, RuleSet } from '../contracts/deadlines';
import { computeClocks, DEADLINE_ENGINE_VERSION } from '../core/deadlines';
import type { TableRepository } from './repositories';
import type { SqlRow } from './sql';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export interface DeadlineCandidate {
  readonly entryId: string;
  readonly basis: AwarenessBasis;
  readonly effectiveDate: string | null;
  readonly reasonCode: string | null;
}

export interface RuleBundle {
  readonly ruleSet: RuleSet;
  readonly digest: string;
  readonly regime: string;
  readonly calendar: HolidayCalendar;
  readonly tzRuleId: string;
}

export interface ComputeDeadlinesInput {
  readonly caseId: string;
  readonly asOfDate: string;
  readonly nowISO: string;
}

export interface CalculatedCandidate {
  readonly entryId: string;
  readonly basis: AwarenessBasis;
  readonly effectiveDate: string;
  readonly clocks: readonly {
    readonly clockId: string;
    readonly label: string;
    readonly dueDate: string;
    readonly calendarDaysRemaining: number;
    readonly workDaysRemaining: number;
    readonly state: 'OPEN' | 'DUE_TODAY' | 'OVERDUE';
    readonly trace: readonly { readonly date: string; readonly reason: string }[];
  }[];
  readonly calculationId: string;
  readonly ruleSetId: string;
  readonly ruleSetVersion: string;
  readonly ruleSetStatus: RuleSet['status'];
  readonly engineVersion: string;
  readonly preview: boolean;
}

export type ComputeDeadlinesOutcome =
  | {
      readonly status: 'COMPUTED';
      readonly results: readonly CalculatedCandidate[];
      readonly missing: readonly { readonly entryId: string; readonly reasonCode: string }[];
      readonly preview: boolean;
    }
  | {
      readonly status: 'BLOCKED';
      readonly code: 'RULE_SET_UNREVIEWED' | 'DATE_INVALID' | 'RULE_SET_INVALID';
      readonly results: readonly CalculatedCandidate[];
      readonly missing: readonly { readonly entryId: string; readonly reasonCode: string }[];
    };

const isDate = (value: string): boolean => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));

/** Deterministic id: replaying the same inputs adopts the existing row. */
function calculationId(
  input: ComputeDeadlinesInput,
  candidate: DeadlineCandidate,
  bundle: RuleBundle,
): string {
  const canonical = JSON.stringify([
    input.caseId,
    input.asOfDate,
    candidate.entryId,
    candidate.basis,
    candidate.effectiveDate,
    bundle.regime,
    bundle.ruleSet.id,
    bundle.ruleSet.version,
    bundle.digest,
    bundle.tzRuleId,
    DEADLINE_ENGINE_VERSION,
  ]);
  const hex = createHash('sha256').update(canonical).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function computeDeadlines(
  input: ComputeDeadlinesInput,
  candidates: readonly DeadlineCandidate[],
  bundle: RuleBundle,
  repository: TableRepository,
): Promise<ComputeDeadlinesOutcome> {
  if (!input.caseId || !isDate(input.asOfDate) || !ISO_UTC.test(input.nowISO)) {
    return { status: 'BLOCKED', code: 'DATE_INVALID', results: [], missing: [] };
  }
  if (bundle.ruleSet.status === 'UNREVIEWED') {
    return { status: 'BLOCKED', code: 'RULE_SET_UNREVIEWED', results: [], missing: [] };
  }
  if (
    bundle.ruleSet.holidayCalendarId !== bundle.calendar.id ||
    bundle.digest.length === 0 ||
    bundle.tzRuleId.length === 0
  ) {
    return { status: 'BLOCKED', code: 'RULE_SET_INVALID', results: [], missing: [] };
  }

  const results: CalculatedCandidate[] = [];
  const missing: { entryId: string; reasonCode: string }[] = [];
  let preview = false;

  for (const candidate of candidates) {
    if (candidate.effectiveDate === null || !isDate(candidate.effectiveDate)) {
      missing.push({
        entryId: candidate.entryId,
        reasonCode: candidate.reasonCode ?? 'DATE_INVALID',
      });
      continue;
    }

    const computed = computeClocks(
      candidate.effectiveDate,
      input.asOfDate,
      bundle.ruleSet,
      bundle.calendar,
    );
    if (computed.status !== 'COMPUTED') {
      missing.push({ entryId: candidate.entryId, reasonCode: computed.code });
      continue;
    }

    const id = calculationId(input, candidate, bundle);
    const stored: SqlRow = {
      id,
      case_id: input.caseId,
      awareness_date: candidate.effectiveDate,
      awareness_basis: candidate.basis,
      regime: bundle.regime,
      rule_set_id: bundle.ruleSet.id,
      rule_set_version: bundle.ruleSet.version,
      rule_set_digest: bundle.digest,
      rule_set_status: bundle.ruleSet.status,
      engine_version: DEADLINE_ENGINE_VERSION,
      tz_rule_id: bundle.tzRuleId,
      as_of_date: input.asOfDate,
      result_json: JSON.stringify({
        entryId: candidate.entryId,
        basis: candidate.basis,
        clocks: computed.clocks,
        preview: computed.preview,
      }),
      created_at: input.nowISO,
    };
    await repository.insert(stored);

    results.push({
      entryId: candidate.entryId,
      basis: candidate.basis,
      effectiveDate: candidate.effectiveDate,
      clocks: computed.clocks,
      calculationId: id,
      ruleSetId: computed.ruleSetId,
      ruleSetVersion: computed.ruleSetVersion,
      ruleSetStatus: computed.ruleSetStatus,
      engineVersion: computed.engineVersion,
      preview: computed.preview,
    });
    preview ||= computed.preview;
  }

  return { status: 'COMPUTED', results, missing, preview };
}
