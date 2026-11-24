import { describe, expect, it } from 'vitest';
import {
  CANARY_TOKENS,
  assertSafeFields,
  canaryScan,
  type LogFields,
} from '../src/contracts/canary';

describe('P2.B2 canary harness (N-04(a), N-09, I-6)', () => {
  it('carries distinct multi-part probes, not a single trivial string', () => {
    expect(CANARY_TOKENS.length).toBeGreaterThanOrEqual(4);
    for (const token of CANARY_TOKENS) {
      expect(token).toContain('canary');
      expect(token.length).toBeGreaterThan(12);
    }
    expect(new Set(CANARY_TOKENS).size).toBe(CANARY_TOKENS.length);
  });

  it('finds an injected canary in a serialised payload', () => {
    const probe = CANARY_TOKENS[0]!;
    expect(canaryScan(`prefix-${probe}-suffix`)).toBe(true);
  });

  it('returns false for clean ids, codes and counts', () => {
    expect(canaryScan('acq-123|VIEWER|DENIED|42')).toBe(false);
    expect(canaryScan('')).toBe(false);
  });

  it('rejects a log field whose value carries a canary', () => {
    const fields: LogFields = { actionCode: `ok-${CANARY_TOKENS[1]}` };
    expect(() => assertSafeFields(fields)).toThrow('CANARY_LEAK');
  });

  it('rejects an unknown log field name (only ids, codes, counts, durations)', () => {
    expect(() => assertSafeFields({ summary: 'x' } as unknown as LogFields)).toThrow(
      'CANARY_FIELD',
    );
  });

  it('accepts allowed fields with code-like values', () => {
    expect(() =>
      assertSafeFields({
        correlationId: 'corr-1',
        actionCode: 'MANUAL_SCAN',
        count: 3,
        durationMs: 12,
      }),
    ).not.toThrow();
  });
});
