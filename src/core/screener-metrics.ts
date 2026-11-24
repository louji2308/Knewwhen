/**
 * P3.B2 — measured precision/recall for the rule screener (C-01.13, OI-5).
 * Pure core: no @forge/* import. Labels are supplied by the labelled corpus;
 * this module never derives the truth from the thing it measures. No pass bar
 * is encoded: OI-5 leaves bars unset, so the result is reported, not graded.
 */

import { screen } from './screener';

export interface LabelledSegment {
  readonly id: string;
  readonly label: 'SIGNAL' | 'NO_SIGNAL';
  readonly category: string;
  readonly text: string;
}

export interface MetricRow {
  readonly scope: string;
  readonly positives: number;
  readonly negatives: number;
  readonly tp: number;
  readonly fp: number;
  readonly tn: number;
  readonly fn: number;
  readonly precision: number | null;
  readonly recall: number | null;
}

/** Mutable accumulator; the published MetricRow stays immutable. */
interface MutableCounts {
  scope: string;
  positives: number;
  negatives: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export type MetricsResult =
  | {
      readonly status: 'MEASURED';
      readonly lexiconVersion: string;
      readonly passBar: null;
      readonly rows: readonly MetricRow[];
    }
  | { readonly status: 'UNAVAILABLE'; readonly reasonCode: 'LEXICON_MISSING' | 'LEXICON_INVALID' };

const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

export function runScreenerMetrics(
  corpus: readonly LabelledSegment[],
  lexiconValue: unknown,
): MetricsResult {
  const buckets = new Map<string, MutableCounts>();
  const rowFor = (scope: string): MutableCounts => {
    const existing = buckets.get(scope);
    if (existing) return existing;
    const created: MutableCounts = {
      scope,
      positives: 0,
      negatives: 0,
      tp: 0,
      fp: 0,
      tn: 0,
      fn: 0,
    };
    buckets.set(scope, created);
    return created;
  };

  let lexiconVersion = '';
  for (const segment of corpus) {
    const result = screen(segment.text, lexiconValue);
    if (result.status === 'DEGRADED') {
      return { status: 'UNAVAILABLE', reasonCode: result.reasonCode };
    }
    lexiconVersion = result.lexiconVersion;
    const predictedSignal = result.candidates.length > 0;
    for (const scope of ['ALL', segment.category]) {
      const row = rowFor(scope);
      if (segment.label === 'SIGNAL') {
        row.positives += 1;
        if (predictedSignal) row.tp += 1;
        else row.fn += 1;
      } else {
        row.negatives += 1;
        if (predictedSignal) row.fp += 1;
        else row.tn += 1;
      }
    }
  }

  const rows = [...buckets.values()].map((row) => ({
    scope: row.scope,
    positives: row.positives,
    negatives: row.negatives,
    tp: row.tp,
    fp: row.fp,
    tn: row.tn,
    fn: row.fn,
    precision: ratio(row.tp, row.tp + row.fp),
    recall: ratio(row.tp, row.tp + row.fn),
  }));

  return { status: 'MEASURED', lexiconVersion, passBar: null, rows };
}
