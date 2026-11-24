import { describe, expect, it } from 'vitest';
import { createRepositories } from '../src/services/repositories';
import { createDecisionService } from '../src/services/decision';
import { loadQuestionSet } from '../src/services/question-set';
import { createSqlFake } from './support/sql-fake';

const loadedQuestionSet = loadQuestionSet({
  id: 'qs-synthetic-v1',
  version: '1',
  status: 'REVIEWED',
  questions: [
    { id: 'Q1', prompt: 'Synthetic question one?', answerCodes: ['YES', 'NO'] },
    { id: 'Q2', prompt: 'Synthetic question two?', answerCodes: ['A', 'B'] },
  ],
});
if (loadedQuestionSet.status !== 'LOADED') throw new Error('FIXTURE_INVALID');
const questionSet = loadedQuestionSet.questionSet;

interface Fixture {
  readonly service: ReturnType<typeof createDecisionService>;
  readonly fake: ReturnType<typeof createSqlFake>;
  readonly repositories: ReturnType<typeof createRepositories>;
}

function fixture(status: 'REVIEWED' | 'UNREVIEWED' = 'REVIEWED'): Fixture {
  const fake = createSqlFake();
  const repositories = createRepositories(fake);
  const qs =
    status === 'REVIEWED' ? questionSet : { ...questionSet, status: 'UNREVIEWED' as const };
  const service = createDecisionService({
    repositories,
    questionSet: qs,
    nowISO: '2026-11-24T12:00:00.000Z',
  });
  return { service, fake, repositories };
}

async function seedValidEvidence(fx: Fixture): Promise<void> {
  await fx.repositories.evidence_item.insert({
    id: 'ev-1',
    issue_id: 'ISSUE-1',
    segment_key: 'description',
    author_account_id: 'account-1',
    record_created_at: '2026-11-01T00:00:00.000Z',
    record_updated_at: '2026-11-01T00:00:00.000Z',
    span_start: 0,
    span_len: 12,
    span_hash: 'a'.repeat(64),
    body_hash: 'b'.repeat(64),
    hash_key_id: 'key-1',
    normalisation_version: 'normalise-v1',
    captured_by: 'RULE_MATCH',
    strength: 'SYSTEM_UNEDITED',
    validation_status: 'VALID',
    last_validated_at: '2026-11-24T11:00:00.000Z',
  });
  await fx.repositories.trail_entry.insert({
    id: 'entry-1',
    case_id: 'case-1',
    kind: 'RECORD',
    evidence_id: 'ev-1',
    source: 'RULE_MATCH',
    received_date_entered: null,
    entered_by: 'SYSTEM',
    entered_at: '2026-11-01T00:00:00.000Z',
    entered_note: null,
    status: 'CONFIRMED',
    decided_by: 'qp-1',
    decided_at: '2026-11-02T00:00:00.000Z',
    supersedes_id: null,
  });
}

