import { describe, expect, it } from 'vitest';
import { APPROVED_DISCLAIMERS, assertNoBannedWording, scanWording } from '../src/core/wording';

describe('P4.C1 wording guard (C-05.11, G-1, I-5/I-13)', () => {
  it('accepts neutral dates, counts and the approved disclaimer', () => {
    const clean = [
      '11 days left on the synthetic calendar clock',
      'Due 2026-12-05',
      ...APPROVED_DISCLAIMERS,
    ];
    expect(scanWording(clean)).toEqual({ status: 'CLEAN' });
    expect(() => assertNoBannedWording(clean)).not.toThrow();
  });

  it.each([
    'This is reportable',
    'Not reportable',
    'The device is compliant',
    'Late filing detected',
    'You must report this event',
    'Our determination is final',
  ])('rejects an outcome or compliance claim: %s', (text) => {
    const result = scanWording([text]);
    expect(result.status).toBe('VIOLATION');
    if (result.status === 'VIOLATION') expect(result.matches.length).toBeGreaterThan(0);
    expect(() => assertNoBannedWording([text])).toThrow('BANNED_WORDING');
  });

  it('reports phrase and position but never echoes the authored text', () => {
    const result = scanWording(['safe text', 'A REPORTABLE outcome']);
    expect(result.status).toBe('VIOLATION');
    if (result.status === 'VIOLATION') {
      expect(result.matches[0]).toMatchObject({ textIndex: 1, position: 2 });
      expect(JSON.stringify(result)).not.toContain('A REPORTABLE outcome');
    }
  });

  it('is case-insensitive and does not flag a question quoted from rule data', () => {
    expect(scanWording(['Was the patient harmed?'])).toEqual({ status: 'CLEAN' });
    expect(scanWording(['REPORTABLE']).status).toBe('VIOLATION');
  });
});
