import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { normalise } from '../src/core/normalise';
import { OI4_QUOTE_LIMITS, validateQuote, type QuoteLimits } from '../src/core/validate';

const SEED = 20261124;
const options = { seed: SEED, numRuns: 200 } as const;

const WORDS = [
  'alpha',
  'bravo',
  'charlie',
  'delta',
  'echo',
  'foxtrot',
  'golf',
  'hotel',
  'india',
  'juliet',
] as const;

describe('P3.A2 verbatim validator and IF-2 (C-01.1, G-2, OI-4.9)', () => {
  it('accepts a verbatim quote and returns the live slice at the first occurrence', () => {
    const segment = 'alpha bravo alpha charlie';
    const result = validateQuote(segment, 'alpha bravo');
    expect(result).toEqual({ accepted: true, spanStart: 0, spanLen: 11, slice: 'alpha bravo' });
  });

  it('rejects zero length and 1,001 characters; accepts 1 and 1,000 (OI-4.9)', () => {
    expect(validateQuote('a'.repeat(1000), '')).toMatchObject({
      accepted: false,
      reasonCode: 'TOO_SHORT',
    });
    expect(validateQuote('a'.repeat(1001), 'a'.repeat(1001))).toMatchObject({
      accepted: false,
      reasonCode: 'TOO_LONG',
    });
    expect(validateQuote('a', 'a')).toMatchObject({ accepted: true });
    expect(validateQuote('a'.repeat(1000), 'a'.repeat(1000))).toMatchObject({ accepted: true });
  });

  it('rejects a quote that contains or crosses a placeholder', () => {
    const segment = 'pump \uE000 stopped working';
    expect(validateQuote(segment, '\uE000 stopped')).toMatchObject({
      accepted: false,
      reasonCode: 'PLACEHOLDER_CROSSED',
    });
    expect(validateQuote(segment, 'pump \uE000')).toMatchObject({
      accepted: false,
      reasonCode: 'PLACEHOLDER_CROSSED',
    });
    expect(validateQuote(segment, 'stopped working')).toMatchObject({ accepted: true });
  });

  it('applies the same normalisation to the proposal: NFC and whitespace', () => {
    expect(validateQuote('Café was examined', 'Cafe\u0301   was examined').accepted).toBe(true);
    expect(validateQuote('pump   stopped', 'pump\nstopped').accepted).toBe(true);
  });

  it('never returns the model-supplied string as evidence', () => {
    const result = validateQuote('The pump stopped', 'the PUMP stopped'); // case differs → reject
    expect(result.accepted).toBe(false);
    const accepted = validateQuote('The pump stopped', 'pump stopped');
    expect(accepted.accepted && accepted.slice).toBe('pump stopped');
  });

  it('honours an injected limits object instead of a hard-coded one', () => {
    const tight: QuoteLimits = { minChars: 5, maxChars: 8 };
    expect(validateQuote('alpha bravo', 'al', tight)).toMatchObject({
      accepted: false,
      reasonCode: 'TOO_SHORT',
    });
    expect(validateQuote('alpha bravo', 'bravo', tight)).toMatchObject({ accepted: true });
    expect(validateQuote('alpha bravo charlie', 'alpha bravo charlie', tight)).toMatchObject({
      accepted: false,
      reasonCode: 'TOO_LONG',
    });
    expect(OI4_QUOTE_LIMITS).toEqual({ minChars: 1, maxChars: 1000 });
  });
});

describe('P3.A3 property tests from C-01.2 (seed logged)', () => {
  const normalisedText = fc
    .array(fc.constantFrom(...WORDS), { minLength: 4, maxLength: 10 })
    .map((words) => words.join(' '));

  it('every substring within the limits validates and locates the live slice', () => {
    fc.assert(
      fc.property(
        normalisedText,
        fc.integer({ min: 0 }),
        fc.integer({ min: 1, max: 12 }),
        (text, start, length) => {
          const from = start % text.length;
          const span = text.slice(from, Math.min(text.length, from + length));
          // Only spans already in normal form are candidates: a whitespace-only
          // slice normalises to empty and is correctly rejected (TOO_SHORT).
          if (span.length === 0 || normalise(span) !== span) return;
          const result = validateQuote(text, span);
          expect(result.accepted).toBe(true);
          if (result.accepted) {
            expect(result.slice).toBe(span);
            expect(text.slice(result.spanStart, result.spanStart + result.spanLen)).toBe(span);
          }
        },
      ),
      options,
    );
  });

  it('a one-character change, case change, omitted word or reorder is always rejected', () => {
    // Distinct words: with a repeated word, "reorder" or "omit" can produce a
    // genuinely verbatim span, which would make the property false, not the code.
    const threeDistinctWords = fc
      .uniqueArray(fc.constantFrom(...WORDS), { minLength: 3, maxLength: 3 })
      .map((words) => [words[0]!, words[1]!, words[2]!] as const);
    fc.assert(
      fc.property(threeDistinctWords, ([a, b, c]) => {
        const segment = `${a} ${b} ${c} left right`;
        const mutation = `${a.slice(0, -1)}z ${b} ${c}`;
        const cases = [mutation, `${a.toUpperCase()} ${b} ${c}`, `${a} ${c}`, `${b} ${a} ${c}`];
        for (const proposal of cases) {
          expect(validateQuote(segment, proposal).accepted, proposal).toBe(false);
        }
      }),
      options,
    );
  });

  it('boundary and placeholder crossing is never accepted', () => {
    fc.assert(
      fc.property(fc.constantFrom(...WORDS), fc.constantFrom(...WORDS), (a, b) => {
        expect(validateQuote(`${a} \uE001 ${b} end`, `${a} \uE001`).accepted).toBe(false);
        expect(validateQuote(`${a} \uE001 ${b}`, `\uE001 ${b}`).accepted).toBe(false);
      }),
      options,
    );
  });
});
