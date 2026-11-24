import { describe, expect, it } from 'vitest';
import {
  AWARENESS_BASES,
  TRAIL_ENTRY_KINDS,
  TRAIL_ENTRY_STATUSES,
} from '../src/contracts/evidence';
import { createRepositories } from '../src/services/repositories';
import { candidateDates, createTrailService } from '../src/services/trail';
import { createSqlFake } from './support/sql-fake';

function setup() {
  const fake = createSqlFake();
  const repos = createRepositories(fake);
  const auditEvents: string[] = [];
  const service = createTrailService(repos.review_case, repos.trail_entry, {
    insert: async (event) => {
      auditEvents.push(event.actionCode);
    },
  });
  return { fake, repos, service, auditEvents };
}

const CASE_INPUT = {
  id: 'case-1',
  anchorIssueId: '10001',
  caseSeq: 1,
  origin: 'SIGNAL',
  at: '2026-11-24T12:00:00.000Z',
};

describe('P5.0 frozen trail vocabulary (IF-9)', () => {
  it('pins entry kinds, statuses and awareness bases', () => {
    expect([...TRAIL_ENTRY_KINDS]).toEqual(['RECORD', 'ENTERED']);
    expect([...TRAIL_ENTRY_STATUSES]).toEqual(['PROPOSED', 'CONFIRMED', 'REJECTED']);
    expect([...AWARENESS_BASES]).toEqual(['JIRA_RECORD_TIMESTAMP', 'ENTERED_RECEIPT_DATE']);
  });
});

describe('P5.B1 append-only trail service (C-04.2/5/7/11, I-4/I-8)', () => {
  it('creates a case insert-if-absent by anchor issue and sequence', async () => {
    const { repos, service } = setup();
    const first = await service.createCase(CASE_INPUT);
    const again = await service.createCase({ ...CASE_INPUT, id: 'other-id' });
    expect(again.id).toBe(first.id);
    expect(await repos.review_case.findBy({ id: String(first.id) })).toHaveLength(1);
  });

  it('adds RECORD and ENTERED entries with separate time fields', async () => {
    const { service } = setup();
    await service.createCase(CASE_INPUT);
    const record = await service.addRecord({
      id: 'entry-1',
      caseId: 'case-1',
      evidenceId: 'evidence-1',
      source: 'SIGNAL',
      receivedDateEntered: '2026-11-04',
      enteredBy: 'acct-reviewer',
      enteredAt: '2026-11-24T12:10:00.000Z',
    });
    const entered = await service.addEntered({
      id: 'entry-2',
      caseId: 'case-1',
      source: 'MANUAL',
      receivedDateEntered: '2026-11-01',
      enteredBy: 'acct-reviewer',
      enteredAt: '2026-11-24T12:11:00.000Z',
      enteredNote: 'Phone call note authored by a person',
      asOfDate: '2026-11-24',
    });
    expect(record).toMatchObject({
      kind: 'RECORD',
      evidence_id: 'evidence-1',
      status: 'PROPOSED',
      received_date_entered: '2026-11-04',
    });
    expect(entered).toMatchObject({
      kind: 'ENTERED',
      evidence_id: null,
      entered_note: 'Phone call note authored by a person',
    });
  });

  it('rejects a receipt date in the future and a RECORD without evidence', async () => {
    const { service } = setup();
    await service.createCase(CASE_INPUT);
    await expect(
      service.addEntered({
        id: 'entry-future',
        caseId: 'case-1',
        source: 'MANUAL',
        receivedDateEntered: '2026-11-25',
        enteredBy: 'acct-reviewer',
        enteredAt: '2026-11-24T12:11:00.000Z',
        asOfDate: '2026-11-24',
      }),
    ).rejects.toThrow('TRAIL_DATE_FUTURE');
    await expect(
      service.addRecord({
        id: 'entry-no-evidence',
        caseId: 'case-1',
        evidenceId: null,
        source: 'SIGNAL',
        enteredBy: 'acct-reviewer',
        enteredAt: '2026-11-24T12:12:00.000Z',
      }),
    ).rejects.toThrow('TRAIL_INVALID');
  });

  it('lets only a Qualified person confirm, moves the case to IN_REVIEW and audits', async () => {
    const { repos, service, auditEvents } = setup();
    await service.createCase(CASE_INPUT);
    await service.addEntered({
      id: 'entry-1',
      caseId: 'case-1',
      source: 'MANUAL',
      receivedDateEntered: '2026-11-01',
      enteredBy: 'acct-reviewer',
      enteredAt: '2026-11-24T12:11:00.000Z',
      asOfDate: '2026-11-24',
    });
    await expect(
      service.confirm({
        entryId: 'entry-1',
        actorRole: 'REVIEWER',
        actorAccountId: 'acct-reviewer',
        at: '2026-11-24T12:20:00.000Z',
      }),
    ).rejects.toThrow('TRAIL_ROLE_DENIED');

    const confirmed = await service.confirm({
      entryId: 'entry-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'acct-qp',
      at: '2026-11-24T12:21:00.000Z',
    });
    expect(confirmed).toMatchObject({
      status: 'CONFIRMED',
      decided_by: 'acct-qp',
      decided_at: '2026-11-24T12:21:00.000Z',
    });
    expect((await repos.review_case.findBy({ id: 'case-1' }))[0]?.state).toBe('IN_REVIEW');
    expect(auditEvents).toContain('CONFIRM_TRAIL_ENTRY');
  });

  it('rejects with a reason code and corrects by supersession, never by editing in place', async () => {
    const { repos, service } = setup();
    await service.createCase(CASE_INPUT);
    await service.addEntered({
      id: 'entry-1',
      caseId: 'case-1',
      source: 'MANUAL',
      receivedDateEntered: '2026-11-03',
      enteredBy: 'acct-reviewer',
      enteredAt: '2026-11-24T12:11:00.000Z',
      asOfDate: '2026-11-24',
    });
    const rejected = await service.reject({
      entryId: 'entry-1',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'acct-qp',
      at: '2026-11-24T12:22:00.000Z',
      reasonCode: 'MISTAKE',
    });
    expect(rejected).toMatchObject({ status: 'REJECTED' });

    const correction = await service.correct({
      entryId: 'entry-1',
      replacementId: 'entry-2',
      caseId: 'case-1',
      source: 'CORRECTION',
      receivedDateEntered: '2026-11-02',
      enteredBy: 'acct-qp',
      enteredAt: '2026-11-24T12:23:00.000Z',
      asOfDate: '2026-11-24',
      reasonCode: 'MISTAKE',
      actorRole: 'QUALIFIED_PERSON',
      actorAccountId: 'acct-qp',
    });
    expect(correction).toMatchObject({
      id: 'entry-2',
      supersedes_id: 'entry-1',
      status: 'PROPOSED',
    });
    const rows = await repos.trail_entry.findBy({ case_id: 'case-1' });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === 'entry-1')?.received_date_entered).toBe('2026-11-03');
  });
});

