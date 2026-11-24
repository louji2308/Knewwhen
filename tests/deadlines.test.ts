import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeClocks, type DeadlineFailure } from '../src/core/deadlines';
import { loadHolidayCalendar, loadRuleSet } from '../src/core/rules-loader';
import { SYNTHETIC_HOLIDAYS, SYNTHETIC_RULE_SET } from './support/synthetic-rules';

const rules = loadRuleSet(SYNTHETIC_RULE_SET);
const holidays = loadHolidayCalendar(SYNTHETIC_HOLIDAYS);
if (rules.status !== 'LOADED' || holidays.status !== 'LOADED') throw new Error('fixture invalid');

const clocks = (
  awareness: string,
  asOf: string,
  ruleSet = rules.ruleSet,
  calendar = holidays.calendar,
) => computeClocks(awareness, asOf, ruleSet, calendar);

describe('P4.A2/A3 deadline engine and IF-4 (Arch §10, I-7)', () => {
  it('reproduces the FX-1 arithmetic with a synthetic 30-day calendar clock', () => {
    const result = clocks('2026-11-05', '2026-11-24');
    expect(result.status).toBe('COMPUTED');
    if (result.status !== 'COMPUTED') return;
    const clock = result.clocks.find((item) => item.clockId === 'CAL-30')!;
    expect(clock).toMatchObject({
      dueDate: '2026-12-05',
      calendarDaysRemaining: 11,
      state: 'OPEN',
    });
    expect(result.ruleSetVersion).toBe('test-v1');
    expect(result.preview).toBe(false);
  });

  it('skips weekends in a work-day clock and traces every skipped day', () => {
    const result = clocks('2026-11-23', '2026-11-24');
    if (result.status !== 'COMPUTED') throw new Error('expected COMPUTED');
    const clock = result.clocks.find((item) => item.clockId === 'WORK-4')!;
    expect(clock.dueDate).toBe('2026-11-30');
    expect(clock.trace).toEqual([
      { date: '2026-11-26', reason: 'HOLIDAY' },
      { date: '2026-11-28', reason: 'WEEKEND' },
      { date: '2026-11-29', reason: 'WEEKEND' },
    ]);
  });

  it('skips a named holiday inside the window and records it in the trace', () => {
    const result = clocks('2026-11-23', '2026-11-24');
    if (result.status !== 'COMPUTED') throw new Error('expected COMPUTED');
    const clock = result.clocks.find((item) => item.clockId === 'WORK-4')!;
    expect(
      clock.trace.some((entry) => entry.date === '2026-11-26' && entry.reason === 'HOLIDAY'),
    ).toBe(true);
  });

  it('moves a due date off a non-working day only when the rule says so', () => {
    const result = clocks('2026-11-27', '2026-11-27');
    if (result.status !== 'COMPUTED') throw new Error('expected COMPUTED');
    const clock = result.clocks.find((item) => item.clockId === 'CAL-2-NEXT-WORKDAY')!;
    expect(clock.dueDate).toBe('2026-11-30');
    expect(clock.trace.some((entry) => entry.reason === 'DUE_DATE_ADJUSTED')).toBe(true);
  });

  it('reports DUE_TODAY and OVERDUE from the supplied as-of date, with no clock read', () => {
    const today = clocks('2026-11-05', '2026-12-05');
    if (today.status !== 'COMPUTED') throw new Error('expected COMPUTED');
    expect(today.clocks[0]!.state).toBe('DUE_TODAY');
    const overdue = clocks('2026-11-05', '2026-12-06');
    if (overdue.status !== 'COMPUTED') throw new Error('expected COMPUTED');
    expect(overdue.clocks[0]!.state).toBe('OVERDUE');
    expect(overdue.clocks[0]!.calendarDaysRemaining).toBe(-1);
  });

  it('withholds a work-day deadline when holiday data for a year is missing', () => {
    const result = clocks('2025-12-29', '2026-01-02') as DeadlineFailure;
    expect(result.status).toBe('FAILED');
    expect(result.code).toBe('HOLIDAY_DATA_MISSING');
    expect(result.year).toBe(2025);
  });

  it('rejects UNREVIEWED rule sets and flags PREVIEW sets without inventing a verdict', () => {
    const unreviewed = { ...SYNTHETIC_RULE_SET, status: 'UNREVIEWED' };
    const loaded = loadRuleSet(unreviewed);
    if (loaded.status !== 'LOADED') throw new Error('expected LOADED');
    const result = clocks('2026-11-05', '2026-11-24', loaded.ruleSet);
    expect(result).toMatchObject({ status: 'FAILED', code: 'RULE_SET_UNREVIEWED' });

    const preview = loadRuleSet({ ...SYNTHETIC_RULE_SET, status: 'PREVIEW' });
    if (preview.status !== 'LOADED') throw new Error('expected LOADED');
    const previewResult = clocks('2026-11-05', '2026-11-24', preview.ruleSet);
    expect(previewResult.status).toBe('COMPUTED');
    if (previewResult.status === 'COMPUTED') expect(previewResult.preview).toBe(true);
  });

  it('rejects malformed dates instead of guessing a day number', () => {
    expect(clocks('2026-02-30', '2026-11-24')).toMatchObject({
      status: 'FAILED',
      code: 'DATE_INVALID',
    });
  });

  it('fails closed on a clock with no working weekdays before any day walk', () => {
    const allDays = [0, 1, 2, 3, 4, 5, 6] as const;
    const raw = {
      ...SYNTHETIC_RULE_SET,
      clocks: [{ ...SYNTHETIC_RULE_SET.clocks[0], nonWorkingWeekdays: allDays }],
    };
    expect(loadRuleSet(raw)).toEqual({ status: 'FAILED', code: 'RULE_SET_INVALID' });

    // A forged rule set that bypasses the loader must still fail closed; an
    // all-non-working clock otherwise makes the day walk non-terminating.
    const forged = {
      ...rules.ruleSet,
      clocks: [{ ...rules.ruleSet.clocks[0]!, nonWorkingWeekdays: allDays }],
    };
    for (const asOf of ['2026-11-23', '2026-12-23']) {
      expect(computeClocks('2026-11-23', asOf, forged, holidays.calendar)).toMatchObject({
        status: 'FAILED',
        code: 'RULE_SET_INVALID',
      });
    }
  });

  it('contains no clock read, I/O or Forge import in the pure engine', () => {
    const source = readFileSync(new URL('../src/core/deadlines.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/Date\.now\(|new Date\(\)|fetch\(|@forge\//u);
  });
});
