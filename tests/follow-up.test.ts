import { describe, expect, it } from 'vitest';
import { createRepositories } from '../src/services/repositories';
import { createFollowUpService, reminderThresholds } from '../src/services/follow-up';
import { createSqlFake } from './support/sql-fake';
import type { SqlRow } from '../src/services/sql';

function fixture() {
  const fake = createSqlFake();
  const repositories = createRepositories(fake);
  const service = createFollowUpService({
    repositories,
    nowISO: '2026-11-24T12:00:00.000Z',
  });
  return { fake, repositories, service };
}

async function seedDecision(
  fx: ReturnType<typeof fixture>,
  id: string,
  caseId: string,
): Promise<void> {
  const row: SqlRow = {
    id,
    case_id: caseId,
    version: 1,
    state: 'FINAL',
    awareness_entry_id: '',
    awareness_date: '',
    awareness_basis: 'UNDETERMINED',
    deadline_calc_id: null,
    question_set_id: 'qs-synthetic-v1',
    question_set_version: '1',
    answers_json: '{}',
    rationale: null,
    evidence_snapshot_json: '[]',
    features_json: '{}',
    decided_by: 'qp-1',
    decided_at: '2026-11-24T11:00:00.000Z',
    supersedes_id: null,
    supersede_reason: null,
  };
  await fx.repositories.decision_record.insert(row);
}

describe('P9.A4 follow-ups and reminders (C-06.7, I-4/I-8)', () => {
  it('allows only a QP to create an owned follow-up', async () => {
    const fx = fixture();
    await seedDecision(fx, 'decision-1', 'case-1');
    await expect(
      fx.service.create({
        id: 'follow-1',
        decisionId: 'decision-1',
        actorRole: 'REVIEWER',
        actorAccountId: 'reviewer-1',
        ownerAccountId: 'qp-1',
        dueDate: '2026-12-01',
        note: 'Human-authored follow-up.',
        at: '2026-11-24T12:00:00.000Z',
      }),
    ).rejects.toThrow('FOLLOW_UP_ROLE_DENIED');

    const row = await fx.service.create({
      id: 'follow-1',
      decisionId: 'decision-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'qp-1',
      ownerAccountId: 'qp-1',
      dueDate: '2026-12-01',
      note: 'Human-authored follow-up.',
      at: '2026-11-24T12:00:00.000Z',
    });
    expect(row).toMatchObject({
      decision_id: 'decision-1',
      owner_account_id: 'qp-1',
      due_date: '2026-12-01',
      status: 'OPEN',
    });
    expect(JSON.stringify(fx.fake.dump('audit_event'))).not.toContain('Human-authored');
  });

  it('creates at most one reminder per case, threshold and due date', async () => {
    const fx = fixture();
    await seedDecision(fx, 'decision-1', 'case-1');
    await fx.repositories.follow_up.insert({
      id: 'follow-1',
      decision_id: 'decision-1',
      owner_account_id: 'qp-1',
      due_date: '2026-12-01',
      status: 'OPEN',
      note: null,
    });
    await fx.repositories.follow_up.insert({
      id: 'follow-2',
      decision_id: 'decision-1',
      owner_account_id: 'qp-1',
      due_date: '2026-12-01',
      status: 'OPEN',
      note: null,
    });
    const first = await fx.service.raiseReminders('2026-11-24', reminderThresholds);
    const second = await fx.service.raiseReminders('2026-11-24', reminderThresholds);
    expect(first).toMatchObject({ created: 1, examined: 2 });
    expect(second).toMatchObject({ created: 0, examined: 2 });
    const tasks = fx.fake.dump('writeback_task');
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      kind: 'REMINDER',
      case_id: 'case-1',
      dedupe_key: '7:2026-12-01',
      status: 'PENDING',
    });
    expect(JSON.stringify(tasks[0])).not.toContain('Human-authored');
  });
});
