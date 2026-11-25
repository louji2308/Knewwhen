/**
 * P10.A2 — pure admin Health view model (C-10.8, N-09, I-5/I-6).
 * Req: C-10.8, N-09. The view keeps only known snapshot fields.
 */

import { describe, expect, it } from 'vitest';
import type { ResolverEnvelope } from '../src/contracts/envelope';
import { SCAN_STATUSES } from '../src/contracts/scan';
import { VALIDATION_STATUSES } from '../src/contracts/evidence';
import { scanWording } from '../src/core/wording';
import type { HealthSnapshot } from '../src/services/health';
import { HEALTH_UI_STRINGS, healthViewModel } from '../src/frontend/health-view';

const envelope = (
  data: unknown,
  code: ResolverEnvelope<unknown>['code'] = 'OK',
): ResolverEnvelope<unknown> => ({
  data,
  roleHint: 'ADMIN',
  correlationId: 'corr-health-1',
  code,
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

const snapshot: HealthSnapshot = {
  windowDays: 7,
  scansByStatus: { QUEUED: 1, RUNNING: 0, DONE: 2, FAILED: 0, DEFERRED: 1 },
  scansByResult: { SIGNAL: 2, NO_SIGNAL: 1, SKIPPED: 1, UNKNOWN: 0 },
  stalledScans: 0,
  deferredCount: 1,
  evidenceStateCounts: {
    VALID: 4,
    RELOCATED: 0,
    MODIFIED: 1,
    UNAVAILABLE: 0,
    UNVERIFIABLE: 0,
  },
  writebackPending: 2,
  writebackFailed: 0,
  lastReconcilerAt: '2026-11-24T06:00:00.000Z',
  capsHit: 1,
  ruleSetVersion: 'fda-2026-11',
  ruleSetStatus: 'PREVIEW',
  hashKeyStatus: 'PRESENT',
  ai: { issueCalls: 3, siteCalls: 8, perIssueCap: 10, perSiteCap: 50, breakerState: 'CLOSED' },
};

describe('P10.A2 admin Health view states (C-10.8, N-09)', () => {
  it('maps every envelope state to a fixed model with the decision-support notice', () => {
    const cases = [
      [healthViewModel(null), 'IDLE', HEALTH_UI_STRINGS.idle],
      [healthViewModel(envelope(null, 'NOT_FOUND')), 'UNAVAILABLE', HEALTH_UI_STRINGS.unavailable],
      [
        healthViewModel(envelope(null, 'NOT_PERMITTED')),
        'UNAVAILABLE',
        HEALTH_UI_STRINGS.unavailable,
      ],
      [
        healthViewModel(envelope(snapshot, 'DEPENDENCY_FAILED')),
        'ERROR',
        HEALTH_UI_STRINGS.dependencyFailed,
      ],
      [healthViewModel(envelope(snapshot, 'INVALID_REQUEST')), 'ERROR', HEALTH_UI_STRINGS.error],
      [
        healthViewModel(envelope(snapshot, 'ERROR' as ResolverEnvelope<unknown>['code'])),
        'ERROR',
        HEALTH_UI_STRINGS.error,
      ],
      [healthViewModel(envelope(null)), 'ERROR', HEALTH_UI_STRINGS.error],
      [healthViewModel(envelope(snapshot)), 'READY', HEALTH_UI_STRINGS.ready],
    ] as const;

    for (const [model, kind, message] of cases) {
      expect(model.kind).toBe(kind);
      expect(model.message).toBe(message);
      expect(model.notice).toBe(HEALTH_UI_STRINGS.notice);
    }
    expect(healthViewModel(null).snapshot).toBeNull();
    expect(healthViewModel(envelope(snapshot)).snapshot).toEqual(snapshot);
  });

  it('accepts only known snapshot fields and discards quotes and account ids', () => {
    const hostile = {
      ...snapshot,
      quote: 'CANARY_RECORD_TEXT',
      accountId: 'acc-canary-123',
      rawText: 'CANARY_RECORD_TEXT',
      scansByStatus: { ...snapshot.scansByStatus, EXTRA_STATUS: 99 },
      evidenceStateCounts: { ...snapshot.evidenceStateCounts, EXTRA_STATE: 99 },
    };
    const model = healthViewModel(envelope(hostile));
    const serialised = JSON.stringify(model);
    expect(serialised).not.toContain('CANARY_RECORD_TEXT');
    expect(serialised).not.toContain('acc-canary-123');
    expect(Object.keys(model.snapshot ?? {}).sort()).toEqual(Object.keys(snapshot).sort());
    expect(Object.keys(model.snapshot?.scansByStatus ?? {}).sort()).toEqual(
      [...SCAN_STATUSES].sort(),
    );
    expect(Object.keys(model.snapshot?.evidenceStateCounts ?? {}).sort()).toEqual(
      [...VALIDATION_STATUSES].sort(),
    );
  });

  it('normalises malformed codes, counts and timestamps rather than showing them', () => {
    const model = healthViewModel(
      envelope({
        ...snapshot,
        deferredCount: -3,
        ruleSetStatus: 'BOGUS_STATUS',
        hashKeyStatus: 'CANARY_RECORD_TEXT',
        ruleSetVersion: 'bad version',
        lastReconcilerAt: 'acc-canary-123 wrote CANARY_RECORD_TEXT',
        ai: { ...snapshot.ai, breakerState: 'MAYBE' },
      }),
    );
    expect(model.kind).toBe('READY');
    expect(model.snapshot).toMatchObject({
      deferredCount: 0,
      ruleSetStatus: 'UNKNOWN',
      hashKeyStatus: 'UNKNOWN',
      ruleSetVersion: '',
      lastReconcilerAt: null,
      ai: { breakerState: 'UNKNOWN' },
    });
    expect(JSON.stringify(model)).not.toContain('CANARY_RECORD_TEXT');
    expect(JSON.stringify(model)).not.toContain('acc-canary-123');
  });

  it('passes the authored-string wording scan and keeps the disclaimer exact', () => {
    expect(scanWording(strings(HEALTH_UI_STRINGS))).toEqual({ status: 'CLEAN' });
    const models = [
      null,
      envelope(null, 'NOT_FOUND'),
      envelope(null, 'DEPENDENCY_FAILED'),
      envelope(snapshot, 'INVALID_REQUEST'),
      envelope(snapshot),
    ].map(healthViewModel);
    expect(scanWording(models.flatMap((model) => [model.message, model.notice]))).toEqual({
      status: 'CLEAN',
    });
    expect(HEALTH_UI_STRINGS.notice).toBe(
      'Decision support, not a regulatory determination or legal advice.',
    );
  });
});
