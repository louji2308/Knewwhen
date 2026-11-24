import { describe, expect, it } from 'vitest';
import type { GateContext } from '../src/contracts/authorisation';
import type { AuditEvent } from '../src/handlers/authorisation';
import {
  AWARENESS_ACTIONS,
  createAwarenessDispatcher,
  isAwarenessAction,
} from '../src/handlers/awareness-dispatch';
import type { AwarenessDependencies } from '../src/handlers/awareness';
import { captureEvidence } from '../src/services/evidence';
import type { HashKeyMaterial } from '../src/services/hash-key';
import { createRepositories } from '../src/services/repositories';
import { createTrailService } from '../src/services/trail';
import type { AuditRepository } from '../src/services/audit';
import { createSqlFake } from './support/sql-fake';

const KEY: HashKeyMaterial = { id: 'dispatch-key', value: 'fk-dispatch-key' };
const context: GateContext = { accountId: 'acct-dispatch', canBrowseResource: true };

function fixture(roles: readonly ('VIEWER' | 'REVIEWER' | 'QUALIFIED_PERSON')[] = ['REVIEWER']) {
  const repositories = createRepositories(createSqlFake());
  const auditEvents: string[] = [];
  const audit: AuditRepository = {
    async insert(event) {
      auditEvents.push(event.actionCode);
    },
  };
  const trail = createTrailService(repositories.review_case, repositories.trail_entry, audit);
  const deps: AwarenessDependencies = {
    repositories,
    audit,
    trail,
    liveSegment: async () => ({ status: 'ISSUE_UNAVAILABLE' }),
    currentKey: async () => KEY,
    keyFor: async () => KEY.value,
    now: () => '2026-11-24T15:00:00.000Z',
    timeZone: 'UTC',
    resolveRoles: async () => roles,
    recordAudit: async (event: AuditEvent) => {
      auditEvents.push(`${event.actionCode}:${event.errorCode}`);
    },
  };
  return { deps, auditEvents };
}

async function seed(deps: AwarenessDependencies): Promise<string> {
  const caseId = 'dispatch-case';
  await deps.trail.createCase({
    id: caseId,
    anchorIssueId: 'KW-200',
    caseSeq: 1,
    origin: 'SIGNAL',
    at: '2026-11-24T12:00:00.000Z',
  });
  await deps.trail.addRecord({
    id: 'dispatch-entry',
    caseId,
    evidenceId: 'dispatch-evidence',
    source: 'SIGNAL',
    enteredBy: 'acct-system',
    enteredAt: '2026-11-24T12:12:00.000Z',
  });
  await captureEvidence(deps.repositories.evidence_item, KEY, {
    id: 'dispatch-evidence',
    issueId: 'KW-200',
    segmentKey: 'comment:1',
    authorAccountId: 'acct-author',
    recordCreatedAt: '2026-11-05T09:12:00.000Z',
    recordUpdatedAt: '2026-11-05T09:12:00.000Z',
    segmentText: 'Possible device problem observed',
    quote: 'device problem',
    capturedBy: 'RULE_MATCH',
    strength: 'SYSTEM_UNEDITED',
    capturedAt: '2026-11-24T12:10:00.000Z',
  });
  return caseId;
}

describe('P5.D1 client-facing dispatcher (G-4, I-4)', () => {
  it('exposes only the three Awareness actions', () => {
    expect([...AWARENESS_ACTIONS]).toEqual([
      'VIEW_CASE',
      'ENTER_RECEIPT_DATE',
      'CONFIRM_TRAIL_ENTRY',
    ]);
    expect(isAwarenessAction('ADMIN_SETTINGS')).toBe(false);
    expect(isAwarenessAction('VIEW_CASE')).toBe(true);
  });

  it('returns an envelope for a permitted action', async () => {
    const fx = fixture();
    const caseId = await seed(fx.deps);
    const result = await createAwarenessDispatcher(fx.deps)('VIEW_CASE', { caseId }, context);
    expect(result.code).toBe('OK');
    expect(result.roleHint).toBe('REVIEWER');
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/u);
  });

  it('rejects an out-of-slice action before the gate', async () => {
    const fx = fixture();
    await seed(fx.deps);
    const result = await createAwarenessDispatcher(fx.deps)('ADMIN_SETTINGS', {}, context);
    expect(result).toMatchObject({ code: 'NOT_PERMITTED', data: null, roleHint: 'UNKNOWN' });
    expect(fx.auditEvents).toEqual([]);
  });

  it('maps gate denial and dependency failure to envelope codes', async () => {
    const fx = fixture(['VIEWER']);
    const caseId = await seed(fx.deps);
    const dispatch = createAwarenessDispatcher(fx.deps);
    const denied = await dispatch('VIEW_CASE', { caseId, roles: ['QUALIFIED_PERSON'] }, context);
    expect(denied.code).toBe('NOT_PERMITTED');
    expect(fx.auditEvents).toContain('VIEW_CASE:DENIED');

    const broken = createAwarenessDispatcher({
      ...fx.deps,
      resolveRoles: async () => {
        throw new Error('role store unavailable');
      },
    });
    const failed = await broken('VIEW_CASE', { caseId }, context);
    expect(failed.code).toBe('DEPENDENCY_FAILED');
    expect(fx.auditEvents).toContain('VIEW_CASE:DEPENDENCY_FAILED');
  });
});
