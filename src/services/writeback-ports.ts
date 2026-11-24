/**
 * P9 — build the existing P7 outbox ports from the one repository per table.
 * Shared by decision finalisation, follow-up reminders and later reconciler
 * wiring, so no second writer for `writeback_task` or `writeback_attempt`.
 * Boundary Jira operations stay unavailable: this adapter only enqueues work.
 */

import type { Repositories } from './repositories';
import type { WritebackPorts } from './writeback';

export function writebackPortsFromRepositories(
  repositories: Repositories,
  nowISO: () => string,
): WritebackPorts {
  const unsupported = async (): Promise<never> => {
    throw new Error('WRITEBACK_PORT_UNAVAILABLE');
  };
  return {
    now: nowISO,
    async findTask(caseId, kind, dedupeKey) {
      const rows = await repositories.writeback_task.findBy({
        case_id: caseId,
        kind,
        dedupe_key: dedupeKey,
      });
      return rows[0] ?? null;
    },
    async enqueueTask(row) {
      return (await repositories.writeback_task.insert(row)).row;
    },
    async updateTask(taskId, patch) {
      await repositories.writeback_task.updateWhere(patch, { id: taskId });
      return { id: taskId, ...patch };
    },
    async findPendingTasks(limit = 20) {
      const rows = await repositories.writeback_task.findBy({ status: 'PENDING' });
      return rows.slice(0, limit);
    },
    async findAttempt(taskId) {
      const rows = await repositories.writeback_attempt.findBy({ task_id: taskId });
      return rows[0] ?? null;
    },
    async saveAttempt(row) {
      await repositories.writeback_attempt.insert(row);
    },
    async findCase(caseId) {
      const rows = await repositories.review_case.findBy({ id: caseId });
      return rows[0] ?? null;
    },
    async findDecision(caseId) {
      const rows = await repositories.decision_record.findBy({ case_id: caseId });
      return rows[0] ?? null;
    },
    findCommentByMarker: unsupported,
    setEntityProperty: unsupported,
    createComment: unsupported,
  };
}
