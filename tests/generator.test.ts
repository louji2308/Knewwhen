import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_SEED,
  JUDGE_SEED,
  assertSyntheticFixtures,
  generateScenarios,
  type GeneratorInput,
} from '../src/core/generator';
import { writeCsv } from '../src/core/csv';

const input: GeneratorInput = {
  seed: JUDGE_SEED,
  anchorDateISO: '2026-11-24',
  authorAccountId: 'acct-judge-1',
};

describe('P3.C2 seeded scenario generator (C-08.2, C-08.6, I-12)', () => {
  it('generates H1–H5 and A1–A2 with the canonical scenario labels', () => {
    const result = generateScenarios(input);
    expect(result.records.map((record) => record.ref)).toEqual([
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'A1',
      'A2',
    ]);
    const byRef = new Map(result.records.map((record) => [record.ref, record]));
    expect(byRef.get('H1')).toMatchObject({ scenario: 'SC-1', label: 'SIGNAL', origin: 'CSV' });
    expect(byRef.get('A1')).toMatchObject({ scenario: 'SC-1', label: 'SIGNAL', origin: 'SAMPLE' });
    expect(byRef.get('H4')).toMatchObject({ scenario: 'SC-2', label: 'SIGNAL' });
    expect(byRef.get('H5')).toMatchObject({ scenario: 'SC-2', label: 'SIGNAL', relatedTo: 'H4' });
    expect(byRef.get('H2')).toMatchObject({ scenario: 'SC-4', label: 'NO_SIGNAL' });
    expect(byRef.get('H3')).toMatchObject({ scenario: 'SC-4', label: 'NO_SIGNAL' });
    expect(byRef.get('A2')).toMatchObject({ scenario: 'SC-3', label: 'NO_SIGNAL' });
  });

  it('places H1 exactly 19 days before the anchor (FX-1) and A1/A2 on the anchor', () => {
    const result = generateScenarios(input);
    const byRef = new Map(result.records.map((record) => [record.ref, record]));
    expect(byRef.get('H1')!.createdISO.slice(0, 10)).toBe('2026-11-05');
    expect(byRef.get('H4')!.createdISO.slice(0, 10)).toBe('2026-11-12');
    expect(byRef.get('H5')!.createdISO.slice(0, 10)).toBe('2026-11-21');
    expect(byRef.get('A1')!.createdISO.slice(0, 10)).toBe('2026-11-24');
    expect(byRef.get('A2')!.createdISO.slice(0, 10)).toBe('2026-11-24');
  });

  it('emits a CSV only for the five historical records, with backdated comments', () => {
    const result = generateScenarios(input);
    expect(result.csv.trimEnd().split('\r\n')).toHaveLength(6);
    expect(result.csv).toContain('"Comment"');
    expect(result.csv).toContain(';acct-judge-1;');
    expect(result.csv).not.toContain('dark mode option');
  });

  it('is byte-identical for the same seed, anchor and author, and changes with the seed', () => {
    const first = generateScenarios(input);
    expect(generateScenarios(input).csv).toBe(first.csv);
    expect(generateScenarios(input).labels).toEqual(first.labels);
    expect(generateScenarios({ ...input, seed: input.seed + 1 }).csv).not.toBe(first.csv);
    expect(generateScenarios({ ...input, anchorDateISO: '2026-11-25' }).csv).not.toBe(first.csv);
  });

  it('ground-truth expected quotes are verbatim substrings of the record text', () => {
    const result = generateScenarios(input);
    for (const label of result.labels) {
      const record = result.records.find((item) => item.ref === label.ref)!;
      for (const quote of label.expectedQuotes) {
        expect(record.description).toContain(quote);
      }
    }
  });

  it('uses a separate, larger benchmark seed that is deterministic', () => {
    expect(BENCHMARK_SEED).not.toBe(JUDGE_SEED);
    const first = generateScenarios({ ...input, seed: BENCHMARK_SEED });
    expect(generateScenarios({ ...input, seed: BENCHMARK_SEED })).toEqual(first);
  });

  it('passes the I-12 synthetic-fixture check and rejects planted real data', () => {
    const result = generateScenarios(input);
    expect(() => assertSyntheticFixtures(result)).not.toThrow();
    const tainted = {
      ...result,
      records: result.records.map((record, index) =>
        index === 0
          ? { ...record, description: 'Patient Jane Doe at Acme Medical was injured.' }
          : record,
      ),
    };
    expect(() => assertSyntheticFixtures(tainted)).toThrow('NON_SYNTHETIC_FIXTURE');
  });

  it('the generated CSV is accepted by the hand-written writer deterministically', () => {
    const result = generateScenarios(input);
    expect(writeCsv(result.csvTable)).toBe(result.csv);
  });
});
