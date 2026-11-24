import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runScreenerMetrics, type LabelledSegment } from '../src/core/screener-metrics';
import { SCREENER_CORPUS } from './fixtures/screener-corpus';

const lexicon: unknown = JSON.parse(
  readFileSync(new URL('./fixtures/lexicon-screener-corpus-v1.json', import.meta.url), 'utf8'),
);

describe('P3.B2 screener metrics on a labelled corpus (C-01.13, OI-5)', () => {
  it('reports measured precision and recall, with no promised pass bar', () => {
    const metrics = runScreenerMetrics(SCREENER_CORPUS, lexicon);
    expect(metrics.status).toBe('MEASURED');
    if (metrics.status !== 'MEASURED') return;
    const overall = metrics.rows.find((row) => row.scope === 'ALL')!;
    expect(overall).toMatchObject({ tp: 3, fp: 0, tn: 3, fn: 1, precision: 1, recall: 0.75 });
    expect(metrics.passBar).toBeNull();
    expect(metrics.lexiconVersion).toBe('lexicon-screener-corpus-v1');
  });

  it('breaks metrics down by labelled scenario (SC-1 recall is measured, SC-2 miss is honest)', () => {
    const metrics = runScreenerMetrics(SCREENER_CORPUS, lexicon);
    if (metrics.status !== 'MEASURED') throw new Error('expected MEASURED');
    const sc1 = metrics.rows.find((row) => row.scope === 'SC-1')!;
    const sc2 = metrics.rows.find((row) => row.scope === 'SC-2')!;
    const sc3 = metrics.rows.find((row) => row.scope === 'SC-3')!;
    const sc4 = metrics.rows.find((row) => row.scope === 'SC-4')!;
    expect(sc1).toMatchObject({ tp: 2, fn: 0, recall: 1 });
    expect(sc2).toMatchObject({ tp: 1, fn: 1, recall: 0.5 });
    expect(sc3).toMatchObject({ tn: 1, fp: 0 });
    expect(sc4).toMatchObject({ tn: 2, fp: 0 });
  });

  it('a degraded lexicon never becomes a no-signal measurement', () => {
    expect(runScreenerMetrics(SCREENER_CORPUS, undefined)).toEqual({
      status: 'UNAVAILABLE',
      reasonCode: 'LEXICON_MISSING',
    });
  });

  it('is deterministic for the same corpus, lexicon and version', () => {
    const first = runScreenerMetrics(SCREENER_CORPUS, lexicon);
    const second = runScreenerMetrics(SCREENER_CORPUS, lexicon);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('writes a reproducible metrics table to evidence/P3', () => {
    const metrics = runScreenerMetrics(SCREENER_CORPUS, lexicon);
    if (metrics.status !== 'MEASURED') throw new Error('expected MEASURED');
    const digest = createHash('sha256')
      .update(JSON.stringify(SCREENER_CORPUS))
      .digest('hex')
      .toUpperCase();
    const lines = [
      'KnewWhen rule-screener metrics (P3.B2, C-01.13)',
      `Corpus digest (SHA-256 of labelled corpus JSON): ${digest}`,
      `Corpus size: ${SCREENER_CORPUS.length} labelled segments`,
      `Lexicon version: ${metrics.lexiconVersion}`,
      'Precision and recall are measured on synthetic labels; no pass bar is promised (OI-5).',
      '',
      'scope | positives | negatives | TP | FP | TN | FN | precision | recall',
      ...metrics.rows.map((row) =>
        [
          row.scope,
          row.positives,
          row.negatives,
          row.tp,
          row.fp,
          row.tn,
          row.fn,
          row.precision ?? 'n/a',
          row.recall ?? 'n/a',
        ].join(' | '),
      ),
      '',
    ];
    mkdirSync('evidence/P3', { recursive: true });
    writeFileSync('evidence/P3/screener-metrics.txt', lines.join('\n'), 'utf8');
    expect(readFileSync('evidence/P3/screener-metrics.txt', 'utf8')).toBe(lines.join('\n'));
  });
});

describe('P3.B2 metric arithmetic from labels (not from screener output)', () => {
  it('handles an all-positive corpus without inventing a precision value', () => {
    const positiveOnly: readonly LabelledSegment[] = [
      { id: 'x', label: 'SIGNAL', category: 'SC-1', text: 'app froze during dose calculation' },
    ];
    const metrics = runScreenerMetrics(positiveOnly, lexicon);
    if (metrics.status !== 'MEASURED') throw new Error('expected MEASURED');
    expect(metrics.rows[0]).toMatchObject({ precision: 1, recall: 1, tn: 0, fp: 0 });
  });
});