describe('P5.B2 candidate awareness dates (C-04.4/6, I-3)', () => {
  it('lists confirmed entries under both bases, earliest first, with no preselection', () => {
    const result = candidateDates(
      [
        {
          id: 'entry-later',
          status: 'CONFIRMED',
          kind: 'ENTERED',
          received_date_entered: '2026-11-10',
          entered_at: '2026-11-24T12:00:00.000Z',
        },
        {
          id: 'entry-earlier',
          status: 'CONFIRMED',
          kind: 'ENTERED',
          received_date_entered: '2026-11-01',
          entered_at: '2026-11-24T11:00:00.000Z',
        },
        { id: 'entry-proposed', status: 'PROPOSED', kind: 'ENTERED' },
      ],
      new Map(),
      null,
    );
    expect(result.preselectedEntryId).toBeNull();
    expect(result.preselectedBasis).toBeNull();
    expect(result.candidates.map((candidate) => candidate.entryId)).toEqual([
      'entry-earlier',
      'entry-later',
      'entry-earlier',
      'entry-later',
    ]);
    expect(result.candidates[0]?.basis).toBe('ENTERED_RECEIPT_DATE');
    expect(result.candidates[0]?.effectiveDate).toBe('2026-11-01');
  });

  it('converts a Jira record timestamp only when a time-zone rule is supplied', () => {
    const rows = [
      {
        id: 'entry-1',
        status: 'CONFIRMED',
        kind: 'RECORD',
        evidence_id: 'evidence-1',
        entered_at: '2026-11-24T11:00:00.000Z',
      },
    ];
    const evidence = new Map<string, Record<string, string | number | null>>([
      [
        'evidence-1',
        {
          id: 'evidence-1',
          record_created_at: '2026-11-24T23:30:00.000Z',
          strength: 'SYSTEM_UNEDITED',
        },
      ],
    ]);
    const missing = candidateDates(rows, evidence, null);
    const jiraCandidate = missing.candidates.find(
      (candidate) => candidate.basis === 'JIRA_RECORD_TIMESTAMP',
    );
    expect(jiraCandidate?.effectiveDate).toBeNull();
    expect(jiraCandidate?.reasonCode).toBe('TIMEZONE_RULE_MISSING');

    const converted = candidateDates(rows, evidence, 'Asia/Kolkata');
    expect(
      converted.candidates.find((candidate) => candidate.basis === 'JIRA_RECORD_TIMESTAMP')
        ?.effectiveDate,
    ).toBe('2026-11-25');
  });
});
