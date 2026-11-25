/** P10.A1 — sample/CSV view model tests (C-08.1–9, I-6, I-12, WF-5). */
import { describe, expect, it } from 'vitest';
import type { ResolverEnvelope } from '../src/contracts/envelope';
import { writeCsv } from '../src/core/csv';
import { scanWording } from '../src/core/wording';
import { SAMPLE_UI_STRINGS, csvCopyBlock, sampleViewModel } from '../src/frontend/sample-view';

type Code = ResolverEnvelope<unknown>['code'];

const envelope = (data: unknown, code: Code = 'OK'): ResolverEnvelope<unknown> => ({
  data,
  code,
  roleHint: 'SITE_ADMIN',
  correlationId: 'corr-sample-1',
});

const safeData = {
  projectKey: 'KW',
  sampleCount: 2,
  csvIssueCount: 5,
  csvRowCount: 5,
  createdKeys: ['KW-101', 'KW-102'],
  complete: true,
  csv: '"Created","Summary"\r\n"2026-11-05T09:00:00.000Z","secret@example.invalid"\r\n',
  quote: 'secret record text',
  unexpectedField: 'do-not-copy',
};

const generatedCsv = writeCsv({
  header: ['Created', 'Summary', 'Description', 'Labels'],
  rows: [
    {
      fields: [
        '2026-11-05T09:12:00.000Z',
        'Synthetic summary',
        'Synthetic description',
        'product-beta',
      ],
      comments: [],
    },
  ],
});

function strings(value: unknown, into: string[] = []): readonly string[] {
  if (typeof value === 'string') {
    into.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) strings(item, into);
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) strings(item, into);
  }
  return into;
}

describe('P10.A1 sample view model (C-08.1, C-08.9, I-6)', () => {
  it('narrows envelope data to fixed counts and issue keys only', () => {
    const model = sampleViewModel(envelope(safeData));
    expect(model.state).toBe('READY');
    expect(Object.keys(model).sort()).toEqual(
      [
        'complete',
        'createdKeys',
        'csvIssueCount',
        'csvRowCount',
        'message',
        'projectKey',
        'sampleCount',
        'state',
      ].sort(),
    );
    expect(model).toMatchObject({
      projectKey: 'KW',
      sampleCount: 2,
      csvIssueCount: 5,
      csvRowCount: 5,
      createdKeys: ['KW-101', 'KW-102'],
    });
    const json = JSON.stringify(model);
    expect(json).not.toContain('secret@example.invalid');
    expect(json).not.toContain('secret record text');
    expect(json).not.toContain('do-not-copy');
  });

  it('maps null, NOT_FOUND, dependency failure and errors to fixed states (G-8)', () => {
    expect(sampleViewModel(null).state).toBe('IDLE');
    expect(sampleViewModel(null).message).toBe(SAMPLE_UI_STRINGS.idle);
    expect(sampleViewModel(envelope(null, 'NOT_FOUND')).state).toBe('UNAVAILABLE');
    expect(sampleViewModel(envelope(null, 'DEPENDENCY_FAILED')).state).toBe('ERROR');
    expect(sampleViewModel(envelope(null, 'INVALID_REQUEST')).state).toBe('ERROR');
    expect(sampleViewModel(envelope({ ...safeData, projectKey: '' })).state).toBe('ERROR');
  });

  it('shows a continuation message for a partial load and for an unknown completion flag', () => {
    const partial = sampleViewModel(envelope({ ...safeData, complete: false }));
    expect(partial.state).toBe('READY');
    expect(partial.complete).toBe(false);
    expect(partial.message).toBe(SAMPLE_UI_STRINGS.partial);
    expect(sampleViewModel(envelope({ ...safeData, complete: undefined })).complete).toBe(false);
  });

  it('shows a distinct second-load message for an allow-listed result code (C-08.9)', () => {
    const model = sampleViewModel(
      envelope({ projectKey: 'KW', resultCode: 'ALREADY_LOADED' }, 'INVALID_REQUEST'),
    );
    expect(model.state).toBe('ERROR');
    expect(model.message).toBe(SAMPLE_UI_STRINGS.alreadyLoaded);
    expect(
      sampleViewModel(
        envelope({ projectKey: 'KW', resultCode: 'untrusted prose' }, 'INVALID_REQUEST'),
      ).message,
    ).toBe(SAMPLE_UI_STRINGS.error);
  });

  it('drops negative or non-integer counts instead of showing them', () => {
    const model = sampleViewModel(
      envelope({ ...safeData, sampleCount: -3, csvRowCount: 2.5, createdKeys: ['KW-1', 7, ''] }),
    );
    expect(model.sampleCount).toBe(0);
    expect(model.csvRowCount).toBe(0);
    expect(model.createdKeys).toEqual(['KW-1']);
  });
});

describe('P10.A1 CSV copy block (C-08.4, I-12, WF-5)', () => {
  it('accepts only a generated-shaped CSV and prefixes it with the fixed label', () => {
    const block = csvCopyBlock(generatedCsv);
    expect(block.accepted).toBe(true);
    expect(block.text).toBe(`${SAMPLE_UI_STRINGS.csvLabel}\n${generatedCsv}`);
  });

  it('rejects contact data, URLs, phone-like digits and arbitrary object keys', () => {
    const variants = [
      generatedCsv.replace('Synthetic summary', 'Mail me at a@b.invalid'),
      generatedCsv.replace('Synthetic summary', 'See https://example.invalid/page'),
      generatedCsv.replace('Synthetic description', 'Call 555-123-4567 now'),
      generatedCsv.replace('"Created"', '"SecretKey"'),
      { csv: generatedCsv },
    ];
    for (const variant of variants) {
      const block = csvCopyBlock(variant);
      expect(block.accepted).toBe(false);
      expect(block.text).toBe(SAMPLE_UI_STRINGS.csvRejected);
      expect(block.text).not.toContain('Synthetic summary');
    }
  });

  it('has no banned wording in any exported UI string', () => {
    expect(scanWording(strings(SAMPLE_UI_STRINGS))).toEqual({ status: 'CLEAN' });
  });
});
