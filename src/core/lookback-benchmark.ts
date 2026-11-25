/**
 * P8.B1/B2 — deterministic labelled lookback corpus and honest metrics
 * (C-03.12, C-12.1, OI-5, Arch §16.3). The corpus is synthetic and derived
 * from the frozen generator templates; labels are ground truth, not model
 * output. Tuning uses only the tuning split; the held-out split is evaluated
 * once. No pass bar is encoded (OI-5): HIGH must beat MEDIUM or the result is
 * reported as a failed experiment, not hidden by a threshold.
 */

import type { LookbackReasonCode } from '../contracts/lookback';
import { DEFAULT_LOOKBACK_PROFILE, distinctiveTokens, rankCandidate } from './lookback-matcher';
import { FIXTURE_TEMPLATES } from './generator';

export const LOOKBACK_BENCHMARK_VERSION = 'lookback-benchmark-v1' as const;

export type BenchmarkSplit = 'TUNING' | 'HELD_OUT';
export type BenchmarkTier = 'L' | 'R' | 'T';

export interface LabelledLookbackPair {
  readonly id: string;
  readonly split: BenchmarkSplit;
  readonly tier: BenchmarkTier;
  readonly expectedMatch: boolean;
  readonly anchorText: string;
  readonly candidateText: string;
  readonly reasonCodes: readonly LookbackReasonCode[];
}

interface PairTemplate {
  readonly id: string;
  readonly tier: BenchmarkTier;
  readonly expectedMatch: boolean;
  readonly reasonCodes: readonly LookbackReasonCode[];
  readonly anchorText: string;
  readonly candidateText: string;
}

/** Phrasing variants stay close to the generator's frozen synthetic quotes. */
const PAIR_TEMPLATES: readonly PairTemplate[] = Object.freeze([
  {
    id: 'dose-direct-link',
    tier: 'L',
    expectedMatch: true,
    reasonCodes: ['LINKED', 'TEXT_OVERLAP'],
    anchorText: FIXTURE_TEMPLATES.A1.description,
    candidateText: 'Dose calculation froze; patient went to the ER for observation.',
  },
  {
    id: 'dose-same-reporter',
    tier: 'R',
    expectedMatch: true,
    reasonCodes: ['SAME_REPORTER', 'TEXT_OVERLAP'],
    anchorText: FIXTURE_TEMPLATES.A1.description,
    candidateText: 'Patient went to the ER after the dose calculation froze.',
  },
  {
    id: 'unit-same-product',
    tier: 'R',
    expectedMatch: true,
    reasonCodes: ['SAME_PRODUCT', 'SAME_REPORTER', 'TEXT_OVERLAP'],
    anchorText: FIXTURE_TEMPLATES.H4.description,
    candidateText: 'Values appear in the wrong unit after a locale change.',
  },
  {
    id: 'low-reading-link',
    tier: 'L',
    expectedMatch: true,
    reasonCodes: ['LINKED', 'TEXT_OVERLAP'],
    anchorText: FIXTURE_TEMPLATES.H5.description,
    candidateText: 'Readings look far too low compared with the meter display.',
  },
  {
    id: 'same-product-different-problem',
    tier: 'T',
    expectedMatch: false,
    reasonCodes: ['TEXT_OVERLAP'],
    anchorText: FIXTURE_TEMPLATES.A1.description,
    candidateText: FIXTURE_TEMPLATES.H2.description,
  },
  {
    id: 'feature-request-overlap',
    tier: 'T',
    expectedMatch: false,
    reasonCodes: ['TEXT_OVERLAP'],
    anchorText: FIXTURE_TEMPLATES.A1.description,
    candidateText: FIXTURE_TEMPLATES.H3.description,
  },
  {
    id: 'same-reporter-different-event',
    tier: 'R',
    expectedMatch: false,
    reasonCodes: ['SAME_REPORTER'],
    anchorText: FIXTURE_TEMPLATES.A1.description,
    candidateText: FIXTURE_TEMPLATES.H4.description,
  },
  {
    id: 'second-degree-link-different-event',
    tier: 'L',
    expectedMatch: false,
    reasonCodes: ['LINKED_2', 'TEXT_OVERLAP'],
    anchorText: FIXTURE_TEMPLATES.A1.description,
    candidateText: FIXTURE_TEMPLATES.H5.description,
  },
]);

const CORPUS_SIZE = 48;
const SPLIT_BOUNDARY = 70;

/** Single-letter batch marks are below the minimum token length and inert. */
function batchMark(index: number): string {
  return `Batch ${String.fromCharCode(97 + (index % 26))}: `;
}

