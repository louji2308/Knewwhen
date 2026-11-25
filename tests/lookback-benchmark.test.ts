import { describe, expect, it } from 'vitest';
import {
  buildLookbackCorpus,
  evaluateLookbackProfile,
  LOOKBACK_BENCHMARK_VERSION,
  tuneLookbackThresholds,
} from '../src/core/lookback-benchmark';
import { BENCHMARK_SEED } from '../src/core/generator';

describe('P8.B1/B2 lookback benchmark (C-03.12, OI-5, Arch §16.3)', () => {
  const corpus = buildLookbackCorpus(BENCHMARK_SEED);

  it('is deterministic, synthetic and split into tuning and held-out data', () => {
    expect(buildLookbackCorpus(BENCHMARK_SEED)).toEqual(corpus);
    expect(corpus.length).toBeGreaterThanOrEqual(40);
    expect(new Set(corpus.map((row) => row.split))).toEqual(new Set(['TUNING', 'HELD_OUT']));
    expect(new Set(corpus.map((row) => row.tier))).toEqual(new Set(['L', 'R', 'T']));
    expect(LOOKBACK_BENCHMARK_VERSION).toBe('lookback-benchmark-v1');
  });

  it('tunes only on the tuning split', () => {
    const heldOut = corpus.filter((row) => row.split === 'HELD_OUT');
    const profile = tuneLookbackThresholds(corpus.filter((row) => row.split === 'TUNING'));
    const baseline = tuneLookbackThresholds([]);
    expect([0.3, 0.34, 0.4]).toContain(profile.highOverlap);
    expect(baseline.highOverlap).toBe(0.34);
    expect(heldOut.length).toBeGreaterThan(0);
  });

  it('reports HIGH more precise than MEDIUM on the held-out split, without a pass bar', () => {
    const profile = tuneLookbackThresholds(corpus.filter((row) => row.split === 'TUNING'));
    const result = evaluateLookbackProfile(
      corpus.filter((row) => row.split === 'HELD_OUT'),
      profile,
    );
    expect(result.status).toBe('MEASURED');
    if (result.status !== 'MEASURED') return;
    const high = result.rows.find((row) => row.scope === 'HIGH');
    const medium = result.rows.find((row) => row.scope === 'MEDIUM');
    expect(high?.precision).toBe(1);
    expect(medium?.precision).toBe(0);
    expect(high!.precision!).toBeGreaterThan(medium!.precision!);
    expect(result.passBar).toBeNull();
  });
});
