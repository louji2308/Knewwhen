/**
 * P9.A4 — follow-ups and reminders (Arch §11.2, C-06.7, I-4/I-8). A QP owns
 * a follow-up; the daily job raises one REMINDER outbox task per case, threshold
 * and due date. Thresholds are injected operational values from rule data, not
 * regulatory content and not a hidden demo setting.
 */

import { ROLE_MATRIX, type Role } from '../contracts/authorisation';
import { audit, type AuditRepository } from './audit';
import type { Repositories } from './repositories';
import type { SqlRow } from './sql';
import { enqueueWriteback } from './writeback';
import { writebackPortsFromRepositories } from './writeback-ports';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const DAY_MS = 86_400_000;

/** Orchestrator kind-B engineering default from OI-4; not a regulatory value. */
export const reminderThresholds = Object.freeze([7, 3, 1] as const);

const isDate = (value: string): boolean => ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));

function assertUtc(value: string, code: string): void {
  if (!ISO_UTC.test(value) || Number.isNaN(Date.parse(value))) throw new Error(code);
}

const text = (row: SqlRow | null | undefined, key: string): string => {
  const value = row?.[key];
  return typeof value === 'string' ? value : '';
};

export interface FollowUpPorts {
  readonly repositories: Repositories;
  readonly nowISO: string;
}

export interface CreateFollowUpInput {
  readonly id?: string;
  readonly decisionId: string;
  readonly actorRole: Role;
  readonly actorAccountId: string;
  readonly ownerAccountId: string;
  readonly dueDate: string;
  readonly note?: string | null;
  readonly at: string;
}

export interface ReminderOutcome {
  readonly examined: number;
  readonly created: number;
}

export function createFollowUpService(ports: FollowUpPorts) {
  const { repositories } = ports;
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

  return {
    async create(input: CreateFollowUpInput): Promise<SqlRow> {
      if (!ROLE_MATRIX.DECIDE.includes(input.actorRole)) throw new Error('FOLLOW_UP_ROLE_DENIED');
      assertUtc(input.at, 'FOLLOW_UP_INVALID');
      if (!input.decisionId || !input.ownerAccountId || !isDate(input.dueDate)) {
        throw new Error('FOLLOW_UP_INVALID');
      }
      const decisions = await repositories.decision_record.findBy({ id: input.decisionId });
      const decision = decisions[0];
      if (!decision || decision.state !== 'FINAL') throw new Error('FOLLOW_UP_DECISION_MISSING');
      const row: SqlRow = {
        id: input.id ?? globalThis.crypto.randomUUID(),
        decision_id: input.decisionId,
        owner_account_id: input.ownerAccountId,
        due_date: input.dueDate,
        status: 'OPEN',
        note: input.note ?? null,
      };
      const stored = (await repositories.follow_up.insert(row)).row;
      await audit(auditRepository, {
        actorType: 'USER',
        actorAccountId: input.actorAccountId,
        actionCode: 'CREATE_FOLLOW_UP',
        targetType: 'follow_up',
        targetId: String(stored.id),
        details: {
          decisionId: input.decisionId,
          dueDate: input.dueDate,
          status: 'OPEN',
        },
        at: input.at,
      });
      return stored;
    },

    async raiseReminders(
      asOfDate: string,
      thresholds: readonly number[] = reminderThresholds,
      options: { readonly includeOverdue?: boolean } = {},
    ): Promise<ReminderOutcome> {
      if (!isDate(asOfDate)) throw new Error('REMINDER_INVALID');
      if (thresholds.some((value) => !Number.isInteger(value) || value < 0 || value > 3650)) {
        throw new Error('REMINDER_THRESHOLD_INVALID');
      }
      const outboxPorts = writebackPortsFromRepositories(repositories, () => ports.nowISO);
      const followUps = (await repositories.follow_up.findBy({ status: 'OPEN' })).filter(
        (row) => typeof row.due_date === 'string' && isDate(row.due_date),
      );
      let created = 0;
      for (const followUp of followUps) {
        const dueDate = String(followUp.due_date);
        const decisions = await repositories.decision_record.findBy({
          id: String(followUp.decision_id),
        });
        const caseId = text(decisions[0], 'case_id');
        if (caseId.length === 0) continue;
        const daysLeft = Math.round(
          (Date.parse(`${dueDate}T00:00:00.000Z`) - Date.parse(`${asOfDate}T00:00:00.000Z`)) /
            DAY_MS,
        );
        const keys: string[] = [];
        if (thresholds.includes(daysLeft) && daysLeft > 0) keys.push(`${daysLeft}:${dueDate}`);
        if (options.includeOverdue === true && daysLeft < 0) {
          keys.push(`OVERDUE:${asOfDate}:${dueDate}`);
        }
        for (const dedupeKey of keys) {
          const existing = await outboxPorts.findTask(caseId, 'REMINDER', dedupeKey);
          await enqueueWriteback({ caseId, kind: 'REMINDER', dedupeKey }, outboxPorts);
          if (existing !== null) continue;
          await audit(auditRepository, {
            actorType: 'SYSTEM',
            actorAccountId: null,
            actionCode: 'FOLLOW_UP_REMINDER',
            targetType: 'case',
            targetId: caseId,
            details: { dedupeKey, dueDate, threshold: dedupeKey.split(':')[0] ?? '' },
            at: ports.nowISO,
          });
          created += 1;
        }
      }
      return { examined: followUps.length, created };
    },
  };
}
