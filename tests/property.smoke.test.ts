import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

describe('fast-check smoke (N-06)', () => {
  it('NFC normalisation is idempotent for arbitrary strings', () => {
    expect(() =>
      fc.assert(
        fc.property(
          fc.string(),
          (value) => value.normalize('NFC').normalize('NFC') === value.normalize('NFC'),
        ),
        { numRuns: 100 },
      ),
    ).not.toThrow();
  });
});
