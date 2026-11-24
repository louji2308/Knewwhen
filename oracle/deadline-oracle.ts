/**
 * P4.B1 (C-05.6, Arch §10.6) — INDEPENDENT TEST ORACLE. Dev-only: lives outside
 * `src/`, is never bundled into the app and shares no runtime code, date helper
 * or rule loader with the engine. Its only import from the engine side is the
 * type contract.
 *
 * Technique is deliberately different from the engine's integer day-number
 * arithmetic: this implementation walks one calendar day at a time from the
 * awareness date, keeps an explicit qualifying-day counter and asks the
 * built-in UTC `Date` for each day's weekday.
 *
 * All rule parameters supplied to it are synthetic arithmetic fixtures (I-7).
 * It contains no regulatory reading and produces no compliance statement.
 */

import type {
  ClockResult,
  ClockRule,
  ClockTraceEntry,
  DeadlineResult,
  HolidayCalendar,
  RuleSet,
  TraceReason,
} from '../src/contracts/deadlines';

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function leapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function monthLength(year: number, month: number): number {
  if (month === 2) return leapYear(year) ? 29 : 28;
  if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
  return 31;
}

/** Strict ISO calendar date -> day number, or null for anything malformed. */
function readDate(iso: string): number | null {
  const parts = ISO_DATE.exec(iso);
  if (parts === null) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  if (month < 1 || month > 12 || day < 1 || day > monthLength(year, month)) return null;
  const cursor = new Date(0);
  cursor.setUTCFullYear(year, month - 1, day);
  cursor.setUTCHours(0, 0, 0, 0);
  return Math.floor(cursor.getTime() / MS_PER_DAY);
}

