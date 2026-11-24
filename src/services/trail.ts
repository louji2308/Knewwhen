/**
 * P5.B1/B2 — IF-9 trail service (Arch §9, C-04, I-3/I-4/I-8). One writer owns
 * review_case and trail_entry. Content is only ever inserted; the sole update
 * path is a conditional status transition. No method deletes or edits a note,
 * date, author or pointer. The time-zone rule is injected, never invented.
 */

import { ROLE_MATRIX, type Role } from '../contracts/authorisation';
import {
  AWARENESS_BASES,
  REJECTION_REASON_CODES,
  type AwarenessBasis,
  type RejectionReasonCode,
} from '../contracts/evidence';
import { dateInZone } from '../core/timezone';
import { audit, type AuditRepository } from './audit';
import type { TableRepository } from './repositories';
import type { SqlRow } from './sql';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

function assertIso(value: string, pattern: RegExp, code: string): void {
  if (!pattern.test(value)) throw new Error(code);
}

export interface CreateCaseInput {
  readonly id?: string;
  readonly anchorIssueId: string;
  readonly caseSeq: number;
  readonly origin: string;
  readonly at: string;
}

export interface AddRecordInput {
  readonly id?: string;
  readonly caseId: string;
  readonly evidenceId: string | null;
  readonly source: string;
  readonly receivedDateEntered?: string | null;
  readonly enteredBy: string;
  readonly enteredAt: string;
  readonly enteredNote?: string | null;
}

export interface AddEnteredInput {
  readonly id?: string;
  readonly caseId: string;
  readonly source: string;
  readonly receivedDateEntered: string;
  readonly enteredBy: string;
  readonly enteredAt: string;
  readonly enteredNote?: string | null;
  readonly asOfDate: string;
  readonly supersedesId?: string | null;
  readonly status?: 'PROPOSED' | 'CONFIRMED';
}

export interface TransitionInput {
  readonly entryId: string;
  readonly actorRole: Role;
  readonly actorAccountId: string;
  readonly at: string;
  readonly reasonCode?: RejectionReasonCode;
}

/** A correction is one human action; its transition time may be the entry time. */
export type CorrectInput = AddEnteredInput &
  Omit<TransitionInput, 'at'> & {
    readonly at?: string;
    readonly replacementId?: string;
  };

export function createTrailService(
  caseRepository: TableRepository,
  entryRepository: TableRepository,
  auditRepository: AuditRepository,
) {
  const uuid = (): string => globalThis.crypto.randomUUID();

  const markCaseInReview = async (caseId: string): Promise<void> => {
    await caseRepository.updateWhere({ state: 'IN_REVIEW' }, { id: caseId, state: 'OPEN' });
  };

  const transition = async (
    input: TransitionInput,
    to: 'CONFIRMED' | 'REJECTED',
    fallbackReason: RejectionReasonCode,
  ): Promise<SqlRow> => {
    if (!ROLE_MATRIX.CONFIRM_TRAIL_ENTRY.includes(input.actorRole)) {
      throw new Error('TRAIL_ROLE_DENIED');
    }
    assertIso(input.at, ISO_UTC, 'TRAIL_INVALID');
    if (input.reasonCode && !REJECTION_REASON_CODES.includes(input.reasonCode)) {
      throw new Error('TRAIL_INVALID');
    }
    const before = (await entryRepository.findBy({ id: input.entryId }))[0];
    if (!before) throw new Error('TRAIL_NOT_FOUND');
    if (before.status !== 'PROPOSED') throw new Error('TRAIL_STATE');

    const affected = await entryRepository.updateWhere(
      { status: to, decided_by: input.actorAccountId, decided_at: input.at },
      { id: input.entryId, status: 'PROPOSED' },
    );
    if (affected !== 1) throw new Error('TRAIL_CONFLICT');
    await markCaseInReview(String(before.case_id));
    await audit(auditRepository, {
      actorType: 'USER',
      actorAccountId: input.actorAccountId,
      actionCode: to === 'CONFIRMED' ? 'CONFIRM_TRAIL_ENTRY' : 'REJECT_TRAIL_ENTRY',
      targetType: 'trail_entry',
      targetId: input.entryId,
      details: {
        from: String(before.status),
        to,
        reasonCode: input.reasonCode ?? fallbackReason,
      },
      at: input.at,
    });
    return (await entryRepository.findBy({ id: input.entryId }))[0]!;
  };

  return {
    async createCase(input: CreateCaseInput): Promise<SqlRow> {
      assertIso(input.at, ISO_UTC, 'TRAIL_INVALID');
      if (!input.anchorIssueId || !Number.isInteger(input.caseSeq) || input.caseSeq < 1) {
        throw new Error('TRAIL_INVALID');
      }
      const row: SqlRow = {
        id: input.id ?? uuid(),
        anchor_issue_id: input.anchorIssueId,
        case_seq: input.caseSeq,
        state: 'OPEN',
        origin: input.origin,
        created_at: input.at,
      };
      return (await caseRepository.insert(row)).row;
    },

    async addRecord(input: AddRecordInput): Promise<SqlRow> {
      assertIso(input.enteredAt, ISO_UTC, 'TRAIL_INVALID');
      if (
        !input.evidenceId ||
        !input.caseId ||
        !input.source ||
        !input.enteredBy ||
        (input.receivedDateEntered && !ISO_DATE.test(input.receivedDateEntered))
      ) {
        throw new Error('TRAIL_INVALID');
      }
      const row: SqlRow = {
        id: input.id ?? uuid(),
        case_id: input.caseId,
        kind: 'RECORD',
        evidence_id: input.evidenceId,
        source: input.source,
        received_date_entered: input.receivedDateEntered ?? null,
        entered_by: input.enteredBy,
        entered_at: input.enteredAt,
        entered_note: input.enteredNote ?? null,
        status: 'PROPOSED',
        decided_by: null,
        decided_at: null,
        supersedes_id: null,
      };
      return (await entryRepository.insert(row)).row;
    },

    async addEntered(input: AddEnteredInput): Promise<SqlRow> {
      assertIso(input.enteredAt, ISO_UTC, 'TRAIL_INVALID');
      assertIso(input.asOfDate, ISO_DATE, 'TRAIL_INVALID');
      assertIso(input.receivedDateEntered, ISO_DATE, 'TRAIL_INVALID');
      if (input.receivedDateEntered > input.asOfDate) throw new Error('TRAIL_DATE_FUTURE');
      if (!input.caseId || !input.source || !input.enteredBy) throw new Error('TRAIL_INVALID');
      const row: SqlRow = {
        id: input.id ?? uuid(),
        case_id: input.caseId,
        kind: 'ENTERED',
        evidence_id: null,
        source: input.source,
        received_date_entered: input.receivedDateEntered,
        entered_by: input.enteredBy,
        entered_at: input.enteredAt,
        entered_note: input.enteredNote ?? null,
        status: input.status ?? 'PROPOSED',
        decided_by: input.status === 'CONFIRMED' ? input.enteredBy : null,
        decided_at: input.status === 'CONFIRMED' ? input.enteredAt : null,
        supersedes_id: input.supersedesId ?? null,
      };
      return (await entryRepository.insert(row)).row;
    },

    confirm(input: TransitionInput): Promise<SqlRow> {
      return transition(input, 'CONFIRMED', 'MISTAKE');
    },

    reject(input: TransitionInput): Promise<SqlRow> {
      if (!input.reasonCode) throw new Error('TRAIL_REASON_REQUIRED');
      return transition(input, 'REJECTED', input.reasonCode);
    },

    async correct(input: CorrectInput): Promise<SqlRow> {
      if (input.reasonCode !== 'MISTAKE' && input.reasonCode !== 'DUPLICATE') {
        throw new Error('TRAIL_INVALID');
      }
      const before = (await entryRepository.findBy({ id: input.entryId }))[0];
      if (!before) throw new Error('TRAIL_NOT_FOUND');
      const replacement = await this.addEntered({
        ...input,
        id: input.replacementId ?? uuid(),
        supersedesId: input.entryId,
      });
      // The normal route has already REJECTED the mistaken entry. A correction
      // from a still-PROPOSED entry rejects it once; nothing is edited in place.
      if (before.status === 'PROPOSED') {
        await transition(
          { ...input, at: input.at ?? input.enteredAt },
          'REJECTED',
          input.reasonCode,
        );
      } else {
        await audit(auditRepository, {
          actorType: 'USER',
          actorAccountId: input.actorAccountId,
          actionCode: 'CORRECT_TRAIL_ENTRY',
          targetType: 'trail_entry',
          targetId: input.entryId,
          details: {
            from: String(before.status),
            to: String(before.status),
            reasonCode: input.reasonCode,
            replacementId: String(replacement.id),
          },
          at: input.at ?? input.enteredAt,
        });
      }
      return replacement;
    },
  };
}

