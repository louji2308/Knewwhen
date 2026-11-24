/**
 * P3.C2 — seeded scenario generator (C-08.2, C-08.6, I-12). Pure core: no
 * @forge/* import, no Math.random, no date library. Fixture text is frozen in
 * this module from Workflow and UI demo.md §10; only the seed, anchor date and
 * author id are inputs. The same inputs always yield byte-identical CSV.
 *
 * The benchmark uses a separate, larger seed; its corpus is built in P9 from
 * this same structure, never from hardcoded expected outcomes.
 */

import { writeCsv, type CsvComment, type CsvTable } from './csv';

export const JUDGE_SEED = 20261124;
export const BENCHMARK_SEED = 20261201;
export const GENERATOR_VERSION = 'generator-v1' as const;

export type ScenarioId = 'SC-1' | 'SC-2' | 'SC-3' | 'SC-4';
export type SignalLabel = 'SIGNAL' | 'NO_SIGNAL';
export type RecordRef = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'A1' | 'A2';

export interface GeneratorInput {
  readonly seed: number;
  /** Date only, YYYY-MM-DD, in the rule's time zone (WF-6). */
  readonly anchorDateISO: string;
  /** Opaque platform account id; no personal data is stored in fixtures. */
  readonly authorAccountId: string;
}

export interface FixtureTemplate {
  readonly summary: string;
  readonly description: string;
  readonly scenario: ScenarioId;
  readonly label: SignalLabel;
  readonly daysBeforeAnchor: number;
  readonly timeOfDay: string;
  readonly labelNames: readonly string[];
  readonly comments: readonly { readonly body: string }[];
}

/** Transcribed from Workflow and UI demo.md §10. All names are fictional. */
export const FIXTURE_TEMPLATES: Readonly<Record<RecordRef, FixtureTemplate>> = Object.freeze({
  H1: {
    summary: 'Field call: Alpha dose app hung at Clinic North',
    description:
      'Phone note from Clinic North: the Alpha app froze during dose calculation yesterday and the nurse finished the calculation by hand. They said the patient was sent to the emergency room as a precaution. Passing to engineering.',
    scenario: 'SC-1',
    label: 'SIGNAL',
    daysBeforeAnchor: 19,
    timeOfDay: '09:12:00.000Z',
    labelNames: ['product-alpha'],
    comments: [{ body: 'Passing to engineering.' }],
  },
  H2: {
    summary: 'Clinic North: Alpha app froze on the login screen',
    description:
      'The Alpha app froze on the login screen after the update. No patient was involved; restarting the tablet fixed it.',
    scenario: 'SC-4',
    label: 'NO_SIGNAL',
    daysBeforeAnchor: 40,
    timeOfDay: '10:24:00.000Z',
    labelNames: ['product-alpha'],
    comments: [],
  },
  H3: {
    summary: 'Feature request: show each step of the dose calculation',
    description:
      'Nurses would like the Alpha app to show each step of the dose calculation on screen.',
    scenario: 'SC-4',
    label: 'NO_SIGNAL',
    daysBeforeAnchor: 30,
    timeOfDay: '11:05:00.000Z',
    labelNames: ['product-alpha'],
    comments: [],
  },
  H4: {
    summary: 'Beta companion app shows glucose in mmol/L when the meter is set to mg/dL',
    description:
      'After a locale change the Beta app converts readings twice, so values appear in the wrong unit.',
    scenario: 'SC-2',
    label: 'SIGNAL',
    daysBeforeAnchor: 12,
    timeOfDay: '12:40:00.000Z',
    labelNames: ['product-beta'],
    comments: [],
  },
  H5: {
    summary: 'Customer: readings in the Beta app look far too low',
    description:
      'Customer says the readings in the Beta app look far too low compared with the meter display.',
    scenario: 'SC-2',
    label: 'SIGNAL',
    daysBeforeAnchor: 3,
    timeOfDay: '14:15:00.000Z',
    labelNames: ['product-beta'],
    comments: [{ body: 'Linked to the earlier Beta unit ticket.' }],
  },
  A1: {
    summary: 'Clinic North: app froze during dose calculation',
    description:
      'Our nurse reports the app froze during dose calculation on Tuesday. The patient went to the ER for observation.',
    scenario: 'SC-1',
    label: 'SIGNAL',
    daysBeforeAnchor: 0,
    timeOfDay: '15:00:00.000Z',
    labelNames: ['product-alpha'],
    comments: [],
  },
  A2: {
    summary: 'Feature request: dark mode for the Alpha app settings',
    description: 'Please add a dark mode option to the settings screen.',
    scenario: 'SC-3',
    label: 'NO_SIGNAL',
    daysBeforeAnchor: 0,
    timeOfDay: '16:30:00.000Z',
    labelNames: ['product-alpha'],
    comments: [],
  },
});

