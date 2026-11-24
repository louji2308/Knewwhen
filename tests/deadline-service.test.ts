import { describe, expect, it } from 'vitest';
import { createRepositories } from '../src/services/repositories';
import { computeDeadlines } from '../src/services/deadline';
import { loadRuleSet } from '../src/core/rules-loader';
import { createSqlFake } from './support/sql-fake';
import { SYNTHETIC_HOLIDAYS, SYNTHETIC_RULE_SET } from './support/synthetic-rules';

const loaded = loadRuleSet(SYNTHETIC_RULE_SET);
if (loaded.status !== 'LOADED') throw new Error('FIXTURE_INVALID');

const bundle = {
  ruleSet: loaded.ruleSet,
  digest: loaded.digest,
  regime: 'SYNTHETIC_REGIME',
  calendar: SYNTHETIC_HOLIDAYS,
  tzRuleId: 'SYNTHETIC_TZ_RULE',
};

const candidates = [
  {
    entryId: 'entry-1',
    basis: 'JIRA_RECORD_TIMESTAMP' as const,
    effectiveDate: '2026-11-24',
    reasonCode: null,
  },
  {
    entryId: 'entry-2',
    basis: 'ENTERED_RECEIPT_DATE' as const,
    effectiveDate: '2026-11-05',
    reasonCode: null,
  },
  {
    entryId: 'entry-3',
    basis: 'ENTERED_RECEIPT_DATE' as const,
    effectiveDate: null,
    reasonCode: 'RECEIPT_DATE_MISSING',
  },
];

describe('P9.A1 deadline service (C-05.8-10, C-11, I-7)', () => {
  it('calculates and appends one row per usable candidate date', async () => {
    const fake = createSqlFake();
    const repositories = createRepositories(fake);
    const outcome = await computeDeadlines(
      {
        caseId: 'case-1',
        asOfDate: '2026-11-24',
        nowISO: '2026-11-24T12:00:00.000Z',
      },
      candidates,
      bundle,
      repositories.deadline_calc,
    );

    expect(outcome.status).toBe('COMPUTED');
    if (outcome.status !== 'COMPUTED') return;
    expect(outcome.results).toHaveLength(2);
    expect(outcome.results[0]?.clocks.find((clock) => clock.clockId === 'CAL-30')).toMatchObject({
      dueDate: '2026-12-24',
      calendarDaysRemaining: 30,
    });
    expect(outcome.results[0]?.clocks.find((clock) => clock.clockId === 'WORK-4')).toMatchObject({
      dueDate: '2026-12-01',
    });
    expect(outcome.results[0]).toMatchObject({
      ruleSetStatus: 'REVIEWED',
      preview: false,
    });
    expect(outcome.missing).toMatchObject([
      { entryId: 'entry-3', reasonCode: 'RECEIPT_DATE_MISSING' },
    ]);
    expect(fake.dump('deadline_calc')).toHaveLength(2);
    const stored = fake.dump('deadline_calc')[0]!;
    expect(stored).toMatchObject({
      case_id: 'case-1',
      rule_set_id: loaded.ruleSet.id,
      rule_set_version: loaded.ruleSet.version,
      rule_set_digest: loaded.digest,
      tz_rule_id: 'SYNTHETIC_TZ_RULE',
      as_of_date: '2026-11-24',
    });
    expect(JSON.stringify(stored)).not.toContain('sensitive');
  });

  it('replays without appending duplicate rows', async () => {
    const fake = createSqlFake();
    const repositories = createRepositories(fake);
    const input = {
      caseId: 'case-1',
      asOfDate: '2026-11-24',
      nowISO: '2026-11-24T12:00:00.000Z',
    } as const;
    await computeDeadlines(input, candidates, bundle, repositories.deadline_calc);
    await computeDeadlines(input, candidates, bundle, repositories.deadline_calc);
    expect(fake.dump('deadline_calc')).toHaveLength(2);
  });

  it('does not call the engine or show numbers under unreviewed rules', async () => {
    const fake = createSqlFake();
    const repositories = createRepositories(fake);
    const unreviewed = { ...bundle, ruleSet: { ...bundle.ruleSet, status: 'UNREVIEWED' as const } };
    const outcome = await computeDeadlines(
      {
        caseId: 'case-1',
        asOfDate: '2026-11-24',
        nowISO: '2026-11-24T12:00:00.000Z',
      },
      candidates,
      unreviewed,
      repositories.deadline_calc,
    );
    expect(outcome.status).toBe('BLOCKED');
    if (outcome.status !== 'BLOCKED') return;
    expect(outcome.code).toBe('RULE_SET_UNREVIEWED');
    expect(outcome.results).toEqual([]);
    expect(fake.dump('deadline_calc')).toHaveLength(0);
  });

  it('marks preview calculations without treating them as reviewed', async () => {
    const fake = createSqlFake();
    const repositories = createRepositories(fake);
    const preview = { ...bundle, ruleSet: { ...bundle.ruleSet, status: 'PREVIEW' as const } };
    const outcome = await computeDeadlines(
      {
        caseId: 'case-1',
        asOfDate: '2026-11-24',
        nowISO: '2026-11-24T12:00:00.000Z',
      },
      [candidates[0]!],
      preview,
      repositories.deadline_calc,
    );
    expect(outcome).toMatchObject({ status: 'COMPUTED', preview: true });
  });
});
