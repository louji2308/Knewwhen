/**
 * P4.A1 — IF-5: strict rule-data loader (C-05.3/9, I-7). No regulatory content
 * lives here. Unknown parameters are rejected, never approximated. The digest
 * is computed from canonical JSON so every calculation can cite the exact data.
 */

import { createHash } from 'node:crypto';
import {
  CLOCK_UNITS,
  DUE_DATE_POLICIES,
  RULE_STATUSES,
  type ClockRule,
  type HolidayCalendar,
  type RuleSet,
  type Weekday,
} from '../contracts/deadlines';

export type LoadedRuleSet =
  | { readonly status: 'LOADED'; readonly ruleSet: RuleSet; readonly digest: string }
  | { readonly status: 'FAILED'; readonly code: 'RULE_SET_INVALID' };

export type LoadedHolidayCalendar =
  | { readonly status: 'LOADED'; readonly calendar: HolidayCalendar }
  | { readonly status: 'FAILED'; readonly code: 'RULE_SET_INVALID' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));

function parseClock(value: unknown): ClockRule | null {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'count',
      'countAwarenessDay',
      'dueDatePolicy',
      'id',
      'label',
      'nonWorkingWeekdays',
      'skipHolidays',
      'unit',
    ]) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.label !== 'string' ||
    value.label.length === 0 ||
    typeof value.unit !== 'string' ||
    !CLOCK_UNITS.includes(value.unit as ClockRule['unit']) ||
    typeof value.count !== 'number' ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 3650 ||
    typeof value.countAwarenessDay !== 'boolean' ||
    typeof value.skipHolidays !== 'boolean' ||
    typeof value.dueDatePolicy !== 'string' ||
    !DUE_DATE_POLICIES.includes(value.dueDatePolicy as ClockRule['dueDatePolicy']) ||
    !Array.isArray(value.nonWorkingWeekdays) ||
    value.nonWorkingWeekdays.length > 7 ||
    !value.nonWorkingWeekdays.every(
      (day) => typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6,
    )
  ) {
    return null;
  }
  const nonWorkingWeekdays = [...new Set(value.nonWorkingWeekdays as Weekday[])].sort();
  // An all-non-working clock would never reach a due date; reject at load.
  if (nonWorkingWeekdays.length === 7) return null;
  return {
    id: value.id,
    label: value.label,
    unit: value.unit as ClockRule['unit'],
    count: value.count,
    countAwarenessDay: value.countAwarenessDay,
    nonWorkingWeekdays,
    skipHolidays: value.skipHolidays,
    dueDatePolicy: value.dueDatePolicy as ClockRule['dueDatePolicy'],
  };
}

export function loadRuleSet(raw: unknown): LoadedRuleSet {
  if (
    !isRecord(raw) ||
    !exactKeys(raw, ['citations', 'clocks', 'holidayCalendarId', 'id', 'status', 'version']) ||
    typeof raw.id !== 'string' ||
    raw.id.length === 0 ||
    typeof raw.version !== 'string' ||
    raw.version.length === 0 ||
    typeof raw.status !== 'string' ||
    !RULE_STATUSES.includes(raw.status as RuleSet['status']) ||
    !Array.isArray(raw.citations) ||
    raw.citations.length === 0 ||
    !raw.citations.every((citation) => typeof citation === 'string' && citation.length > 0) ||
    !(raw.holidayCalendarId === null || typeof raw.holidayCalendarId === 'string') ||
    !Array.isArray(raw.clocks) ||
    raw.clocks.length === 0
  ) {
    return { status: 'FAILED', code: 'RULE_SET_INVALID' };
  }

  const clocks: ClockRule[] = [];
  const ids = new Set<string>();
  for (const entry of raw.clocks) {
    const clock = parseClock(entry);
    if (!clock || ids.has(clock.id)) return { status: 'FAILED', code: 'RULE_SET_INVALID' };
    ids.add(clock.id);
    clocks.push(clock);
  }

  const ruleSet: RuleSet = {
    id: raw.id,
    version: raw.version,
    status: raw.status as RuleSet['status'],
    citations: raw.citations as readonly string[],
    holidayCalendarId: raw.holidayCalendarId as string | null,
    clocks,
  };
  const digest = createHash('sha256').update(JSON.stringify(ruleSet)).digest('hex').toUpperCase();
  return { status: 'LOADED', ruleSet, digest };
}

export function loadHolidayCalendar(raw: unknown): LoadedHolidayCalendar {
  if (
    !isRecord(raw) ||
    !exactKeys(raw, ['dates', 'id', 'year']) ||
    typeof raw.id !== 'string' ||
    raw.id.length === 0 ||
    typeof raw.year !== 'number' ||
    !Number.isInteger(raw.year) ||
    raw.year < 1900 ||
    raw.year > 2100 ||
    !Array.isArray(raw.dates) ||
    raw.dates.length === 0 ||
    !raw.dates.every((date) => isDate(date) && date.startsWith(`${raw.year}-`))
  ) {
    return { status: 'FAILED', code: 'RULE_SET_INVALID' };
  }
  return {
    status: 'LOADED',
    calendar: {
      id: raw.id,
      year: raw.year,
      dates: [...new Set(raw.dates as string[])].sort(),
    },
  };
}
