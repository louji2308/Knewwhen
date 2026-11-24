/**
 * P9.C1 — pure Deadlines section view model (Arch §7, §10.4, C-05.8/11,
 * C-11.1-5, G-1). It accepts only a resolver envelope and a fixed string
 * catalogue. Extra fields, including any record text, are discarded. No number
 * is invented here: every line is derived from computed result data.
 */

import type { ResolverEnvelope } from '../contracts/envelope';

export const DEADLINES_UI_STRINGS = Object.freeze({
  title: 'Candidate awareness dates and clocks',
  notice: 'Decision support, not a regulatory determination or legal advice.',
  idle: 'Calculate clocks to see dates and counts for each candidate awareness date.',
  unavailable: 'Deadline calculation is not available on this installation.',
  error: 'The calculated clocks could not be loaded.',
  preview: 'Preview rule data. Do not treat these dates as operational.',
  unreviewed: 'Unreviewed rule data. No dates or counts are shown.',
  invalid: 'The calculation could not be used. Recalculate and try again.',
  noResults: 'No usable candidate dates are available for calculation.',
  missingHeading: 'Dates not calculated',
  counting: 'Counting details',
  calculate: 'Calculate clocks',
});

const REASON_LABELS: Readonly<Record<string, string>> = Object.freeze({
  DATE_INVALID: 'date unavailable',
  RULE_SET_INVALID: 'rule data could not be used',
  RULE_SET_UNREVIEWED: 'rule data not ready',
  HOLIDAY_DATA_MISSING: 'holiday year missing',
});

const text = (value: unknown): string =>
  typeof value === 'string' && value.length > 0 ? value : '';
const number = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;
const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;

export interface DeadlineClockLine {
  readonly clockId: string;
  readonly label: string;
  readonly dueDate: string;
  readonly daysLeft: number;
  readonly state: string;
  readonly details: readonly string[];
}

export interface DeadlinesViewModel {
  readonly kind: 'IDLE' | 'RESULT' | 'BLOCKED' | 'UNAVAILABLE' | 'ERROR';
  readonly message: string;
  readonly banner: string;
  readonly sensitivity: readonly string[];
  readonly clocks: readonly DeadlineClockLine[];
  readonly missing: readonly string[];
}

const empty = (
  kind: DeadlinesViewModel['kind'],
  message: string,
  banner = '',
): DeadlinesViewModel => ({
  kind,
  message,
  banner,
  sensitivity: [],
  clocks: [],
  missing: [],
});

export function deadlinesViewModel(envelope: ResolverEnvelope<unknown> | null): DeadlinesViewModel {
  if (envelope === null) return empty('IDLE', DEADLINES_UI_STRINGS.idle);
  if (envelope.code === 'NOT_FOUND' || envelope.code === 'NOT_PERMITTED') {
    return empty('UNAVAILABLE', DEADLINES_UI_STRINGS.unavailable);
  }
  if (envelope.code !== 'OK') return empty('ERROR', DEADLINES_UI_STRINGS.error);

  const data = record(envelope.data);
  if (data === null) return empty('ERROR', DEADLINES_UI_STRINGS.error);
  if (data.status !== 'COMPUTED') {
    const code = text(data.code);
    const message =
      code === 'RULE_SET_UNREVIEWED'
        ? DEADLINES_UI_STRINGS.unreviewed
        : code === 'DATE_INVALID' || code === 'RULE_SET_INVALID'
          ? DEADLINES_UI_STRINGS.invalid
          : DEADLINES_UI_STRINGS.error;
    return empty('BLOCKED', message);
  }
  if (!Array.isArray(data.results) || !Array.isArray(data.missing)) {
    return empty('ERROR', DEADLINES_UI_STRINGS.error);
  }

  const sensitivity: string[] = [];
  const clocks: DeadlineClockLine[] = [];
  for (const item of data.results) {
    const result = record(item);
    if (result === null || typeof result.effectiveDate !== 'string') continue;
    const clockRows = Array.isArray(result.clocks)
      ? result.clocks
          .map(record)
          .filter((row): row is Readonly<Record<string, unknown>> => row !== null)
      : [];
    const first = clockRows[0];
    if (first !== undefined) {
      sensitivity.push(
        `If this was the first knowledge: ${number(first.calendarDaysRemaining)} days left`,
      );
    }
    for (const row of clockRows) {
      const details: string[] = [];
      if (Array.isArray(row.trace)) {
        for (const trace of row.trace) {
          const entry = record(trace);
          if (entry !== null) details.push(`${text(entry.date)} ${text(entry.reason)}`);
        }
      }
      clocks.push({
        clockId: text(row.clockId),
        label: text(row.label),
        dueDate: text(row.dueDate),
        daysLeft: number(row.calendarDaysRemaining),
        state: text(row.state),
        details,
      });
    }
  }

  const missing = data.missing
    .map(record)
    .filter((row): row is Readonly<Record<string, unknown>> => row !== null)
    .map((row) => REASON_LABELS[text(row.reasonCode)] ?? 'not calculated');
  const banner = data.preview === true ? DEADLINES_UI_STRINGS.preview : '';
  return {
    kind: 'RESULT',
    message: clocks.length === 0 ? DEADLINES_UI_STRINGS.noResults : '',
    banner,
    sensitivity,
    clocks,
    missing,
  };
}
