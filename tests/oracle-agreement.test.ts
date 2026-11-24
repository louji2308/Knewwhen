/**
 * P4.B1 / P4.B3 (C-05.6, Arch §10.6): independent oracle agreement.
 *
 * Every rule parameter below is a SYNTHETIC arithmetic fixture (I-7): no
 * regulatory timing, holiday list or clock length is asserted here. Expected
 * golden values are computed by hand from the counting convention in the
 * contract, never by running the code under test (AGENTS §12.3).
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type {
  ClockRule,
  ClockUnit,
  DeadlineResult,
  DueDatePolicy,
  HolidayCalendar,
  RuleSet,
  RuleStatus,
  Weekday,
} from '../src/contracts/deadlines';
import { computeClocks } from '../src/core/deadlines';
import { oracleComputeClocks } from '../oracle/deadline-oracle';
import { SYNTHETIC_HOLIDAYS, SYNTHETIC_RULE_SET } from './support/synthetic-rules';

const SEED = 20261206;
const NUM_RUNS = 10_000;

const DAY_MS = 86_400_000;

function epochDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  dt.setUTCHours(0, 0, 0, 0);
  return Math.floor(dt.getTime() / DAY_MS);
}

function isoDay(day: number): string {
  const dt = new Date(day * DAY_MS);
  const y = String(dt.getUTCFullYear()).padStart(4, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function comparable(result: DeadlineResult): unknown {
  if (result.status === 'FAILED') {
    return {
      status: result.status,
      code: result.code,
      year: 'year' in result ? result.year : undefined,
    };
  }
  return {
    status: result.status,
    clocks: result.clocks.map((clock) => ({
      clockId: clock.clockId,
      label: clock.label,
      dueDate: clock.dueDate,
      calendarDaysRemaining: clock.calendarDaysRemaining,
      workDaysRemaining: clock.workDaysRemaining,
      state: clock.state,
      trace: clock.trace.map((entry) => ({ date: entry.date, reason: entry.reason })),
    })),
    ruleSetId: result.ruleSetId,
    ruleSetVersion: result.ruleSetVersion,
    ruleSetStatus: result.ruleSetStatus,
    preview: result.preview,
  };
}

function expectAgreement(
  awarenessISO: string,
  asOfISO: string,
  ruleSet: RuleSet,
  holidayCalendar: HolidayCalendar,
): void {
  const context = JSON.stringify({
    awarenessISO,
    asOfISO,
    ruleSetId: ruleSet.id,
    clocks: ruleSet.clocks,
    calendar: holidayCalendar,
  });
  expect(
    comparable(oracleComputeClocks(awarenessISO, asOfISO, ruleSet, holidayCalendar)),
    context,
  ).toEqual(comparable(computeClocks(awarenessISO, asOfISO, ruleSet, holidayCalendar)));
}

function clockOf(result: DeadlineResult, clockId: string) {
  if (result.status !== 'COMPUTED') {
    throw new Error(`expected COMPUTED result, got ${result.status}`);
  }
  const found = result.clocks.find((clock) => clock.clockId === clockId);
  if (found === undefined) {
    throw new Error(`clock ${clockId} is missing from the result`);
  }
  return found;
}

function changeClock(ruleSet: RuleSet, clockId: string, patch: Partial<ClockRule>): RuleSet {
  return {
    ...ruleSet,
    clocks: ruleSet.clocks.map((clock) => (clock.id === clockId ? { ...clock, ...patch } : clock)),
  };
}

describe('P4.B1/B3 — oracle agreement on golden cases (C-05.6, Arch §10.6)', () => {
  it('FX-1: 19 days before a 30-calendar-day clock leaves 11 days (C-05.5)', () => {
    const result = oracleComputeClocks(
      '2026-11-05',
      '2026-11-24',
      SYNTHETIC_RULE_SET,
      SYNTHETIC_HOLIDAYS,
    );
    expect(clockOf(result, 'CAL-30')).toEqual({
      clockId: 'CAL-30',
      label: 'Synthetic calendar clock',
      dueDate: '2026-12-05',
      calendarDaysRemaining: 11,
      workDaysRemaining: 11,
      state: 'OPEN',
      trace: [],
    });
    expectAgreement('2026-11-05', '2026-11-24', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS);
  });

  it('skips weekends when counting work days (C-05.1)', () => {
    const ruleSet = changeClock(SYNTHETIC_RULE_SET, 'WORK-4', { skipHolidays: false });
    const result = oracleComputeClocks('2026-11-25', '2026-11-25', ruleSet, SYNTHETIC_HOLIDAYS);
    expect(clockOf(result, 'WORK-4')).toEqual({
      clockId: 'WORK-4',
      label: 'Synthetic work-day clock',
      dueDate: '2026-12-01',
      calendarDaysRemaining: 6,
      workDaysRemaining: 4,
      state: 'OPEN',
      trace: [
        { date: '2026-11-28', reason: 'WEEKEND' },
        { date: '2026-11-29', reason: 'WEEKEND' },
      ],
    });
    expectAgreement('2026-11-25', '2026-11-25', ruleSet, SYNTHETIC_HOLIDAYS);
  });

  it('skips a named holiday inside the window (C-05.1, C-05.2)', () => {
    const result = oracleComputeClocks(
      '2026-11-25',
      '2026-11-25',
      SYNTHETIC_RULE_SET,
      SYNTHETIC_HOLIDAYS,
    );
    expect(clockOf(result, 'WORK-4')).toEqual({
      clockId: 'WORK-4',
      label: 'Synthetic work-day clock',
      dueDate: '2026-12-02',
      calendarDaysRemaining: 7,
      workDaysRemaining: 4,
      state: 'OPEN',
      trace: [
        { date: '2026-11-26', reason: 'HOLIDAY' },
        { date: '2026-11-28', reason: 'WEEKEND' },
        { date: '2026-11-29', reason: 'WEEKEND' },
      ],
    });
    expectAgreement('2026-11-25', '2026-11-25', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS);
  });

  it('moves a due date to the next working day and traces the adjustment (C-05.1)', () => {
    const ruleSet = changeClock(SYNTHETIC_RULE_SET, 'CAL-2-NEXT-WORKDAY', {
      skipHolidays: true,
    });
    const result = oracleComputeClocks('2026-11-24', '2026-11-24', ruleSet, SYNTHETIC_HOLIDAYS);
    expect(clockOf(result, 'CAL-2-NEXT-WORKDAY')).toEqual({
      clockId: 'CAL-2-NEXT-WORKDAY',
      label: 'Synthetic calendar clock with next-working-day policy',
      dueDate: '2026-11-27',
      calendarDaysRemaining: 3,
      workDaysRemaining: 2,
      state: 'OPEN',
      trace: [
        { date: '2026-11-26', reason: 'HOLIDAY' },
        { date: '2026-11-27', reason: 'DUE_DATE_ADJUSTED' },
      ],
    });
    expectAgreement('2026-11-24', '2026-11-24', ruleSet, SYNTHETIC_HOLIDAYS);
  });

  it('counts the awareness day when the convention says so (C-05.1)', () => {
    const ruleSet = changeClock(SYNTHETIC_RULE_SET, 'CAL-30', {
      count: 2,
      countAwarenessDay: true,
    });
    const result = oracleComputeClocks('2026-11-23', '2026-11-23', ruleSet, SYNTHETIC_HOLIDAYS);
    expect(clockOf(result, 'CAL-30').dueDate).toBe('2026-11-24');
    expectAgreement('2026-11-23', '2026-11-23', ruleSet, SYNTHETIC_HOLIDAYS);
  });

  it('reports DUE_TODAY and OVERDUE from the as-of date (C-05.2)', () => {
    const dueToday = oracleComputeClocks(
      '2026-11-05',
      '2026-12-05',
      SYNTHETIC_RULE_SET,
      SYNTHETIC_HOLIDAYS,
    );
    expect(clockOf(dueToday, 'CAL-30')).toMatchObject({
      dueDate: '2026-12-05',
      calendarDaysRemaining: 0,
      state: 'DUE_TODAY',
    });
    const overdue = oracleComputeClocks(
      '2026-11-05',
      '2026-12-07',
      SYNTHETIC_RULE_SET,
      SYNTHETIC_HOLIDAYS,
    );
    expect(clockOf(overdue, 'CAL-30')).toMatchObject({
      dueDate: '2026-12-05',
      calendarDaysRemaining: -2,
      state: 'OVERDUE',
    });
    expectAgreement('2026-11-05', '2026-12-05', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS);
    expectAgreement('2026-11-05', '2026-12-07', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS);
  });

  it('withholds an UNREVIEWED rule set (C-05.3, C-11)', () => {
    const ruleSet: RuleSet = { ...SYNTHETIC_RULE_SET, status: 'UNREVIEWED' };
    const expected = { status: 'FAILED', code: 'RULE_SET_UNREVIEWED' };
    expect(
      oracleComputeClocks('2026-11-23', '2026-11-23', ruleSet, SYNTHETIC_HOLIDAYS),
    ).toMatchObject(expected);
    expectAgreement('2026-11-23', '2026-11-23', ruleSet, SYNTHETIC_HOLIDAYS);
  });

  it('rejects an invalid date (C-11.2)', () => {
    const expected = { status: 'FAILED', code: 'DATE_INVALID' };
    expect(
      oracleComputeClocks('2026-02-30', '2026-11-23', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS),
    ).toMatchObject(expected);
    expect(
      oracleComputeClocks('2026-11-23', 'not-a-date', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS),
    ).toMatchObject(expected);
    expectAgreement('2026-02-30', '2026-11-23', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS);
    expectAgreement('2026-11-23', 'not-a-date', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS);
  });

  it('withholds a year the holiday calendar does not cover (C-05.4)', () => {
    const expected = { status: 'FAILED', code: 'HOLIDAY_DATA_MISSING', year: 2027 };
    expect(
      oracleComputeClocks('2027-01-15', '2027-01-15', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS),
    ).toMatchObject(expected);
    expectAgreement('2027-01-15', '2027-01-15', SYNTHETIC_RULE_SET, SYNTHETIC_HOLIDAYS);
  });

  it('rejects a holiday-calendar id mismatch (C-05.3)', () => {
    const ruleSet: RuleSet = { ...SYNTHETIC_RULE_SET, holidayCalendarId: 'other-calendar' };
    const expected = { status: 'FAILED', code: 'RULE_SET_INVALID' };
    expect(
      oracleComputeClocks('2026-11-23', '2026-11-23', ruleSet, SYNTHETIC_HOLIDAYS),
    ).toMatchObject(expected);
    expectAgreement('2026-11-23', '2026-11-23', ruleSet, SYNTHETIC_HOLIDAYS);
  });

  it('flags PREVIEW results without changing the arithmetic (S-05.1)', () => {
    const ruleSet: RuleSet = { ...SYNTHETIC_RULE_SET, status: 'PREVIEW' };
    const result = oracleComputeClocks('2026-11-05', '2026-11-24', ruleSet, SYNTHETIC_HOLIDAYS);
    if (result.status !== 'COMPUTED') {
      throw new Error(`expected COMPUTED result, got ${result.status}`);
    }
    expect(result.preview).toBe(true);
    expect(clockOf(result, 'CAL-30').dueDate).toBe('2026-12-05');
    expectAgreement('2026-11-05', '2026-11-24', ruleSet, SYNTHETIC_HOLIDAYS);
  });
});

const generatedDate = fc
  .integer({ min: 0, max: 364 })
  .map((offset) => isoDay(epochDay('2026-01-01') + offset));

// A set of all seven weekdays leaves no working day at all. That degenerate
// rule set makes the engine's search non-terminating (finding reported to the
// orchestrator), so generated clocks keep at least one working weekday.
const generatedWeekdays = fc
  .array(fc.integer({ min: 0, max: 6 }), { minLength: 0, maxLength: 6 })
  .map((values) => [...new Set(values)] as Weekday[]);

const generatedClocks = fc
  .array(
    fc.record({
      id: fc.constantFrom('G-1', 'G-2'),
      label: fc.constant('Synthetic generated clock'),
      unit: fc.constantFrom<ClockUnit>('CALENDAR_DAYS', 'WORK_DAYS'),
      count: fc.integer({ min: 1, max: 45 }),
      countAwarenessDay: fc.boolean(),
      nonWorkingWeekdays: generatedWeekdays,
      skipHolidays: fc.boolean(),
      dueDatePolicy: fc.constantFrom<DueDatePolicy>('KEEP', 'NEXT_WORKING_DAY'),
    }),
    { minLength: 1, maxLength: 2 },
  )
  .map((clocks) => {
    const seen = new Set<string>();
    return clocks.map((clock, index): ClockRule => {
      const id = seen.has(clock.id) ? `${clock.id}-${index}` : clock.id;
      seen.add(id);
      return { ...clock, id };
    });
  });

const generatedRuleSets = generatedClocks.map((clocks): RuleSet => ({
  id: 'generated-synthetic',
  version: 'test-v1',
  status: 'REVIEWED' as RuleStatus,
  citations: ['SYNTHETIC ARITHMETIC FIXTURE — NOT REGULATORY CONTENT'],
  holidayCalendarId: SYNTHETIC_HOLIDAYS.id,
  clocks,
}));

describe('P4.B3 — differential and metamorphic properties (C-05.6, Arch §10.6)', () => {
  it(`engine and oracle agree on ${NUM_RUNS.toLocaleString()} generated cases (seed ${SEED})`, () => {
    let runs = 0;
    fc.assert(
      fc.property(generatedDate, generatedDate, generatedRuleSets, (awareness, asOf, ruleSet) => {
        runs += 1;
        expectAgreement(awareness, asOf, ruleSet, SYNTHETIC_HOLIDAYS);
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
    expect(runs).toBe(NUM_RUNS);
  }, 60_000);

  it('next-working-day due dates never land on a non-working day (PT)', () => {
    const clocks = generatedClocks.map((all) =>
      all.map((clock): ClockRule => ({ ...clock, dueDatePolicy: 'NEXT_WORKING_DAY' })),
    );
    fc.assert(
      fc.property(generatedDate, clocks, (awareness, allClocks) => {
        for (const clock of allClocks) {
          const ruleSet: RuleSet = {
            id: 'pt-policy',
            version: 'test-v1',
            status: 'REVIEWED',
            citations: [],
            holidayCalendarId: SYNTHETIC_HOLIDAYS.id,
            clocks: [clock],
          };
          for (const implementation of [computeClocks, oracleComputeClocks]) {
            const result = implementation(awareness, awareness, ruleSet, SYNTHETIC_HOLIDAYS);
            if (result.status !== 'COMPUTED') continue;
            const due = result.clocks[0]?.dueDate;
            if (due === undefined) continue;
            const weekday = new Date(epochDay(due) * DAY_MS).getUTCDay();
            expect(clock.nonWorkingWeekdays).not.toContain(weekday);
            if (clock.skipHolidays) {
              expect(SYNTHETIC_HOLIDAYS.dates).not.toContain(due);
            }
          }
        }
      }),
      { numRuns: 2_000, seed: SEED },
    );
  });

  it('adding a holiday never moves a due date earlier (PT)', () => {
    const workClock = fc.record({
      unit: fc.constant<ClockUnit>('WORK_DAYS'),
      count: fc.integer({ min: 1, max: 45 }),
      countAwarenessDay: fc.boolean(),
      nonWorkingWeekdays: generatedWeekdays,
      dueDatePolicy: fc.constantFrom<DueDatePolicy>('KEEP', 'NEXT_WORKING_DAY'),
    });
    fc.assert(
      fc.property(
        generatedDate,
        workClock,
        fc.integer({ min: 0, max: 364 }),
        (awareness, c, offset) => {
          const clock: ClockRule = {
            id: 'PT-HOLIDAY',
            label: 'Synthetic generated clock',
            ...c,
            skipHolidays: true,
          };
          const ruleSet: RuleSet = {
            id: 'pt-holiday',
            version: 'test-v1',
            status: 'REVIEWED',
            citations: [],
            holidayCalendarId: SYNTHETIC_HOLIDAYS.id,
            clocks: [clock],
          };
          const extraDate = isoDay(epochDay('2026-01-01') + offset);
          const withExtra: HolidayCalendar = {
            ...SYNTHETIC_HOLIDAYS,
            dates: [...SYNTHETIC_HOLIDAYS.dates, extraDate],
          };
          for (const implementation of [computeClocks, oracleComputeClocks]) {
            const before = implementation(awareness, awareness, ruleSet, SYNTHETIC_HOLIDAYS);
            const after = implementation(awareness, awareness, ruleSet, withExtra);
            if (before.status !== 'COMPUTED' || after.status !== 'COMPUTED') continue;
            const beforeDay = epochDay(before.clocks[0]?.dueDate ?? '');
            const afterDay = epochDay(after.clocks[0]?.dueDate ?? '');
            expect(afterDay).toBeGreaterThanOrEqual(beforeDay);
          }
        },
      ),
      { numRuns: 2_000, seed: SEED },
    );
  });

  it('due date is non-decreasing in the awareness date (PT)', () => {
    const clocks = generatedClocks.map((all) =>
      all.map((clock): ClockRule => ({ ...clock, skipHolidays: true })),
    );
    fc.assert(
      fc.property(generatedDate, clocks, (awareness, allClocks) => {
        const next = isoDay(epochDay(awareness) + 1);
        for (const clock of allClocks) {
          const ruleSet: RuleSet = {
            id: 'pt-monotone',
            version: 'test-v1',
            status: 'REVIEWED',
            citations: [],
            holidayCalendarId: SYNTHETIC_HOLIDAYS.id,
            clocks: [clock],
          };
          for (const implementation of [computeClocks, oracleComputeClocks]) {
            const earlier = implementation(awareness, awareness, ruleSet, SYNTHETIC_HOLIDAYS);
            const later = implementation(next, next, ruleSet, SYNTHETIC_HOLIDAYS);
            if (earlier.status !== 'COMPUTED' || later.status !== 'COMPUTED') continue;
            const earlierDay = epochDay(earlier.clocks[0]?.dueDate ?? '');
            const laterDay = epochDay(later.clocks[0]?.dueDate ?? '');
            expect(laterDay).toBeGreaterThanOrEqual(earlierDay);
          }
        }
      }),
      { numRuns: 2_000, seed: SEED },
    );
  });
});
