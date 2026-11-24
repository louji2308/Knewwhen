import { describe, expect, it } from 'vitest';
import { loadHolidayCalendar, loadRuleSet } from '../src/core/rules-loader';
import { SYNTHETIC_HOLIDAYS, SYNTHETIC_RULE_SET } from './support/synthetic-rules';

describe('P4.A1 rules loader and IF-5 (C-05.3, C-05.9, I-7)', () => {
  it('loads a schema-valid rule set and returns a SHA-256 digest', () => {
    const result = loadRuleSet(SYNTHETIC_RULE_SET);
    expect(result.status).toBe('LOADED');
    if (result.status !== 'LOADED') return;
    expect(result.digest).toMatch(/^[0-9A-F]{64}$/u);
    expect(result.ruleSet.clocks).toHaveLength(3);
  });

  it('is stable for the same data and changes when the data changes', () => {
    const first = loadRuleSet(SYNTHETIC_RULE_SET);
    const again = loadRuleSet(SYNTHETIC_RULE_SET);
    const changed = loadRuleSet({ ...SYNTHETIC_RULE_SET, version: 'test-v2' });
    expect(
      first.status === 'LOADED' && again.status === 'LOADED' && changed.status === 'LOADED',
    ).toBe(true);
    if (first.status !== 'LOADED' || again.status !== 'LOADED' || changed.status !== 'LOADED')
      return;
    expect(first.digest).toBe(again.digest);
    expect(first.digest).not.toBe(changed.digest);
  });

  it.each([
    ['missing citations', { ...SYNTHETIC_RULE_SET, citations: [] }],
    ['empty clocks', { ...SYNTHETIC_RULE_SET, clocks: [] }],
    [
      'unknown clock unit',
      { ...SYNTHETIC_RULE_SET, clocks: [{ ...SYNTHETIC_RULE_SET.clocks[0], unit: 'FORTNIGHTS' }] },
    ],
    [
      'unknown due-date policy',
      {
        ...SYNTHETIC_RULE_SET,
        clocks: [{ ...SYNTHETIC_RULE_SET.clocks[0], dueDatePolicy: 'GUESS' }],
      },
    ],
    [
      'unsupported extra parameter',
      { ...SYNTHETIC_RULE_SET, clocks: [{ ...SYNTHETIC_RULE_SET.clocks[0], magic: true }] },
    ],
    [
      'zero count',
      { ...SYNTHETIC_RULE_SET, clocks: [{ ...SYNTHETIC_RULE_SET.clocks[0], count: 0 }] },
    ],
    [
      'duplicate clock ids',
      {
        ...SYNTHETIC_RULE_SET,
        clocks: [SYNTHETIC_RULE_SET.clocks[0], SYNTHETIC_RULE_SET.clocks[0]],
      },
    ],
  ])('rejects an invalid rule set: %s', (_name, raw) => {
    expect(loadRuleSet(raw)).toEqual({ status: 'FAILED', code: 'RULE_SET_INVALID' });
  });

  it('loads and validates a holiday calendar with a single year', () => {
    const result = loadHolidayCalendar(SYNTHETIC_HOLIDAYS);
    expect(result.status).toBe('LOADED');
    expect(loadHolidayCalendar({ ...SYNTHETIC_HOLIDAYS, year: 2027 })).toEqual({
      status: 'FAILED',
      code: 'RULE_SET_INVALID',
    });
    expect(loadHolidayCalendar({ ...SYNTHETIC_HOLIDAYS, dates: ['2026-13-01'] })).toEqual({
      status: 'FAILED',
      code: 'RULE_SET_INVALID',
    });
  });
});
