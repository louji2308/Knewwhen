/**
 * P4.A2/A3 — IF-4: pure deadline arithmetic (Arch §10, I-7). No I/O, no clock,
 * no Jira, no regulatory interpretation: every count, weekday set, holiday and
 * policy comes from the injected rule data. The independent oracle (P4.B1)
 * uses a different algorithm and shares no code with this module.
 */

import type {
  ClockResult,
  ClockRule,
  ClockTraceEntry,
  DeadlineResult,
  HolidayCalendar,
  RuleSet,
  TraceReason,
} from '../contracts/deadlines';

export type { DeadlineFailure } from '../contracts/deadlines';

export const DEADLINE_ENGINE_VERSION = 'deadline-engine-v1' as const;
const DAY_MS = 86_400_000;

/** Integer day number from a strict ISO date. No clock and no time zone here. */
function dayNumber(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(iso)) return null;
  const milliseconds = Date.parse(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(milliseconds)) return null;
  const day = Math.floor(milliseconds / DAY_MS);
  return new Date(day * DAY_MS).toISOString().slice(0, 10) === iso ? day : null;
}

const isoFromDay = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);
const weekdayOf = (day: number): number => new Date(day * DAY_MS).getUTCDay();

interface DayClass {
  readonly skip: TraceReason | null;
  readonly missingYear: number | null;
}

function classifyDay(
  day: number,
  clock: ClockRule,
  holidays: ReadonlySet<string>,
  coveredYears: ReadonlySet<number>,
): DayClass {
  const iso = isoFromDay(day);
  const year = Number(iso.slice(0, 4));
  if (clock.skipHolidays && !coveredYears.has(year)) return { skip: null, missingYear: year };
  if (
    clock.nonWorkingWeekdays.includes(weekdayOf(day) as ClockRule['nonWorkingWeekdays'][number])
  ) {
    return { skip: 'WEEKEND', missingYear: null };
  }
  if (clock.skipHolidays && holidays.has(iso)) return { skip: 'HOLIDAY', missingYear: null };
  return { skip: null, missingYear: null };
}

/** Count qualifying days strictly after `from` up to and including `to`. */
function qualifyingDays(
  from: number,
  to: number,
  clock: ClockRule,
  holidays: ReadonlySet<string>,
  coveredYears: ReadonlySet<number>,
): number | null {
  let total = 0;
  for (let day = from + 1; day <= to; day += 1) {
    const classified = classifyDay(day, clock, holidays, coveredYears);
    if (classified.missingYear !== null) return null;
    if (classified.skip === null) total += 1;
  }
  return total;
}

function dueForWorkDays(
  awareness: number,
  clock: ClockRule,
  holidays: ReadonlySet<string>,
  coveredYears: ReadonlySet<number>,
): { due: number; trace: ClockTraceEntry[]; missingYear: number | null } {
  let cursor = awareness + (clock.countAwarenessDay ? 0 : 1);
  let remaining = clock.count;
  const trace: ClockTraceEntry[] = [];
  while (remaining > 0) {
    const classified = classifyDay(cursor, clock, holidays, coveredYears);
    if (classified.missingYear !== null)
      return { due: 0, trace, missingYear: classified.missingYear };
    if (classified.skip === null) remaining -= 1;
    else trace.push({ date: isoFromDay(cursor), reason: classified.skip });
    cursor += 1;
  }
  return { due: cursor - 1, trace, missingYear: null };
}

export function computeClocks(
  awarenessISO: string,
  asOfISO: string,
  ruleSet: RuleSet,
  holidayCalendar: HolidayCalendar,
): DeadlineResult {
  const awareness = dayNumber(awarenessISO);
  const asOf = dayNumber(asOfISO);
  if (awareness === null || asOf === null) return { status: 'FAILED', code: 'DATE_INVALID' };
  // A clock with no working weekday cannot terminate a work-day walk or a
  // next-working-day adjustment. Reject it before touching the calendar.
  if (ruleSet.clocks.some((clock) => new Set(clock.nonWorkingWeekdays).size >= 7)) {
    return { status: 'FAILED', code: 'RULE_SET_INVALID' };
  }
  if (ruleSet.status === 'UNREVIEWED') return { status: 'FAILED', code: 'RULE_SET_UNREVIEWED' };
  if (ruleSet.holidayCalendarId !== null && ruleSet.holidayCalendarId !== holidayCalendar.id) {
    return { status: 'FAILED', code: 'RULE_SET_INVALID' };
  }

  const holidays = new Set(holidayCalendar.dates);
  const coveredYears = new Set([holidayCalendar.year]);
  const clocks: ClockResult[] = [];

  for (const clock of ruleSet.clocks) {
    let due: number;
    let trace: ClockTraceEntry[] = [];

    if (clock.unit === 'WORK_DAYS') {
      const computed = dueForWorkDays(awareness, clock, holidays, coveredYears);
      if (computed.missingYear !== null) {
        return { status: 'FAILED', code: 'HOLIDAY_DATA_MISSING', year: computed.missingYear };
      }
      due = computed.due;
      trace = computed.trace;
    } else {
      due = awareness + clock.count - (clock.countAwarenessDay ? 1 : 0);
    }

    if (clock.dueDatePolicy === 'NEXT_WORKING_DAY') {
      let adjusted = false;
      while (true) {
        const classified = classifyDay(due, clock, holidays, coveredYears);
        if (classified.missingYear !== null) {
          return { status: 'FAILED', code: 'HOLIDAY_DATA_MISSING', year: classified.missingYear };
        }
        if (classified.skip === null) break;
        trace.push({ date: isoFromDay(due), reason: classified.skip });
        due += 1;
        adjusted = true;
      }
      if (adjusted) trace.push({ date: isoFromDay(due), reason: 'DUE_DATE_ADJUSTED' });
    }

    const forward = asOf <= due;
    const workDays = qualifyingDays(
      forward ? asOf : due,
      forward ? due : asOf,
      clock,
      holidays,
      coveredYears,
    );
    if (workDays === null) {
      return {
        status: 'FAILED',
        code: 'HOLIDAY_DATA_MISSING',
        year: Number((forward ? isoFromDay(due) : isoFromDay(asOf)).slice(0, 4)),
      };
    }

    clocks.push({
      clockId: clock.id,
      label: clock.label,
      dueDate: isoFromDay(due),
      calendarDaysRemaining: due - asOf,
      workDaysRemaining: forward ? workDays : -workDays,
      state: due === asOf ? 'DUE_TODAY' : due < asOf ? 'OVERDUE' : 'OPEN',
      trace,
    });
  }

  return {
    status: 'COMPUTED',
    clocks,
    ruleSetId: ruleSet.id,
    ruleSetVersion: ruleSet.version,
    ruleSetStatus: ruleSet.status,
    ruleSetDigest: '',
    engineVersion: DEADLINE_ENGINE_VERSION,
    preview: ruleSet.status === 'PREVIEW',
  };
}
