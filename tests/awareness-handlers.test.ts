import { describe, expect, it } from 'vitest';
import { ACTIONS, type Action, type Role } from '../src/contracts/authorisation';
import type { ResolverEnvelope } from '../src/contracts/envelope';
import type { GateContext } from '../src/contracts/authorisation';
import { createGate, contextFromPlatform, type AuditEvent } from '../src/handlers/authorisation';
import type { AwarenessDependencies } from '../src/handlers/awareness';
import { createHandlerRegistry } from '../src/handlers/registry';
import { captureEvidence } from '../src/services/evidence';
import { createRepositories } from '../src/services/repositories';
import type { AuditRepository } from '../src/services/audit';
import type { HashKeyMaterial } from '../src/services/hash-key';
import { createTrailService } from '../src/services/trail';
import { createSqlFake } from './support/sql-fake';

const KEY: HashKeyMaterial = { id: 'awareness-key', value: 'fk-awareness-key' };
const NOW = '2026-11-24T15:00:00.000Z';
const QUOTE = 'the device overheated during use';

interface Fixture {
  readonly deps: AwarenessDependencies;
  readonly caseId: string;
  readonly entryId: string;
  readonly evidenceId: string;
  readonly audits: string[];
}

function fixture(roles: readonly Role[] = ['REVIEWER'], timeZone: string | null = null): Fixture {
  const sql = createSqlFake();
  const repos = createRepositories(sql);
  const audits: string[] = [];
  const audit: AuditRepository = {
    async insert(event) {
      audits.push(event.actionCode);
    },
  };
  const trail = createTrailService(repos.review_case, repos.trail_entry, audit);
  const reviewCase = {
    id: 'case-awareness',
    anchorIssueId: 'KW-100',
    caseSeq: 1,
    origin: 'SIGNAL',
    at: '2026-11-24T12:00:00.000Z',
  };
  return {
    deps: {
      repositories: repos,
      audit,
      trail,
      liveSegment: async () => ({ status: 'FOUND', text: `Observed: ${QUOTE} in use.` }),
      currentKey: async () => KEY,
      keyFor: async () => KEY.value,
      now: () => NOW,
      timeZone,
      resolveRoles: async () => roles,
      recordAudit: async (event: AuditEvent) => {
        audits.push(`${event.actionCode}:${event.errorCode}`);
      },
    },
    caseId: reviewCase.id,
    entryId: 'entry-awareness',
    evidenceId: 'evidence-awareness',
    audits,
  };
}

async function seed(fx: Fixture): Promise<void> {
  await fx.deps.trail.createCase({
    id: fx.caseId,
    anchorIssueId: 'KW-100',
    caseSeq: 1,
    origin: 'SIGNAL',
    at: '2026-11-24T12:00:00.000Z',
  });
  const captured = await captureEvidence(fx.deps.repositories.evidence_item, KEY, {
    id: fx.evidenceId,
    issueId: 'KW-100',
    segmentKey: 'comment:9001',
    authorAccountId: 'acct-author',
    recordCreatedAt: '2026-11-05T09:12:00.000Z',
    recordUpdatedAt: '2026-11-05T09:12:00.000Z',
    segmentText: `Observed: ${QUOTE} in use.`,
    quote: QUOTE,
    capturedBy: 'RULE_MATCH',
    strength: 'SYSTEM_UNEDITED',
    capturedAt: '2026-11-24T12:10:00.000Z',
    scanId: 'scan-awareness',
  });
  expect(captured.inserted).toBe(true);
  await fx.deps.trail.addRecord({
    id: fx.entryId,
    caseId: fx.caseId,
    evidenceId: fx.evidenceId,
    source: 'SIGNAL',
    enteredBy: 'acct-system',
    enteredAt: '2026-11-24T12:12:00.000Z',
  });
}

const context: GateContext = contextFromPlatform({
  accountId: 'acct-reviewer',
  canBrowseResource: true,
});

async function run(
  fx: Fixture,
  action: Action,
  payload: Readonly<Record<string, unknown>>,
  ctx: GateContext = context,
): Promise<ResolverEnvelope<unknown>> {
  const gate = createGate(
    createHandlerRegistry(fx.deps),
    fx.deps.resolveRoles,
    fx.deps.recordAudit,
  );
  const outcome = await gate.dispatch(action, ctx, payload);
  expect(outcome.decision.allow).toBe(true);
  return outcome.result as ResolverEnvelope<unknown>;
}

