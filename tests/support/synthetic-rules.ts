/**
 * P4 — SYNTHETIC TEST DATA ONLY. These clock parameters are arbitrary numbers
 * used to test arithmetic; they are NOT regulatory content, are never written
 * to rules/*.json and must never be shown as FDA/EU deadlines (I-7).
 */

export const SYNTHETIC_RULE_SET = {
  id: 'test-synthetic-clock-set',
  version: 'test-v1',
  status: 'REVIEWED',
  citations: ['SYNTHETIC ARITHMETIC FIXTURE — NOT REGULATORY CONTENT'],
  holidayCalendarId: 'test-holidays-2026',
  clocks: [
    {
      id: 'CAL-30',
      label: 'Synthetic calendar clock',
      unit: 'CALENDAR_DAYS',
      count: 30,
      countAwarenessDay: false,
      nonWorkingWeekdays: [],
      skipHolidays: false,
      dueDatePolicy: 'KEEP',
    },
    {
      id: 'WORK-4',
      label: 'Synthetic work-day clock',
      unit: 'WORK_DAYS',
      count: 4,
      countAwarenessDay: false,
      nonWorkingWeekdays: [0, 6],
      skipHolidays: true,
      dueDatePolicy: 'KEEP',
    },
    {
      id: 'CAL-2-NEXT-WORKDAY',
      label: 'Synthetic calendar clock with next-working-day policy',
      unit: 'CALENDAR_DAYS',
      count: 2,
      countAwarenessDay: false,
      nonWorkingWeekdays: [0, 6],
      skipHolidays: false,
      dueDatePolicy: 'NEXT_WORKING_DAY',
    },
  ],
} as const;

export const SYNTHETIC_HOLIDAYS = {
  id: 'test-holidays-2026',
  year: 2026,
  dates: ['2026-11-26'],
} as const;
