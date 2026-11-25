/**
 * P10.A1 — pure sample/CSV view model (Arch §3, C-08.1–9, WF-5, I-6/I-12).
 * The CSV is supplied by the pure generator; this module never generates it.
 * Only fixed counts, issue keys and an allow-listed copy block can reach the
 * admin page, so arbitrary envelope fields and record text cannot leak in.
 */

import type { ResolverEnvelope } from '../contracts/envelope';

export const SAMPLE_UI_STRINGS = Object.freeze({
  title: 'Sample scenario and historical CSV',
  notice: 'Decision support, not a regulatory determination or legal advice.',
  idle: 'No sample has been generated for this project yet.',
  ready: 'The sample details are loaded.',
  partial: 'Part of the sample was loaded. Load the remaining records again.',
  unavailable: 'Sample delivery is not available on this installation.',
  error: 'The sample details could not be loaded.',
  alreadyLoaded: 'The sample is already loaded in this project. No new issues were created.',
  load: 'Load sample issues',
  csvHeading: 'Historical CSV',
  csvReady: 'The synthetic CSV is ready to copy.',
  csvInvalid: 'The CSV could not be shown because it did not pass the synthetic-data checks.',
  projectMissing: 'Add a watched project before loading the sample.',
  csvLabel: 'CSV to copy',
  csvRejected: 'The CSV was not shown because it did not pass the synthetic-data checks.',
});

export type SampleViewState = 'IDLE' | 'READY' | 'UNAVAILABLE' | 'ERROR';

export interface SampleViewModel {
  readonly state: SampleViewState;
  readonly message: string;
  readonly projectKey: string;
  readonly sampleCount: number;
  readonly csvIssueCount: number;
  readonly csvRowCount: number;
  readonly createdKeys: readonly string[];
  readonly complete: boolean;
}

export type CsvCopyBlock =
  | { readonly accepted: true; readonly text: string }
  | { readonly accepted: false; readonly text: string };

type Data = Readonly<Record<string, unknown>>;

const SAMPLE_RESULT_CODES = Object.freeze([
  'OK',
  'PARTIAL_LOAD',
  'INVALID_REQUEST',
  'PROJECT_NOT_WATCHED',
  'ALREADY_LOADED',
  'DEPENDENCY_FAILED',
] as const);
const ISSUE_KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/u;
const ALLOWED_HEADERS = Object.freeze(['Created', 'Summary', 'Description', 'Labels', 'Comment']);
const REQUIRED_HEADERS = Object.freeze(['Created', 'Summary', 'Description', 'Labels']);
const URL_PATTERN = /https?:\/\/|www\./iu;
const PHONE_PATTERN = /\+?\d[\d ().-]{6,}\d/u;
const ISO_TIMESTAMP = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/gu;
const ISO_DATE = /\d{4}-\d{2}-\d{2}/gu;

const record = (value: unknown): Data | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Data) : null;

function safeText(value: unknown, maximum = 128): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) return '';
  return /[\u0000-\u001f\u007f]/u.test(value) ? '' : value;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function issueKeys(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && ISSUE_KEY.test(item)) out.push(item);
  }
  return out;
}

function messageFor(state: SampleViewState, complete = true, resultCode: string = 'OK'): string {
  if (state === 'ERROR' && resultCode === 'ALREADY_LOADED') {
    return SAMPLE_UI_STRINGS.alreadyLoaded;
  }
  switch (state) {
    case 'IDLE':
      return SAMPLE_UI_STRINGS.idle;
    case 'READY':
      return complete ? SAMPLE_UI_STRINGS.ready : SAMPLE_UI_STRINGS.partial;
    case 'UNAVAILABLE':
      return SAMPLE_UI_STRINGS.unavailable;
    case 'ERROR':
      return SAMPLE_UI_STRINGS.error;
  }
}

function empty(state: SampleViewState): SampleViewModel {
  return {
    state,
    message: messageFor(state),
    projectKey: '',
    sampleCount: 0,
    csvIssueCount: 0,
    csvRowCount: 0,
    createdKeys: [],
    complete: true,
  };
}

/** Narrow a resolver envelope to counts and issue keys; never carry the CSV. */
export function sampleViewModel(envelope: ResolverEnvelope<unknown> | null): SampleViewModel {
  if (envelope === null) return empty('IDLE');
  const state: SampleViewState =
    envelope.code === 'OK' ? 'READY' : envelope.code === 'NOT_FOUND' ? 'UNAVAILABLE' : 'ERROR';
  const data = record(envelope.data);
  const rawCode = data?.['resultCode'];
  const resultCode =
    typeof rawCode === 'string' && SAMPLE_RESULT_CODES.some((code) => code === rawCode)
      ? rawCode
      : 'OK';
  const projectKey = data === null ? '' : safeText(data['projectKey'], 32);
  if (projectKey === '') return empty(state === 'READY' ? 'ERROR' : state);
  const complete = data?.['complete'] === true;
  return {
    state,
    message: messageFor(state, complete, resultCode),
    projectKey,
    sampleCount: count(data?.['sampleCount']),
    csvIssueCount: count(data?.['csvIssueCount']),
    csvRowCount: count(data?.['csvRowCount']),
    createdKeys: issueKeys(data?.['createdKeys']),
    complete,
  };
}

/**
 * Deliberately strict synthetic-data gate (I-12). Contact markers, URLs,
 * phone-like digit runs and unknown header keys are rejected before a CSV can
 * be copied into a file. Dates from the generator are stripped before the
 * phone check so system timestamps are not mistaken for contact data.
 */
export function csvCopyBlock(csv: unknown): CsvCopyBlock {
  const reject = (): CsvCopyBlock => ({ accepted: false, text: SAMPLE_UI_STRINGS.csvRejected });
  if (typeof csv !== 'string' || csv.length === 0) return reject();
  if (csv.includes('@') || URL_PATTERN.test(csv)) return reject();

  const firstLine = csv.split(/\r?\n/u, 1)[0] ?? '';
  const headers = firstLine.split(',').map((cell) => cell.replace(/^"|"$/gu, ''));
  if (
    headers.length < REQUIRED_HEADERS.length ||
    headers.some((header) => !ALLOWED_HEADERS.includes(header)) ||
    REQUIRED_HEADERS.some((header) => !headers.includes(header))
  ) {
    return reject();
  }

  const withoutDates = csv.replace(ISO_TIMESTAMP, '').replace(ISO_DATE, '');
  if (PHONE_PATTERN.test(withoutDates)) return reject();
  return { accepted: true, text: `${SAMPLE_UI_STRINGS.csvLabel}\n${csv}` };
}
