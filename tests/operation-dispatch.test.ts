import { describe, expect, it } from 'vitest';
import {
  currentQuestionSet,
  runtimeQuestionSet,
  runtimeRuleBundle,
} from '../src/adapters/rule-data';
import type { GateContext } from '../src/contracts/authorisation';
import {
  createOperationDispatcher,
  isOperationAction,
  OPERATION_ACTIONS,
} from '../src/handlers/operation-dispatch';
import type { AwarenessDependencies } from '../src/handlers/awareness';
import type { AuditRepository } from '../src/services/audit';
import { createRepositories } from '../src/services/repositories';
import { createTrailService } from '../src/services/trail';
import { createSqlFake } from './support/sql-fake';

const context: GateContext = { accountId: 'qp-1', canBrowseResource: true };
const NOW = '2026-11-24T12:00:00.000Z';

function awarenessDeps(
  roles: readonly ('QUALIFIED_PERSON' | 'VIEWER')[] = ['QUALIFIED_PERSON'],
): AwarenessDependencies {
  const repositories = createRepositories(createSqlFake());
  const audit: AuditRepository = {
    async insert() {
      return;
    },
  };
  return {
    repositories,
    audit,
    trail: createTrailService(repositories.review_case, repositories.trail_entry, audit),
    liveSegment: async () => ({ status: 'ISSUE_UNAVAILABLE' }),
    currentKey: async () => null,
    keyFor: async () => null,
    now: () => NOW,
    timeZone: null,
    resolveRoles: async () => roles,
    recordAudit: async () => {
      return;
    },
  };
}

function dispatcher(roles: readonly ('QUALIFIED_PERSON' | 'VIEWER')[] = ['QUALIFIED_PERSON']) {
  return createOperationDispatcher({
    awareness: awarenessDeps(roles),
    operations: { now: () => NOW, manualScan: async () => ({ scanned: 1 }) },
    decisions: { now: () => NOW, getQuestionSet: () => null },
  });
}

describe('P9 operation dispatcher (Arch §13.3, I-4/I-11)', () => {
  it('narrows the client action choice to the six operation actions', () => {
    expect(OPERATION_ACTIONS).toEqual([
      'MANUAL_SCAN',
      'RETRY_WRITEBACK',
      'COMPUTE_DEADLINES',
      'DECIDE',
      'RUN_LOOKBACK',
      'CONFIRM_SAME_EVENT',
    ]);
    expect(isOperationAction('DECIDE')).toBe(true);
    expect(isOperationAction('VIEW_CASE')).toBe(false);
  });

  it('refuses an Awareness action without reaching the gate', async () => {
    const result = await dispatcher()('VIEW_CASE', {}, context);
    expect(result).toMatchObject({ code: 'NOT_PERMITTED', data: null });
  });

  it('gates DECIDE on the server-resolved role', async () => {
    const result = await dispatcher(['VIEWER'])('DECIDE', { action: 'GET_QUESTIONS' }, context);
    expect(result).toMatchObject({ code: 'NOT_PERMITTED', data: null });
  });

  it('returns the fixed missing-rule-data state from GET_QUESTIONS', async () => {
    const result = await dispatcher()('DECIDE', { action: 'GET_QUESTIONS' }, context);
    expect(result).toMatchObject({
      code: 'OK',
      data: {
        status: 'MISSING',
        message: 'Decision questions are not available (rule data missing)',
      },
    });
  });

  it('keeps COMPUTE_DEADLINES unavailable when no rule bundle is injected', async () => {
    const result = await dispatcher()(
      'COMPUTE_DEADLINES',
      { caseId: 'case-1', asOfDate: '2026-11-24', candidates: [] },
      context,
    );
    expect(result).toMatchObject({ code: 'NOT_FOUND', data: null });
  });

  it('passes only an issue id to the injected manual scan', async () => {
    const ok = await dispatcher()('MANUAL_SCAN', { issueId: 'KW-1' }, context);
    expect(ok).toMatchObject({ code: 'OK', data: { scanned: 1 } });
    const spoofed = await dispatcher()(
      'MANUAL_SCAN',
      { issueId: 'KW-1', role: 'QUALIFIED_PERSON' },
      context,
    );
    expect(spoofed).toMatchObject({ code: 'INVALID_REQUEST', data: null });
  });

  it('keeps runtime rule data fail-closed until approved files are supplied', () => {
    expect(runtimeQuestionSet).toMatchObject({ status: 'FAILED', code: 'MISSING' });
    expect(currentQuestionSet()).toBeNull();
    expect(runtimeRuleBundle).toBeNull();
  });
});