export interface CandidateDate {
  readonly entryId: string;
  readonly basis: AwarenessBasis;
  readonly effectiveDate: string | null;
  readonly reasonCode: string | null;
  /** Human-entered receipt or Jira record time; app observation is separate. */
  readonly observationAt: string | null;
  readonly strength: string | null;
}

export interface CandidateDateList {
  readonly candidates: readonly CandidateDate[];
  /** Rule data does not decide awareness: no entry or basis is preselected. */
  readonly preselectedEntryId: null;
  readonly preselectedBasis: null;
}

export function candidateDates(
  rows: readonly SqlRow[],
  evidenceByEntry: ReadonlyMap<string, SqlRow>,
  timeZone: string | null,
): CandidateDateList {
  const candidates: CandidateDate[] = [];
  for (const row of rows) {
    if (row.status !== 'CONFIRMED') continue;
    const evidence = row.evidence_id ? evidenceByEntry.get(String(row.evidence_id)) : undefined;
    for (const basis of AWARENESS_BASES) {
      let effectiveDate: string | null = null;
      let reasonCode: string | null = null;
      if (basis === 'ENTERED_RECEIPT_DATE') {
        const entered = row.received_date_entered;
        if (typeof entered === 'string' && ISO_DATE.test(entered)) effectiveDate = entered;
        else reasonCode = 'RECEIPT_DATE_MISSING';
      } else if (!timeZone) {
        reasonCode = 'TIMEZONE_RULE_MISSING';
      } else if (!evidence || typeof evidence.record_created_at !== 'string') {
        reasonCode = 'EVIDENCE_MISSING';
      } else {
        const converted = dateInZone(evidence.record_created_at, timeZone);
        if (typeof converted === 'string') effectiveDate = converted;
        else reasonCode = 'DATE_INVALID';
      }
      candidates.push({
        entryId: String(row.id),
        basis,
        effectiveDate,
        reasonCode,
        observationAt: typeof row.entered_at === 'string' ? row.entered_at : null,
        strength: evidence && typeof evidence.strength === 'string' ? evidence.strength : null,
      });
    }
  }
  candidates.sort((left, right) => {
    const a = left.effectiveDate ?? '9999-12-31';
    const b = right.effectiveDate ?? '9999-12-31';
    if (a !== b) return a < b ? -1 : 1;
    if (left.entryId !== right.entryId) return left.entryId < right.entryId ? -1 : 1;
    return left.basis < right.basis ? -1 : left.basis > right.basis ? 1 : 0;
  });
  return { candidates, preselectedEntryId: null, preselectedBasis: null };
}
