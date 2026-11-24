import { describe, expect, it } from 'vitest';
import { scanViewModel, SCAN_UI_STRINGS } from '../src/frontend/scan-view';
import type { ResolverEnvelope } from '../src/contracts/envelope';

const envelope = (data: unknown, code: ResolverEnvelope<unknown>['code'] = 'OK') => ({
  data,
  roleHint: 'REVIEWER',
  correlationId: 'corr-1',
  code,
});

describe('P6.D1 scan states in the panel (C-09.1-2, C-01.5, G-8)', () => {
  it('renders no-signal as an explicit result, never as a silent dismissal', () => {
    const model = scanViewModel(
      envelope({
        status: 'DONE',
        result: 'NO_SIGNAL',
        reasonCode: 'NO_SIGNAL',
        segmentsSeen: 3,
        segmentsScanned: 3,
        evidenceCount: 0,
        caseId: null,
      }),
    );
    expect(model).toMatchObject({
      kind: 'RESULT',
      state: 'DONE',
      result: 'NO_SIGNAL',
      reasonCode: 'NO_SIGNAL',
      segmentsSeen: 3,
    });
    expect(model.message).toBe(SCAN_UI_STRINGS.noSignal);
  });

  it('shows deferred, failed, skipped and unavailable states with fixed wording', () => {
    expect(
      scanViewModel(
        envelope({
          status: 'DEFERRED',
          result: 'SKIPPED',
          reasonCode: 'SCAN_TIMEOUT',
          segmentsSeen: 2,
          segmentsScanned: 2,
          evidenceCount: 0,
          caseId: null,
        }),
      ),
    ).toMatchObject({ kind: 'RESULT', state: 'DEFERRED', message: SCAN_UI_STRINGS.deferred });
    expect(
      scanViewModel(
        envelope({
          status: 'FAILED',
          result: 'SKIPPED',
          reasonCode: 'LEXICON_MISSING',
          segmentsSeen: 1,
          segmentsScanned: 0,
          evidenceCount: 0,
          caseId: null,
        }),
      ),
    ).toMatchObject({ kind: 'RESULT', state: 'FAILED', message: SCAN_UI_STRINGS.degraded });
    expect(
      scanViewModel(
        envelope({
          status: 'DONE',
          result: 'SKIPPED',
          reasonCode: 'SKIPPED_SELF',
          segmentsSeen: 1,
          segmentsScanned: 0,
          evidenceCount: 0,
          caseId: null,
        }),
      ),
    ).toMatchObject({ kind: 'RESULT', message: SCAN_UI_STRINGS.skipped });
    expect(scanViewModel(envelope(null, 'NOT_FOUND'))).toMatchObject({
      kind: 'UNAVAILABLE',
      message: SCAN_UI_STRINGS.unavailable,
    });
    expect(scanViewModel(null)).toMatchObject({ kind: 'IDLE', message: SCAN_UI_STRINGS.idle });
  });

  it('shows a signal case id but never a quote or record text', () => {
    const model = scanViewModel(
      envelope({
        status: 'DONE',
        result: 'SIGNAL',
        reasonCode: 'SIGNAL',
        segmentsSeen: 1,
        segmentsScanned: 1,
        evidenceCount: 1,
        caseId: 'case-1',
        quote: 'sensitive record text',
      }),
    );
    expect(model).toMatchObject({ kind: 'RESULT', result: 'SIGNAL', caseId: 'case-1' });
    expect(JSON.stringify(model)).not.toContain('sensitive record text');
  });
});
