/**
 * P9.A3/A5 — decision service (Arch §11.1-11.3, C-06.1-12, C-07.3/8,
 * I-4/I-5/I-8). Only a server-resolved Qualified person may draft, finalise or
 * supersede. There is no suggested answer, no autonomous verdict and no
 * reportability wording. FINAL is a conditional state change; the outbox tasks
 * are enqueued after it, and a failed write-back never changes the decision.
 */

import { ROLE_MATRIX, type Role } from '../contracts/authorisation';
import { RULE_STATUSES, type RuleStatus } from '../contracts/deadlines';
import { AWARENESS_BASES, type AwarenessBasis } from '../contracts/evidence';
import type { QuestionSet } from '../contracts/question-set';
import type { WritebackTaskKind } from '../contracts/writeback';
import { audit, type AuditRepository } from './audit';
import type { Repositories } from './repositories';
import type { SqlRow } from './sql';
import { enqueueWriteback } from './writeback';
import { writebackPortsFromRepositories } from './writeback-ports';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const UNDETERMINED = 'UNDETERMINED';

export const SUPERSEDE_REASON_CODES = Object.freeze([
  'RULE_SET_CHANGE',
  'NEW_EVIDENCE',
  'CORRECTION',
  'TRAIL_CHANGE',
] as const);
export type SupersedeReasonCode = (typeof SUPERSEDE_REASON_CODES)[number];

export interface DecisionPorts {
  readonly repositories: Repositories;
  readonly questionSet: QuestionSet;
  readonly nowISO: string;
  /** Server-selected rule-set status; the question-set status is the fallback. */
  readonly rulesStatus?: RuleStatus;
}

export interface StartDraftInput {
  readonly id?: string;
  readonly caseId: string;
  readonly actorRole: Role;
  readonly actorAccountId: string;
  readonly at: string;
  readonly awarenessEntryId?: string;
  readonly awarenessDate?: string;
  readonly awarenessBasis?: AwarenessBasis | typeof UNDETERMINED;
  readonly productKey?: string;
  readonly supersedesId?: string;
  readonly supersedeReason?: SupersedeReasonCode;
  readonly version?: number;
}

export interface FinaliseInput {
  readonly draftId: string;
  readonly caseId: string;
  readonly actorRole: Role;
  readonly actorAccountId: string;
  readonly at: string;
  readonly questionSetId: string;
  readonly questionSetVersion: string;
  readonly answers: Readonly<Record<string, string>>;
  readonly rationale: string;
  readonly productKey: string;
  readonly notAComplaint?: boolean;
  readonly featureReasonCodes?: readonly string[];
  readonly deadlineCalcId?: string;
}

export interface SupersedeInput {
  readonly caseId: string;
  readonly priorId: string;
  readonly actorRole: Role;
  readonly actorAccountId: string;
  readonly at: string;
  readonly reasonCode: string;
  readonly productKey?: string;
}

const isDate = (value: string): boolean => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));

function assertUtc(value: string, code: string): void {
  if (!ISO_UTC.test(value) || Number.isNaN(Date.parse(value))) throw new Error(code);
}

function assertQp(role: Role): void {
  if (!ROLE_MATRIX.DECIDE.includes(role)) throw new Error('DECISION_ROLE_DENIED');
}

const text = (row: SqlRow | null | undefined, key: string): string => {
  const value = row?.[key];
  return typeof value === 'string' ? value : '';
};