describe('P9.A3 decision service (C-06.1-12, C-07.3/8, I-4/I-5/I-8)', () => {
  it('allows only a QP to draft and finalise, with no suggested answers', async () => {
    const fx = fixture();
    await seedValidEvidence(fx);
    await expect(
      fx.service.startDraft({
        id: 'draft-1',
        caseId: 'case-1',
        actorRole: 'REVIEWER',
        actorAccountId: 'reviewer-1',
        at: '2026-11-24T12:00:00.000Z',
      }),
    ).rejects.toThrow('DECISION_ROLE_DENIED');

    const draft = await fx.service.startDraft({
      id: 'draft-1',
      caseId: 'case-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'qp-1',
      at: '2026-11-24T12:00:00.000Z',
      awarenessEntryId: 'entry-1',
      awarenessDate: '2026-11-01',
      awarenessBasis: 'JIRA_RECORD_TIMESTAMP',
      productKey: 'SYNTHETIC_PRODUCT',
    });
    expect(draft).toMatchObject({ state: 'DRAFT', version: 1, awareness_date: '2026-11-01' });
    expect(fx.fake.dump('decision_record')[0]?.answers_json).toBe('{}');
  });

  it('finalises once, enqueues write-back tasks and stays idempotent', async () => {
    const fx = fixture();
    await seedValidEvidence(fx);
    await fx.service.startDraft({
      id: 'draft-1',
      caseId: 'case-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'qp-1',
      at: '2026-11-24T12:00:00.000Z',
      awarenessEntryId: 'entry-1',
      awarenessDate: '2026-11-01',
      awarenessBasis: 'JIRA_RECORD_TIMESTAMP',
      productKey: 'SYNTHETIC_PRODUCT',
    });
    const input = {
      draftId: 'draft-1',
      caseId: 'case-1',
      actorRole: 'QUALIFIED_PERSON' as const,
      actorAccountId: 'qp-1',
      at: '2026-11-24T12:30:00.000Z',
      questionSetId: 'qs-synthetic-v1',
      questionSetVersion: '1',
      answers: { Q1: 'YES', Q2: 'B' },
      rationale: 'Human-authored rationale only.',
      productKey: 'SYNTHETIC_PRODUCT',
      featureReasonCodes: ['SAME_PRODUCT'],
    };
    const final = await fx.service.finalise(input);
    const again = await fx.service.finalise(input);
    expect(final).toMatchObject({ state: 'FINAL', version: 1, decided_by: 'qp-1' });
    expect(again.id).toBe(final.id);
    expect(fx.fake.dump('decision_record')).toHaveLength(1);
    const tasks = fx.fake.dump('writeback_task');
    expect(tasks.map((task) => task.kind).sort()).toEqual(['PROPERTY', 'SUMMARY_COMMENT']);
    const features = JSON.parse(String(final.features_json)) as Record<string, unknown>;
    expect(features).toMatchObject({ productKey: 'SYNTHETIC_PRODUCT', provisional: false });
    expect(JSON.stringify(features)).not.toContain('rationale');
    expect(JSON.stringify(features)).not.toContain('Human-authored');
    expect(fx.fake.dump('audit_event').length).toBeGreaterThan(0);
  });

  it('blocks finalising when cited evidence is degraded', async () => {
    const fx = fixture();
    await seedValidEvidence(fx);
    await fx.repositories.evidence_item.updateWhere(
      { validation_status: 'MODIFIED' },
      { id: 'ev-1' },
    );
    await fx.service.startDraft({
      id: 'draft-1',
      caseId: 'case-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'qp-1',
      at: '2026-11-24T12:00:00.000Z',
      awarenessEntryId: 'entry-1',
      awarenessDate: '2026-11-01',
      awarenessBasis: 'JIRA_RECORD_TIMESTAMP',
      productKey: 'SYNTHETIC_PRODUCT',
    });
    await expect(
      fx.service.finalise({
        draftId: 'draft-1',
        caseId: 'case-1',
        actorRole: 'QUALIFIED_PERSON',
        actorAccountId: 'qp-1',
        at: '2026-11-24T12:30:00.000Z',
        questionSetId: 'qs-synthetic-v1',
        questionSetVersion: '1',
        answers: { Q1: 'YES', Q2: 'A' },
        rationale: 'Human-authored rationale only.',
        productKey: 'SYNTHETIC_PRODUCT',
      }),
    ).rejects.toThrow('DECISION_EVIDENCE_DEGRADED');
    expect(fx.fake.dump('writeback_task')).toHaveLength(0);
  });

  it('records an undated provisional decision under unreviewed rules', async () => {
    const fx = fixture('UNREVIEWED');
    await fx.service.startDraft({
      id: 'draft-1',
      caseId: 'case-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'qp-1',
      at: '2026-11-24T12:00:00.000Z',
      productKey: 'SYNTHETIC_PRODUCT',
    });
    const final = await fx.service.finalise({
      draftId: 'draft-1',
      caseId: 'case-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'qp-1',
      at: '2026-11-24T12:30:00.000Z',
      questionSetId: 'qs-synthetic-v1',
      questionSetVersion: '1',
      answers: { Q1: 'NO', Q2: 'A' },
      rationale: 'No complaint under unreviewed rules.',
      productKey: 'SYNTHETIC_PRODUCT',
      notAComplaint: true,
    });
    expect(final).toMatchObject({
      state: 'FINAL',
      awareness_date: '',
      awareness_basis: 'UNDETERMINED',
    });
    expect(JSON.parse(String(final.features_json))).toMatchObject({
      provisional: true,
      notAComplaint: true,
    });
  });

  it('supersedes with a mandatory reason and keeps the earlier version readable', async () => {
    const fx = fixture();
    await fx.repositories.decision_record.insert({
      id: 'old-1',
      case_id: 'case-1',
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
      decided_at: '2026-11-20T00:00:00.000Z',
      supersedes_id: null,
      supersede_reason: null,
    });
    await expect(
      fx.service.supersede({
        caseId: 'case-1',
        priorId: 'old-1',
        actorRole: 'QUALIFIED_PERSON',
        actorAccountId: 'qp-1',
        at: '2026-11-24T12:00:00.000Z',
        reasonCode: '',
      }),
    ).rejects.toThrow('DECISION_REASON_REQUIRED');
    const next = await fx.service.supersede({
      caseId: 'case-1',
      priorId: 'old-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'qp-1',
      at: '2026-11-24T12:00:00.000Z',
      reasonCode: 'RULE_SET_CHANGE',
      productKey: 'SYNTHETIC_PRODUCT',
    });
    expect(next).toMatchObject({ version: 2, state: 'DRAFT', supersedes_id: 'old-1' });
    expect(fx.fake.dump('decision_record')[0]).toMatchObject({ state: 'SUPERSEDED' });
  });
});
