/**
 * P4.A0 — IF-4/5/16: deadline rule-data contract (Arch §10.2, I-7).
 * These are generic arithmetic parameters only. No regulatory reading, clock
 * name, count or citation is defined here: those live in approved rule data.
 */

export const CLOCK_UNITS = Object.freeze(['CALENDAR_DAYS', 'WORK_DAYS'] as const);
export type ClockUnit = (typeof CLOCK_UNITS)[number];

export const RULE_STATUSES = Object.freeze(['REVIEWED', 'PREVIEW', 'UNREVIEWED'] as const);
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const DUE_DATE_POLICIES = Object.freeze(['KEEP', 'NEXT_WORKING_DAY'] as const);
export type DueDatePolicy = (typeof DUE_DATE_POLICIES)[number];

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ClockRule {
  readonly id: string;
  readonly label: string;
  readonly unit: ClockUnit;
  readonly count: number;
  /** If true, the awareness day is day one; otherwise counting starts the next day. */
  readonly countAwarenessDay: boolean;
  readonly nonWorkingWeekdays: readonly Weekday[];
  readonly skipHolidays: boolean;
  readonly dueDatePolicy: DueDatePolicy;
}

export interface RuleSet {
  readonly id: string;
  readonly version: string;
  readonly status: RuleStatus;
  readonly citations: readonly string[];
  readonly holidayCalendarId: string | null;
  readonly clocks: readonly ClockRule[];
}

export interface HolidayCalendar {
  readonly id: string;
  readonly year: number;
  readonly dates: readonly string[];
}

export type TraceReason = 'WEEKEND' | 'HOLIDAY' | 'DUE_DATE_ADJUSTED';

export interface ClockTraceEntry {
  readonly date: string;
  readonly reason: TraceReason;
}

export interface ClockResult {
  readonly clockId: string;
  readonly label: string;
  readonly dueDate: string;
  readonly calendarDaysRemaining: number;
  readonly workDaysRemaining: number;
  readonly state: 'OPEN' | 'DUE_TODAY' | 'OVERDUE';
  readonly trace: readonly ClockTraceEntry[];
}

export type DeadlineErrorCode =
  'DATE_INVALID' | 'RULE_SET_INVALID' | 'RULE_SET_UNREVIEWED' | 'HOLIDAY_DATA_MISSING';

export interface DeadlineSuccess {
  readonly status: 'COMPUTED';
  readonly clocks: readonly ClockResult[];
  readonly ruleSetId: string;
  readonly ruleSetVersion: string;
  readonly ruleSetStatus: RuleStatus;
  readonly ruleSetDigest: string;
  readonly engineVersion: string;
  readonly preview: boolean;
}

export interface DeadlineFailure {
  readonly status: 'FAILED';
  readonly code: DeadlineErrorCode;
  readonly year?: number;
}

export type DeadlineResult = DeadlineSuccess | DeadlineFailure;
