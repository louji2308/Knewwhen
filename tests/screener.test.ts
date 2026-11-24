import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadLexicon, screen, type Lexicon } from '../src/core/screener';
import { validateQuote } from '../src/core/validate';

const rawLexicon: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/lexicon-test-v1.json', import.meta.url), 'utf8'),
);
const lexicon = loadLexicon(rawLexicon);

describe('P3.B1 rule screener and IF-3 (C-01.4, Arch §7.3, PC-4)', () => {
  it('loads the test lexicon with a strict schema', () => {
    expect(lexicon.status).toBe('LOADED');
    if (lexicon.status === 'LOADED') expect(lexicon.lexicon.version).toBe('lexicon-test-v1');
  });

  it('returns a verbatim span with RULE_MATCH provenance, preserving live case', () => {
    const result = screen('The PUMP STOPPED working unexpectedly.', lexicon);
    expect(result.status).toBe('SCREENED');
    if (result.status !== 'SCREENED') return;
    expect(result.candidates.some((candidate) => candidate.slice === 'PUMP STOPPED working')).toBe(
      true,
    );
    expect(result.candidates[0]!.method).toBe('RULE_MATCH');
  });

  it('is a valid SCREENED result with no candidates when nothing matches', () => {
    const result = screen('The weather is pleasant today.', lexicon);
    expect(result.status).toBe('SCREENED');
    if (result.status === 'SCREENED') expect(result.candidates).toEqual([]);
  });

  it('a missing lexicon is DEGRADED, never NO_SIGNAL', () => {
    expect(screen('pump stopped', undefined).status).toBe('DEGRADED');
    expect(screen('pump stopped', null).status).toBe('DEGRADED');
    const result = screen('pump stopped', undefined);
    if (result.status === 'DEGRADED') expect(result.reasonCode).toBe('LEXICON_MISSING');
  });

  it.each([
    ['not an object', 'lexicon'],
    ['missing version', { phrases: [{ id: 'x', category: 'INJURY', text: 'a' }] }],
    ['missing phrases', { version: 'v1' }],
    ['empty phrases', { version: 'v1', phrases: [] }],
    ['unknown category', { version: 'v1', phrases: [{ id: 'x', category: 'GUESS', text: 'a' }] }],
    ['non-string text', { version: 'v1', phrases: [{ id: 'x', category: 'INJURY', text: 42 }] }],
    [
      'unknown field',
      { version: 'v1', phrases: [{ id: 'x', category: 'INJURY', text: 'a', extra: 1 }] },
    ],
  ])('an invalid lexicon is DEGRADED: %s', (_name, raw) => {
    const result = screen('pump stopped', raw as unknown);
    expect(result.status).toBe('DEGRADED');
    if (result.status === 'DEGRADED') expect(result.reasonCode).toBe('LEXICON_INVALID');
  });

  it('every candidate is a verbatim span through IF-2, including on a huge input', () => {
    const text = `${'benign text '.repeat(12000)}pump stopped unexpectedly`;
    const result = screen(text, lexicon);
    expect(result.status).toBe('SCREENED');
    if (result.status !== 'SCREENED') return;
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.candidates) {
      const checked = validateQuote(text, candidate.slice);
      expect(checked.accepted).toBe(true);
      if (checked.accepted) {
        expect(candidate.slice).toBe(
          text.slice(candidate.spanStart, candidate.spanStart + candidate.spanLen),
        );
      }
    }
  });

  it('drops a shorter span contained in a longer one', () => {
    const result = screen('the pump stopped working now', lexicon);
    if (result.status !== 'SCREENED') throw new Error('expected SCREENED');
    expect(result.candidates.map((candidate) => candidate.slice)).toEqual(['pump stopped working']);
  });

  it('never returns a placeholder span as a candidate', () => {
    const placeholderLexicon: Lexicon = {
      version: 'lexicon-placeholder-test',
      phrases: [{ id: 'P-X', category: 'INJURY', text: '\uE000 stopped' }],
    };
    const result = screen('pump \uE000 stopped now', {
      status: 'LOADED',
      lexicon: placeholderLexicon,
    });
    expect(result.status).toBe('SCREENED');
    if (result.status === 'SCREENED') expect(result.candidates).toEqual([]);
  });

  it('property: a returned candidate is always a live slice at its reported offset', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('pump stopped', 'patient injured', 'screen cracked', 'harm'),
        fc.constantFrom('before', 'AFTER', 'middle'),
        (phrase, position) => {
          const text =
            position === 'before'
              ? `${phrase} then other words`
              : position === 'AFTER'
                ? `other words then ${phrase.toUpperCase()}`
                : `the ${phrase} and more`;
          const result = screen(text, lexicon);
          expect(result.status).toBe('SCREENED');
          if (result.status !== 'SCREENED') return;
          for (const candidate of result.candidates) {
            expect(candidate.slice).toBe(
              text.slice(candidate.spanStart, candidate.spanStart + candidate.spanLen),
            );
          }
        },
      ),
      { seed: 20261124, numRuns: 100 },
    );
  });
});
