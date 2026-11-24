/**
 * P4.A3 — timestamp → calendar-date edge converter (Arch §10.1). The time-zone
 * rule itself belongs to locked domain rule data; this module only applies the
 * zone supplied by the caller using Intl, and never reads the system clock.
 */

export type DateInZoneResult =
  string | { readonly status: 'FAILED'; readonly code: 'DATE_INVALID' | 'TIMEZONE_INVALID' };

export function dateInZone(instantISO: string, timeZone: string): DateInZoneResult {
  const milliseconds = Date.parse(instantISO);
  if (!Number.isFinite(milliseconds)) return { status: 'FAILED', code: 'DATE_INVALID' };

  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(milliseconds));
    const value = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';
    const year = value('year');
    const month = value('month');
    const day = value('day');
    if (!/^\d{4}$/u.test(year) || !/^\d{2}$/u.test(month) || !/^\d{2}$/u.test(day)) {
      return { status: 'FAILED', code: 'TIMEZONE_INVALID' };
    }
    return `${year}-${month}-${day}`;
  } catch {
    return { status: 'FAILED', code: 'TIMEZONE_INVALID' };
  }
}