const CSV_REFS: readonly RecordRef[] = ['H1', 'H2', 'H3', 'H4', 'H5'];
const ALL_REFS: readonly RecordRef[] = ['H1', 'H2', 'H3', 'H4', 'H5', 'A1', 'A2'];
const DAY_MS = 86_400_000;

export interface GeneratedRecord {
  readonly ref: RecordRef;
  readonly scenario: ScenarioId;
  readonly label: SignalLabel;
  readonly origin: 'CSV' | 'SAMPLE';
  readonly summary: string;
  readonly description: string;
  readonly createdISO: string;
  readonly labels: readonly string[];
  readonly relatedTo?: string;
  readonly comments: readonly CsvComment[];
}

export interface GroundTruthLabel {
  readonly ref: RecordRef;
  readonly scenario: ScenarioId;
  readonly label: SignalLabel;
  readonly expectedQuotes: readonly string[];
}

export interface GenerationResult {
  readonly generatorVersion: typeof GENERATOR_VERSION;
  readonly seed: number;
  readonly anchorDateISO: string;
  readonly records: readonly GeneratedRecord[];
  readonly labels: readonly GroundTruthLabel[];
  readonly csvTable: CsvTable;
  readonly csv: string;
}

/** xorshift32: deterministic, dependency-free, nonzero state. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
}

const EXPECTED_QUOTES: Readonly<Partial<Record<RecordRef, readonly string[]>>> = {
  H1: ['app froze during dose calculation', 'patient was sent to the emergency room'],
  A1: ['app froze during dose calculation', 'patient went to the ER'],
  H4: ['values appear in the wrong unit'],
  H5: ['readings in the Beta app look far too low'],
};

function createdISO(anchorDateISO: string, daysBefore: number, timeOfDay: string): string {
  const anchor = Date.parse(`${anchorDateISO}T00:00:00.000Z`);
  if (!Number.isFinite(anchor)) throw new Error('INVALID_ANCHOR_DATE');
  return new Date(anchor - daysBefore * DAY_MS).toISOString().slice(0, 10) + `T${timeOfDay}`;
}

export function generateScenarios(input: GeneratorInput): GenerationResult {
  const random = createRandom(input.seed);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.anchorDateISO) || !input.authorAccountId) {
    throw new Error('INVALID_GENERATOR_INPUT');
  }

  const records: GeneratedRecord[] = ALL_REFS.map((ref) => {
    const template = FIXTURE_TEMPLATES[ref];
    const created = createdISO(input.anchorDateISO, template.daysBeforeAnchor, template.timeOfDay);
    const comments: CsvComment[] = template.comments.map((comment) => {
      const hour = 8 + (random() % 8);
      const minute = random() % 60;
      const stamp = `${created.slice(0, 10)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
      return { date: stamp, accountId: input.authorAccountId, body: comment.body };
    });
    return {
      ref,
      scenario: template.scenario,
      label: template.label,
      origin: CSV_REFS.includes(ref) ? 'CSV' : 'SAMPLE',
      summary: template.summary,
      description: template.description,
      createdISO: created,
      labels: template.labelNames,
      ...(ref === 'H5' ? { relatedTo: 'H4' } : {}),
      comments,
    };
  });

  const csvRows = records
    .filter((record) => record.origin === 'CSV')
    .map((record) => ({
      fields: [record.createdISO, record.summary, record.description, record.labels.join(' ')],
      comments: record.comments,
    }));
  const csvTable: CsvTable = {
    header: ['Created', 'Summary', 'Description', 'Labels'],
    rows: csvRows,
  };

  const labels: GroundTruthLabel[] = records.map((record) => ({
    ref: record.ref,
    scenario: record.scenario,
    label: record.label,
    expectedQuotes: EXPECTED_QUOTES[record.ref] ?? [],
  }));

  return {
    generatorVersion: GENERATOR_VERSION,
    seed: input.seed,
    anchorDateISO: input.anchorDateISO,
    records,
    labels,
    csvTable,
    csv: writeCsv(csvTable),
  };
}

/**
 * I-12 guard: fixture prose must be the frozen fictional templates, product
 * labels must use the `product-` prefix, and no contact data may appear. It
 * rejects free text before it can reach a demo site or a benchmark.
 */
export function assertSyntheticFixtures(result: GenerationResult): void {
  for (const record of result.records) {
    const template = FIXTURE_TEMPLATES[record.ref];
    if (
      !template ||
      record.summary !== template.summary ||
      record.description !== template.description ||
      !record.labels.every((label) => label.startsWith('product-')) ||
      /@|https?:\/\/|\b\d{3}[- ]\d{3}\b/u.test(`${record.summary} ${record.description}`)
    ) {
      throw new Error('NON_SYNTHETIC_FIXTURE');
    }
  }
}