export function buildLookbackCorpus(seed: number): readonly LabelledLookbackPair[] {
  if (!Number.isFinite(seed)) throw new Error('BENCHMARK_SEED_INVALID');
  return Array.from({ length: CORPUS_SIZE }, (_, index) => {
    const template = PAIR_TEMPLATES[index % PAIR_TEMPLATES.length]!;
    const mark = batchMark(index + Math.abs(seed % 26));
    const split: BenchmarkSplit = index % 10 < SPLIT_BOUNDARY / 10 ? 'TUNING' : 'HELD_OUT';
    return {
      id: `${template.id}-${index}`,
      split,
      tier: template.tier,
      expectedMatch: template.expectedMatch,
      anchorText: `${mark}${template.anchorText}`,
      candidateText: `${mark}${template.candidateText}`,
      reasonCodes: template.reasonCodes,
    };
  });
}

export interface LookbackMetricRow {
  readonly scope: string;
  readonly positives: number;
  readonly negatives: number;
  readonly tp: number;
  readonly fp: number;
  readonly tn: number;
  readonly fn: number;
  readonly precision: number | null;
  readonly recall: number | null;
  readonly falseMatchRateAmongHigh: number | null;
}

export type LookbackMetricsResult =
  | {
      readonly status: 'MEASURED';
      readonly benchmarkVersion: typeof LOOKBACK_BENCHMARK_VERSION;
      readonly profileVersion: string;
      readonly passBar: null;
      readonly rows: readonly LookbackMetricRow[];
    }
  | { readonly status: 'UNAVAILABLE'; readonly reasonCode: 'NO_REVIEWED_DATA' };

interface MutableRow {
  positives: number;
  negatives: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

function emptyRow(): MutableRow {
  return { positives: 0, negatives: 0, tp: 0, fp: 0, tn: 0, fn: 0 };
}

export function evaluateLookbackProfile(
  corpus: readonly LabelledLookbackPair[],
  profile: typeof DEFAULT_LOOKBACK_PROFILE,
): LookbackMetricsResult {
  if (corpus.length === 0) return { status: 'UNAVAILABLE', reasonCode: 'NO_REVIEWED_DATA' };
  const scopes = new Map<string, MutableRow>([
    ['ALL', emptyRow()],
    ['HIGH', emptyRow()],
    ['MEDIUM', emptyRow()],
    ['LOW', emptyRow()],
    ['L', emptyRow()],
    ['R', emptyRow()],
    ['T', emptyRow()],
  ]);
  for (const pair of corpus) {
    const ranked = rankCandidate({
      reasonCodes: pair.reasonCodes,
      anchorTokens: distinctiveTokens(pair.anchorText),
      candidateTokens: distinctiveTokens(pair.candidateText),
      profile,
    });
    const predicted: readonly string[] = [
      'ALL',
      ranked.confidence,
      pair.tier,
      ...(ranked.confidence === 'HIGH' ? ['HIGH'] : []),
    ];
    for (const scope of new Set(predicted)) {
      const row = scopes.get(scope)!;
      const positive = ranked.confidence !== 'LOW';
      if (pair.expectedMatch) {
        row.positives += 1;
        if (positive) row.tp += 1;
        else row.fn += 1;
      } else {
        row.negatives += 1;
        if (positive) row.fp += 1;
        else row.tn += 1;
      }
    }
  }
  const rows = [...scopes.entries()].map(([scope, row]) => ({
    scope,
    ...row,
    precision: ratio(row.tp, row.tp + row.fp),
    recall: ratio(row.tp, row.tp + row.fn),
    falseMatchRateAmongHigh: scope === 'HIGH' ? ratio(row.fp, row.tp + row.fp) : null,
  }));
  return {
    status: 'MEASURED',
    benchmarkVersion: LOOKBACK_BENCHMARK_VERSION,
    profileVersion: profile.version,
    passBar: null,
    rows,
  };
}

/** Grid search is confined to the tuning split; the held-out split is untouched. */
export function tuneLookbackThresholds(
  tuningCorpus: readonly LabelledLookbackPair[],
): typeof DEFAULT_LOOKBACK_PROFILE {
  const candidates = [0.3, 0.34, 0.4];
  for (const highOverlap of candidates) {
    const profile = Object.freeze({ ...DEFAULT_LOOKBACK_PROFILE, highOverlap });
    const result = evaluateLookbackProfile(tuningCorpus, profile);
    if (result.status !== 'MEASURED') return DEFAULT_LOOKBACK_PROFILE;
    const high = result.rows.find((row) => row.scope === 'HIGH')!;
    const medium = result.rows.find((row) => row.scope === 'MEDIUM')!;
    if (
      (high.tp ?? 0) > 0 &&
      high.precision !== null &&
      (medium.precision === null || high.precision > medium.precision)
    ) {
      return profile;
    }
  }
  return DEFAULT_LOOKBACK_PROFILE;
}
