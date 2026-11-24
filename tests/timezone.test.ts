import { describe, expect, it } from 'vitest';
import { dateInZone } from '../src/core/timezone';

describe('P4.A3 timestamp → calendar-date edge converter (Arch §10.1)', () => {
  it('converts a near-midnight instant in the rule zone, not in UTC', () => {
    expect(dateInZone('2026-11-24T23:30:00.000Z', 'Asia/Kolkata')).toBe('2026-11-25');
    expect(dateInZone('2026-11-24T23:30:00.000Z', 'America/Los_Angeles')).toBe('2026-11-24');
    expect(dateInZone('2026-11-25T01:30:00.000Z', 'Asia/Kolkata')).toBe('2026-11-25');
  });

  it('does not read the system clock', () => {
    expect(dateInZone('2026-11-24T12:00:00.000Z', 'UTC')).toBe('2026-11-24');
  });

  it('fails closed on an invalid instant or unknown zone', () => {
    expect(dateInZone('not-a-date', 'UTC')).toMatchObject({
      status: 'FAILED',
      code: 'DATE_INVALID',
    });
    expect(dateInZone('2026-11-24T12:00:00.000Z', 'Mars/Olympus')).toMatchObject({
      status: 'FAILED',
      code: 'TIMEZONE_INVALID',
    });
  });
});