describe('P5.D1 awareness resolvers through the gate (G-4, C-04)', () => {
  it('registers exactly the twelve matrix handlers, with no extra resolver action', () => {
    expect(Object.keys(createHandlerRegistry(fixture().deps)).sort()).toEqual([...ACTIONS].sort());
  });

  it('lists a case with candidate dates, no preselection and no record text', async () => {
    const fx = fixture(['QUALIFIED_PERSON'], 'UTC');
    await seed(fx);
    expect((await run(fx, 'CONFIRM_TRAIL_ENTRY', { entryId: fx.entryId })).code).toBe('OK');
    const result = await run(fx, 'VIEW_CASE', { caseId: fx.caseId });
    expect(result.code).toBe('OK');
    expect(result.roleHint).toBe('QUALIFIED_PERSON');
    const data = result.data as {
      caseId: string;
      candidates: ReadonlyArray<{
        basis: string;
        effectiveDate: string | null;
        reasonCode: string | null;
      }>;
      preselectedEntryId: null;
      preselectedBasis: null;
    };
    expect(data.caseId).toBe(fx.caseId);

    expect(new Set(data.candidates.map((candidate) => candidate.basis))).toEqual(
      new Set(['JIRA_RECORD_TIMESTAMP', 'ENTERED_RECEIPT_DATE']),
    );
    expect(
      data.candidates.find((candidate) => candidate.basis === 'JIRA_RECORD_TIMESTAMP')
        ?.effectiveDate,
    ).toBe('2026-11-05');
    expect(data.preselectedEntryId).toBeNull();
    expect(data.preselectedBasis).toBeNull();
    expect(JSON.stringify(result)).not.toContain(QUOTE);
  });

  it('resolves a case by anchor issue key and refuses an ambiguous choice', async () => {
    const fx = fixture();
    await seed(fx);
    const result = await run(fx, 'VIEW_CASE', { issueKey: 'KW-100' });
    expect(result.code).toBe('OK');
    expect(result.data).toMatchObject({ caseId: fx.caseId });
    await fx.deps.trail.createCase({
      id: 'case-awareness-2',
      anchorIssueId: 'KW-100',
      caseSeq: 2,
      origin: 'MANUAL_OPEN',
      at: '2026-11-24T14:00:00.000Z',
    });
    const ambiguous = await run(fx, 'VIEW_CASE', { issueKey: 'KW-100' });
    expect(ambiguous.code).toBe('INVALID_REQUEST');
    expect(ambiguous.data).toBeNull();
  });

  it('lets a Reviewer add a proposed receipt but not confirm a trail entry', async () => {
    const fx = fixture();
    await seed(fx);
    const added = await run(fx, 'ENTER_RECEIPT_DATE', {
      caseId: fx.caseId,
      receivedDate: '2026-11-01',
      note: 'Phone call noted by the reviewer',
    });
    expect(added.code).toBe('OK');
    const rows = fx.deps.repositories.trail_entry.findBy({ case_id: fx.caseId });
    expect((await rows).filter((row) => row.kind === 'ENTERED')).toHaveLength(1);

    const gate = createGate(
      createHandlerRegistry(fx.deps),
      fx.deps.resolveRoles,
      fx.deps.recordAudit,
    );
    const denied = await gate.dispatch('CONFIRM_TRAIL_ENTRY', context);
    expect(denied.decision.allow).toBe(false);
    expect(fx.audits).toContain('CONFIRM_TRAIL_ENTRY:DENIED');
  });

  it('lets a Qualified person confirm, correct, re-confirm and reject in sequence', async () => {
    const fx = fixture(['QUALIFIED_PERSON']);
    await seed(fx);
    expect((await run(fx, 'CONFIRM_TRAIL_ENTRY', { entryId: fx.entryId })).code).toBe('OK');
    expect((await fx.deps.repositories.trail_entry.findBy({ id: fx.entryId }))[0]?.status).toBe(
      'CONFIRMED',
    );

    const corrected = await run(fx, 'CONFIRM_TRAIL_ENTRY', {
      entryId: fx.entryId,
      correct: true,
      receivedDate: '2026-11-02',
      reasonCode: 'MISTAKE',
      note: 'Receipt date corrected by the qualified person',
    });
    expect(corrected.code).toBe('OK');
    const entries = await fx.deps.repositories.trail_entry.findBy({ case_id: fx.caseId });
    expect(entries.find((row) => row.id === fx.entryId)?.supersedes_id).toBeNull();
    const replacement = entries.find((row) => row.supersedes_id === fx.entryId);
    expect(replacement?.received_date_entered).toBe('2026-11-02');
    expect(replacement?.status).toBe('PROPOSED');
    expect((await run(fx, 'CONFIRM_TRAIL_ENTRY', { entryId: String(replacement?.id) })).code).toBe(
      'OK',
    );
    expect(
      (await fx.deps.repositories.trail_entry.findBy({ id: String(replacement?.id) }))[0]?.status,
    ).toBe('CONFIRMED');

    expect(
      (
        await run(fx, 'ENTER_RECEIPT_DATE', {
          caseId: fx.caseId,
          receivedDate: '2026-11-01',
          note: 'Second possible receipt date',
        })
      ).code,
    ).toBe('OK');
    const proposed = (await fx.deps.repositories.trail_entry.findBy({ case_id: fx.caseId })).find(
      (row) => row.kind === 'ENTERED' && row.status === 'PROPOSED',
    );
    expect(proposed).toBeDefined();
    const rejected = await run(fx, 'CONFIRM_TRAIL_ENTRY', {
      entryId: String(proposed?.id),
      reject: true,
      reasonCode: 'DUPLICATE',
    });
    expect(rejected.code).toBe('OK');
    expect(
      (await fx.deps.repositories.trail_entry.findBy({ id: String(proposed?.id) }))[0]?.status,
    ).toBe('REJECTED');
  });

  it('revalidates for a permitted viewer and returns only the state code, never the quote', async () => {
    const fx = fixture();
    await seed(fx);
    const result = await run(fx, 'VIEW_CASE', {
      evidenceId: fx.evidenceId,
      revalidate: true,
    });
    expect(result.code).toBe('OK');
    expect(result.data).toMatchObject({ evidenceId: fx.evidenceId, state: 'VALID' });
    expect(JSON.stringify(result)).not.toContain(QUOTE);
  });

  it('rejects a future receipt date without changing state', async () => {
    const fx = fixture();
    await seed(fx);
    const result = await run(fx, 'ENTER_RECEIPT_DATE', {
      caseId: fx.caseId,
      receivedDate: '2026-12-01',
    });
    expect(result.code).toBe('INVALID_REQUEST');
    expect(result.data).toBeNull();
    const rows = await fx.deps.repositories.trail_entry.findBy({ case_id: fx.caseId });
    expect(rows.filter((row) => row.kind === 'ENTERED')).toHaveLength(0);
  });

  it('discards a role claim supplied in a resolver payload (I-4)', async () => {
    const fx = fixture(['VIEWER']);
    await seed(fx);
    const gate = createGate(
      createHandlerRegistry(fx.deps),
      fx.deps.resolveRoles,
      fx.deps.recordAudit,
    );
    const outcome = await gate.dispatch('CONFIRM_TRAIL_ENTRY', context, {
      role: 'QUALIFIED_PERSON',
      roles: ['QUALIFIED_PERSON'],
      actorRole: 'QUALIFIED_PERSON',
      entryId: fx.entryId,
    });
    expect(outcome.decision.allow).toBe(false);
    expect(outcome.result).toBeUndefined();
    expect(fx.audits).toContain('CONFIRM_TRAIL_ENTRY:DENIED');
  });

  it('fails closed through the dispatcher on browse denial and dependency failure', async () => {
    const fx = fixture();
    await seed(fx);
    const registry = createHandlerRegistry(fx.deps);
    const denied = await createGate(registry, fx.deps.resolveRoles, fx.deps.recordAudit).dispatch(
      'VIEW_CASE',
      contextFromPlatform({ accountId: 'acct-reviewer', canBrowseResource: false }),
      { caseId: fx.caseId },
    );
    expect(denied.decision.allow).toBe(false);
    expect(denied.result).toBeUndefined();

    const broken: typeof fx.deps.resolveRoles = async () => {
      throw new Error('role store unavailable');
    };
    const failed = await createGate(registry, broken, fx.deps.recordAudit).dispatch(
      'VIEW_CASE',
      context,
      { caseId: fx.caseId },
    );
    expect(failed.decision.allow).toBe(false);
    if (!failed.decision.allow) expect(failed.decision.code).toBe('DEPENDENCY_FAILED');
    expect(failed.result).toBeUndefined();
  });

  it('maps a missing case to NOT_FOUND without leaking any payload text', async () => {
    const fx = fixture();
    await seed(fx);
    const result = await run(fx, 'VIEW_CASE', { caseId: 'missing-case' });
    expect(result.code).toBe('NOT_FOUND');
    expect(result.data).toBeNull();
    expect(JSON.stringify(result)).not.toContain(QUOTE);
  });
});
