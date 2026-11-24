/**
 * P6.D1 — pure view model for scan states (Arch §7, C-09.1-2, G-8). It accepts
 * only a resolver envelope. Extra fields such as a quote are discarded, so no
 * record text can enter the UI through a scan response (I-1/I-6).
 */

import type { ResolverEnvelope } from '../contracts/envelope';

export const SCAN_UI_STRINGS = Object.freeze({
  title: 'Signal Finder',
  notice: 'Decision support, not a regulatory determination or legal advice.',
  run: 'Run scan now',
  idle: 'No scan has run for this issue yet.',
  noSignal: 'No signal was found in the current issue content.',
  signal: 'A possible signal was found and a review case was opened.',
  deferred: 'The scan was deferred before its time budget ended. Try again later.',
  degraded: 'The scan could not run safely because a required source was unavailable.',
  skipped: 'The scan skipped content that the app wrote itself.',
  unavailable: 'Manual scanning is not available on this installation.',
  error: 'The scan result could not be loaded.',
});

export interface ScanViewModel {
  readonly kind: 'IDLE' | 'RESULT' | 'UNAVAILABLE' | 'ERROR';
  readonly message: string;
  readonly state: string;
  readonly result: string;
  readonly reasonCode: string;
  readonly segmentsSeen: number;
  readonly segmentsScanned: number;
  readonly evidenceCount: number;
  readonly caseId: string | null;
}

const empty = (kind: ScanViewModel['kind'], message: string): ScanViewModel => ({
  kind,
  message,
  state: '',
  result: '',
  reasonCode: '',
  segmentsSeen: 0,
  segmentsScanned: 0,
  evidenceCount: 0,
  caseId: null,
});

const text = (value: unknown): string =>
  typeof value === 'string' && value.length > 0 ? value : '';

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;

export function scanViewModel(envelope: ResolverEnvelope<unknown> | null): ScanViewModel {
  if (envelope === null) return empty('IDLE', SCAN_UI_STRINGS.idle);
  if (envelope.code === 'NOT_FOUND' || envelope.code === 'NOT_PERMITTED') {
    return empty('UNAVAILABLE', SCAN_UI_STRINGS.unavailable);
  }
  if (envelope.code !== 'OK' || typeof envelope.data !== 'object' || envelope.data === null) {
    return empty('ERROR', SCAN_UI_STRINGS.error);
  }
  const data = envelope.data as Record<string, unknown>;
  const state = text(data.status);
  const result = text(data.result);
  const reasonCode = text(data.reasonCode);
  const message =
    result === 'SIGNAL'
      ? SCAN_UI_STRINGS.signal
      : result === 'NO_SIGNAL'
        ? SCAN_UI_STRINGS.noSignal
        : state === 'DEFERRED'
          ? SCAN_UI_STRINGS.deferred
          : state === 'FAILED'
            ? SCAN_UI_STRINGS.degraded
            : SCAN_UI_STRINGS.skipped;
  return {
    kind: 'RESULT',
    message,
    state,
    result,
    reasonCode,
    segmentsSeen: count(data.segmentsSeen),
    segmentsScanned: count(data.segmentsScanned),
    evidenceCount: count(data.evidenceCount),
    caseId: typeof data.caseId === 'string' && data.caseId.length > 0 ? data.caseId : null,
  };
}