const numeric = (row: SqlRow | null | undefined, key: string): number => {
  const value = row?.[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : 0;
};

export function createDecisionService(ports: DecisionPorts) {
  const { repositories, questionSet } = ports;
  const uuid = (): string => globalThis.crypto.randomUUID();
  const auditRepository: AuditRepository = {
    async insert(event) {
      await repositories.audit_event.insert({
        id: event.id,
        actor_type: event.actorType,
        actor_account_id: event.actorAccountId,
        action_code: event.actionCode,
        target_type: event.targetType,
        target_id: event.targetId,
        at: event.at,
        details_json: event.detailsJson,
      });
    },
  };
  const rulesStatus: RuleStatus = RULE_STATUSES.includes(ports.rulesStatus as RuleStatus)
    ? (ports.rulesStatus as RuleStatus)
    : questionSet.status;
  const provisional = rulesStatus === 'UNREVIEWED';

  const nextVersion = async (caseId: string): Promise<number> => {
    const rows = await repositories.decision_record.findBy({ case_id: caseId });
    return rows.reduce((max, row) => Math.max(max, numeric(row, 'version')), 0) + 1;
  };

  const draftRow = async (
    input: StartDraftInput,
    version: number,
    previous?: SqlRow,
  ): Promise<SqlRow> => {
    const hasEntry =
      input.awarenessEntryId !== undefined ||
      input.awarenessDate !== undefined ||
      input.awarenessBasis !== undefined;
    let entryId = '';
    let awarenessDate = '';
    let basis: string = UNDETERMINED;
    if (hasEntry) {
      if (
        !input.awarenessEntryId ||
        !input.awarenessDate ||
        !isDate(input.awarenessDate) ||
        !input.awarenessBasis ||
        ![...AWARENESS_BASES, UNDETERMINED].includes(input.awarenessBasis)
      ) {
        throw new Error('DECISION_DATE_INVALID');
      }
      const entries = await repositories.trail_entry.findBy({
        id: input.awarenessEntryId,
        case_id: input.caseId,
      });
      const entry = entries[0];
      if (!entry || entry.status !== 'CONFIRMED') throw new Error('DECISION_ENTRY_UNCONFIRMED');
      entryId = String(entry.id);
      awarenessDate = input.awarenessDate;
      basis = input.awarenessBasis;
    } else if (previous !== undefined) {
      entryId = text(previous, 'awareness_entry_id');
      awarenessDate = text(previous, 'awareness_date');
      basis = text(previous, 'awareness_basis');
    }

    return {
      id: input.id ?? uuid(),
      case_id: input.caseId,
      version,
      state: 'DRAFT',
      awareness_entry_id: entryId,
      awareness_date: awarenessDate,
      awareness_basis: basis,
      deadline_calc_id: previous ? (previous.deadline_calc_id ?? null) : null,
      question_set_id: questionSet.id,
      question_set_version: questionSet.version,
      answers_json: '{}',
      rationale: previous ? (previous.rationale ?? null) : null,
      evidence_snapshot_json: previous ? text(previous, 'evidence_snapshot_json') || '[]' : '[]',
      features_json: previous ? text(previous, 'features_json') || '{}' : '{}',
      decided_by: null,
      decided_at: null,
      supersedes_id: input.supersedesId ?? null,
      supersede_reason: input.supersedeReason ?? null,
    };
  };

  const evidenceSnapshot = async (entryId: string, caseId: string): Promise<readonly SqlRow[]> => {
    const entries = await repositories.trail_entry.findBy({ id: entryId, case_id: caseId });
    const entry = entries[0];
    if (!entry) throw new Error('DECISION_ENTRY_MISMATCH');
    if (entry.status !== 'CONFIRMED') throw new Error('DECISION_ENTRY_UNCONFIRMED');
    const evidenceId = entry.evidence_id;
    if (typeof evidenceId !== 'string' || evidenceId.length === 0) return [];
    const items = await repositories.evidence_item.findBy({ id: evidenceId });
    const item = items[0];
    if (!item || item.validation_status !== 'VALID') throw new Error('DECISION_EVIDENCE_DEGRADED');
    return [
      {
        entryId: String(entry.id),
        evidenceId,
        validationStatus: String(item.validation_status),
        lastValidatedAt: item.last_validated_at ?? null,
      },
    ];
  };

  const validateAnswers = (answers: Readonly<Record<string, string>>): void => {
    const expected = questionSet.questions.map((question) => question.id).sort();
    const actual = Object.keys(answers).sort();
    if (expected.length !== actual.length || expected.some((id, index) => id !== actual[index])) {
      throw new Error('DECISION_ANSWERS_INVALID');
    }
    for (const question of questionSet.questions) {
      if (!question.answerCodes.includes(answers[question.id] ?? '')) {
        throw new Error('DECISION_ANSWERS_INVALID');
      }
    }
  };

  return {
    async startDraft(input: StartDraftInput): Promise<SqlRow> {
      assertQp(input.actorRole);
      assertUtc(input.at, 'DECISION_INVALID');
      if (!input.caseId || !input.actorAccountId) throw new Error('DECISION_INVALID');
      const version = input.version ?? (await nextVersion(input.caseId));
      const row = await draftRow(input, version);
      return (await repositories.decision_record.insert(row)).row;
    },

    async finalise(input: FinaliseInput): Promise<SqlRow> {
      assertQp(input.actorRole);
      assertUtc(input.at, 'DECISION_INVALID');
      if (!input.draftId || !input.caseId || !input.actorAccountId)
        throw new Error('DECISION_INVALID');

      const rows = await repositories.decision_record.findBy({ id: input.draftId });
      const draft = rows[0];
      if (!draft || draft.case_id !== input.caseId) throw new Error('DECISION_NOT_FOUND');
      const draftId = text(draft, 'id');
      if (draft.state === 'FINAL') return draft;
      if (draft.state !== 'DRAFT') throw new Error('DECISION_STATE');
      if (
        input.questionSetId !== questionSet.id ||
        input.questionSetVersion !== questionSet.version
      ) {
        throw new Error('DECISION_QUESTION_SET_MISMATCH');
      }
      if (typeof input.rationale !== 'string' || input.rationale.trim().length === 0) {
        throw new Error('DECISION_RATIONALE_REQUIRED');
      }
      validateAnswers(input.answers);

      let deadlineCalcId: string | null = null;
      if (input.deadlineCalcId) {
        const calculations = await repositories.deadline_calc.findBy({
          id: input.deadlineCalcId,
          case_id: input.caseId,
        });
        if (!calculations[0]) throw new Error('DECISION_CALC_MISSING');
        deadlineCalcId = input.deadlineCalcId;
      }

      const entryId = text(draft, 'awareness_entry_id');
      const snapshot = entryId.length > 0 ? await evidenceSnapshot(entryId, input.caseId) : [];
      const features = {
        productKey: input.productKey,
        questionSetId: questionSet.id,
        questionSetVersion: questionSet.version,
        answerCodes: { ...input.answers },
        reasonCodes: [...(input.featureReasonCodes ?? [])],
        notAComplaint: input.notAComplaint === true,
        provisional,
      };
      const finalRow: SqlRow = {
        ...draft,
        state: 'FINAL',
        deadline_calc_id: deadlineCalcId,
        awareness_date: provisional ? '' : text(draft, 'awareness_date'),
        awareness_basis: provisional ? UNDETERMINED : text(draft, 'awareness_basis'),
        answers_json: JSON.stringify(input.answers),
        rationale: input.rationale,
        evidence_snapshot_json: JSON.stringify(snapshot),
        features_json: JSON.stringify(features),
        decided_by: input.actorAccountId,
        decided_at: input.at,
      };
      const affected = await repositories.decision_record.updateWhere(finalRow, {
        id: draftId,
        state: 'DRAFT',
        version: draft.version ?? 0,
      });
      if (affected !== 1) {
        const current = (await repositories.decision_record.findBy({ id: draftId }))[0];
        if (current?.state === 'FINAL') return current;
        throw new Error('DECISION_CONFLICT');
      }
      await repositories.review_case.updateWhere({ state: 'DECIDED' }, { id: input.caseId });
      await audit(auditRepository, {
        actorType: 'USER',
        actorAccountId: input.actorAccountId,
        actionCode: 'DECIDE',
        targetType: 'decision_record',
        targetId: draftId,
        details: {
          caseId: input.caseId,
          version: numeric(draft, 'version'),
          questionSet: `${questionSet.id}@${questionSet.version}`,
          answerCount: Object.keys(input.answers).length,
          provisional: provisional ? 1 : 0,
        },
        at: input.at,
      });

      const outboxPorts = writebackPortsFromRepositories(repositories, () => ports.nowISO);
      const version = numeric(draft, 'version');
      for (const kind of [
        'PROPERTY',
        'SUMMARY_COMMENT',
      ] as const satisfies readonly WritebackTaskKind[]) {
        await enqueueWriteback(
          { caseId: input.caseId, kind, dedupeKey: `${input.caseId}:v${version}` },
          outboxPorts,
        );
      }
      return (await repositories.decision_record.findBy({ id: draftId }))[0]!;
    },

    async supersede(input: SupersedeInput): Promise<SqlRow> {
      assertQp(input.actorRole);
      assertUtc(input.at, 'DECISION_INVALID');
      if (!input.reasonCode) throw new Error('DECISION_REASON_REQUIRED');
      if (!SUPERSEDE_REASON_CODES.includes(input.reasonCode as SupersedeReasonCode)) {
        throw new Error('DECISION_REASON_INVALID');
      }
      const priorRows = await repositories.decision_record.findBy({ id: input.priorId });
      const prior = priorRows[0];
      if (!prior || prior.case_id !== input.caseId) throw new Error('DECISION_NOT_FOUND');
      const priorId = text(prior, 'id');
      if (prior.state !== 'FINAL') throw new Error('DECISION_STATE');
      const affected = await repositories.decision_record.updateWhere(
        { state: 'SUPERSEDED', supersede_reason: input.reasonCode },
        { id: priorId, state: 'FINAL' },
      );
      if (affected !== 1) throw new Error('DECISION_CONFLICT');

      const created = await draftRow(
        {
          id: uuid(),
          caseId: input.caseId,
          actorRole: input.actorRole,
          actorAccountId: input.actorAccountId,
          at: input.at,
          ...(input.productKey !== undefined ? { productKey: input.productKey } : {}),
          supersedesId: priorId,
          supersedeReason: input.reasonCode as SupersedeReasonCode,
          version: numeric(prior, 'version') + 1,
        },
        numeric(prior, 'version') + 1,
        prior,
      );
      const inserted = (await repositories.decision_record.insert(created)).row;
      await audit(auditRepository, {
        actorType: 'USER',
        actorAccountId: input.actorAccountId,
        actionCode: 'SUPERSEDE_DECISION',
        targetType: 'decision_record',
        targetId: text(inserted, 'id'),
        details: {
          caseId: input.caseId,
          priorId,
          version: numeric(inserted, 'version'),
          reasonCode: input.reasonCode,
        },
        at: input.at,
      });
      return inserted;
    },
  };
}