function writeDate(day: number): string {
  const cursor = new Date(day * MS_PER_DAY);
  const year = String(cursor.getUTCFullYear()).padStart(4, '0');
  const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(cursor.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

function yearOf(day: number): number {
  return new Date(day * MS_PER_DAY).getUTCFullYear();
}

/**
 * Reason this day is excluded from a work-day count, or null when it counts.
 * A weekend weekday takes precedence over a holiday: the day is already
 * excluded before the holiday question is asked.
 */
function exclusion(
  clock: ClockRule,
  day: number,
  holidays: ReadonlySet<string>,
): TraceReason | null {
  const weekday = new Date(day * MS_PER_DAY).getUTCDay();
  if (clock.nonWorkingWeekdays.some((nonWorking) => nonWorking === weekday)) return 'WEEKEND';
  if (clock.skipHolidays && holidays.has(writeDate(day))) return 'HOLIDAY';
  return null;
}

function countsForClock(clock: ClockRule, day: number, holidays: ReadonlySet<string>): boolean {
  if (clock.unit === 'CALENDAR_DAYS') return true;
  return exclusion(clock, day, holidays) === null;
}

function computeClock(
  clock: ClockRule,
  awarenessDay: number,
  asOfDay: number,
  holidays: ReadonlySet<string>,
): ClockResult {
  const trace: ClockTraceEntry[] = [];
  let qualifying = 0;
  let dueDay = awarenessDay;

  if (clock.countAwarenessDay) {
    if (countsForClock(clock, awarenessDay, holidays)) {
      qualifying = 1;
    } else {
      const reason = exclusion(clock, awarenessDay, holidays);
      if (reason !== null) trace.push({ date: writeDate(awarenessDay), reason });
    }
    if (qualifying === clock.count) dueDay = awarenessDay;
  }

  for (let day = awarenessDay + 1; qualifying < clock.count; day += 1) {
    if (countsForClock(clock, day, holidays)) {
      qualifying += 1;
    } else {
      const reason = exclusion(clock, day, holidays);
      if (reason !== null) trace.push({ date: writeDate(day), reason });
    }
    dueDay = day;
  }

  if (clock.dueDatePolicy === 'NEXT_WORKING_DAY') {
    let candidate = dueDay;
    let reason = exclusion(clock, candidate, holidays);
    while (reason !== null) {
      trace.push({ date: writeDate(candidate), reason });
      candidate += 1;
      reason = exclusion(clock, candidate, holidays);
    }
    if (candidate !== dueDay) {
      dueDay = candidate;
      trace.push({ date: writeDate(dueDay), reason: 'DUE_DATE_ADJUSTED' });
    }
  }

  // Work days left are counted between the two dates with the as-of day as the
  // boundary: forward from as-of (exclusive) to due (inclusive), or, when the
  // due date has passed, backward from due (exclusive) to as-of (inclusive)
  // and negated. A non-working as-of day contributes nothing.
  let workDaysRemaining = 0;
  if (dueDay > asOfDay) {
    for (let day = asOfDay + 1; day <= dueDay; day += 1) {
      if (exclusion(clock, day, holidays) === null) workDaysRemaining += 1;
    }
  } else if (dueDay < asOfDay) {
    let elapsed = 0;
    for (let day = dueDay + 1; day <= asOfDay; day += 1) {
      if (exclusion(clock, day, holidays) === null) elapsed += 1;
    }
    // Negating the count preserves -0 when no work day elapsed; the engine's
    // observable value does the same.
    workDaysRemaining = -elapsed;
  }

  return {
    clockId: clock.id,
    label: clock.label,
    dueDate: writeDate(dueDay),
    calendarDaysRemaining: dueDay - asOfDay,
    workDaysRemaining,
    state: dueDay === asOfDay ? 'DUE_TODAY' : dueDay < asOfDay ? 'OVERDUE' : 'OPEN',
    trace,
  };
}

export function oracleComputeClocks(
  awarenessISO: string,
  asOfISO: string,
  ruleSet: RuleSet,
  holidayCalendar: HolidayCalendar,
): DeadlineResult {
  const awarenessDay = readDate(awarenessISO);
  const asOfDay = readDate(asOfISO);
  if (awarenessDay === null || asOfDay === null) {
    return { status: 'FAILED', code: 'DATE_INVALID' };
  }

  if (ruleSet.holidayCalendarId !== null && ruleSet.holidayCalendarId !== holidayCalendar.id) {
    return { status: 'FAILED', code: 'RULE_SET_INVALID' };
  }

  if (ruleSet.status === 'UNREVIEWED') {
    return { status: 'FAILED', code: 'RULE_SET_UNREVIEWED' };
  }

  // A clock with no working weekday has no terminating day-by-day walk. Fail
  // closed on that unsupported parameter rather than looping forever.
  const impossible = ruleSet.clocks.some(
    (clock) =>
      clock.nonWorkingWeekdays.length >= 7 &&
      (clock.unit === 'WORK_DAYS' || clock.dueDatePolicy === 'NEXT_WORKING_DAY'),
  );
  if (impossible) {
    return { status: 'FAILED', code: 'RULE_SET_INVALID' };
  }

  const needsHolidays = ruleSet.clocks.some((clock) => clock.skipHolidays);
  if (needsHolidays) {
    const awarenessYear = yearOf(awarenessDay);
    if (holidayCalendar.year !== awarenessYear) {
      return { status: 'FAILED', code: 'HOLIDAY_DATA_MISSING', year: awarenessYear };
    }
  }

  const holidays = new Set<string>(holidayCalendar.dates);
  const clocks = ruleSet.clocks.map((clock) =>
    computeClock(clock, awarenessDay, asOfDay, holidays),
  );

  // A holiday-skipping walk may reach a year the calendar does not cover. The
  // result is withheld for the first uncovered year, not estimated.
  if (needsHolidays) {
    for (let index = 0; index < clocks.length; index += 1) {
      const rule = ruleSet.clocks[index];
      const clock = clocks[index];
      if (rule === undefined || clock === undefined || !rule.skipHolidays) continue;
      const dueYear = yearOf(readDate(clock.dueDate) ?? awarenessDay);
      if (holidayCalendar.year !== dueYear) {
        return { status: 'FAILED', code: 'HOLIDAY_DATA_MISSING', year: dueYear };
      }
    }
  }

  return {
    status: 'COMPUTED',
    clocks,
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
    ruleSetStatus: ruleSet.status,
    ruleSetDigest: '',
    engineVersion: 'oracle-v1',
    preview: ruleSet.status === 'PREVIEW',
  };
}
