import { describe, expect, it } from 'vitest';
import {
  NORMALISATION_VERSION,
  extractSegments,
  normalise,
  type AdfNode,
} from '../src/core/normalise';
import { GOLDEN_CASES } from './support/golden-adf';

describe('P3.A1 normaliser v1 and IF-1 (Arch §6.3, I-1)', () => {
  it.each(GOLDEN_CASES)('golden corpus: $name', ({ adf, expectedSegments }) => {
    expect(extractSegments(adf as AdfNode, NORMALISATION_VERSION).map((s) => s.text)).toEqual(
      expectedSegments,
    );
  });

  it('preserves case, punctuation and word order', () => {
    const adf: AdfNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'The PUMP Stopped. Again!' }],
        },
      ],
    };
    expect(extractSegments(adf, NORMALISATION_VERSION)[0]!.text).toBe('The PUMP Stopped. Again!');
  });

  it('normalise() is NFC, whitespace-collapsing and idempotent for plain text', () => {
    const once = normalise('  Cafe\u0301\n\n  again\tnow  ', NORMALISATION_VERSION);
    expect(once).toBe('Café again now');
    expect(normalise(once, NORMALISATION_VERSION)).toBe(once);
  });

  it('rejects an unsupported normalisation version instead of guessing', () => {
    expect(() => normalise('x', 'normalise-v2')).toThrow('UNSUPPORTED_VERSION');
    expect(() => extractSegments({ type: 'doc', content: [] } as AdfNode, 'normalise-v2')).toThrow(
      'UNSUPPORTED_VERSION',
    );
  });

  it('gives every segment a stable key and an ADF path (position map)', () => {
    const adf: AdfNode = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'One' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Two' }] },
      ],
    };
    const segments = extractSegments(adf, NORMALISATION_VERSION);
    expect(segments.map((s) => s.key)).toEqual(['s:0', 's:1']);
    expect(segments[0]!.path).toEqual([0]);
    expect(segments[1]!.path).toEqual([1]);
  });

  it('never returns an empty segment for a block with no text', () => {
    const adf: AdfNode = {
      type: 'doc',
      content: [{ type: 'paragraph' }, { type: 'paragraph', content: [{ type: 'media' }] }],
    };
    expect(extractSegments(adf, NORMALISATION_VERSION).map((s) => s.text)).toEqual(['\uE002']);
  });
});
