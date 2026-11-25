import { describe, expect, it } from 'vitest';
import {
  SAMPLE_LABEL,
  loadSampleScenario,
  type LoadSampleInput,
  type SampleIssueInput,
  type SampleLoaderPort,
} from '../src/services/sample-loader';
import { DEFAULT_ADMIN_SETTINGS, type AdminSettings } from '../src/services/admin-settings';

const settings: AdminSettings = {
  ...DEFAULT_ADMIN_SETTINGS,
  watchedProjects: ['KW'],
};

const VALID_INPUT: LoadSampleInput = Object.freeze({
  projectKey: 'KW',
  anchorDateISO: '2026-11-25',
  authorAccountId: 'opaque-author',
});

const ALL_REFS = ['H1', 'H2', 'H3', 'H4', 'H5', 'A1', 'A2'] as const;

interface PortCall {
  readonly projectKey: string;
  readonly claimKey: string;
}

interface CapturedPort extends SampleLoaderPort {
  readonly calls: readonly SampleIssueInput[];
  readonly claimCalls: readonly PortCall[];
  readonly releaseCalls: readonly PortCall[];
  readonly listCalls: readonly string[];
}

function capture(
  options: {
    readonly existingRefs?: readonly string[];
    readonly claimGranted?: boolean;
    readonly claimFails?: boolean;
    readonly releaseFails?: boolean;
    readonly failCreateAt?: number;
  } = {},
): CapturedPort {
  const calls: SampleIssueInput[] = [];
  const claimCalls: PortCall[] = [];
  const releaseCalls: PortCall[] = [];
  const listCalls: string[] = [];
  return {
    calls,
    claimCalls,
    releaseCalls,
    listCalls,
    async claimLoad(projectKey, claimKey) {
      claimCalls.push({ projectKey, claimKey });
      if (options.claimFails) throw new Error('KVS_UNAVAILABLE');
      return options.claimGranted ?? true;
    },
    async releaseLoad(projectKey, claimKey) {
      releaseCalls.push({ projectKey, claimKey });
      if (options.releaseFails) throw new Error('KVS_UNAVAILABLE');
    },
    async listCreatedRefs(projectKey) {
      listCalls.push(projectKey);
      return [...(options.existingRefs ?? [])];
    },
    async createIssue(input) {
      calls.push(input);
      if (options.failCreateAt === calls.length) throw new Error('JIRA_429');
      return { id: `id-${calls.length}`, key: `KW-${calls.length}` };
    },
  };
}

/** Two callers sharing one atomic claim, with no sleeping or real clock. */
function contendedPort(): {
  readonly port: SampleLoaderPort;
  readonly calls: readonly SampleIssueInput[];
} {
  const calls: SampleIssueInput[] = [];
  let held = false;
  return {
    calls,
    port: {
      async claimLoad() {
        if (held) return false;
        held = true;
        return true;
      },
      async releaseLoad() {
        held = false;
      },
      async listCreatedRefs() {
        return [];
      },
      async createIssue(input) {
        calls.push(input);
        return { id: `id-${calls.length}`, key: `KW-${calls.length}` };
      },
    },
  };
}

describe('P10.A3 sample loader (C-08.1-9, I-11, I-12, I-6)', () => {
  it('C-08.1-3 creates the seven missing records once with a bounded claim and deterministic keys', async () => {
    const port = capture();
    const result = await loadSampleScenario(settings, port, VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.createdCount).toBe(7);
    expect(result.totalCreatedCount).toBe(7);
    expect(result.csvRecordCount).toBe(5);
    expect(result.issueKeys).toEqual(['KW-1', 'KW-2', 'KW-3', 'KW-4', 'KW-5', 'KW-6', 'KW-7']);
    expect(port.calls.map((call) => call.ref)).toEqual([...ALL_REFS]);
    expect(new Set(port.calls.map((call) => call.scenario)).size).toBe(4);
    for (const call of port.calls) {
      expect(call.projectKey).toBe('KW');
      expect(call.labels).toContain(SAMPLE_LABEL);
      expect(call.idempotencyKey.length).toBeGreaterThan(0);
      expect(call.idempotencyKey).not.toContain(VALID_INPUT.authorAccountId);
    }
    expect(new Set(port.calls.map((call) => call.idempotencyKey)).size).toBe(7);
    expect(port.claimCalls).toHaveLength(1);
    expect(port.releaseCalls).toEqual(port.claimCalls);
    expect(port.listCalls).toEqual(['KW']);
  });

  it('C-08.1 refuses a project that is not watched before claiming or creating', async () => {
    const port = capture();
    const result = await loadSampleScenario(settings, port, {
      ...VALID_INPUT,
      projectKey: 'OTHER',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('PROJECT_NOT_WATCHED');
    expect(port.claimCalls).toHaveLength(0);
    expect(port.calls).toHaveLength(0);
  });

  it('C-08.1 rejects a malformed project key without claiming', async () => {
    for (const projectKey of ['kw', '1KW', 'KW-1', 'KW_WITH_A_VERY_LONG_KEY', '']) {
      const port = capture();
      const result = await loadSampleScenario(settings, port, { ...VALID_INPUT, projectKey });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('INVALID_REQUEST');
      expect(port.claimCalls).toHaveLength(0);
      expect(port.calls).toHaveLength(0);
    }
  });

  it('C-08.1 rejects an impossible UTC calendar date without claiming', async () => {
    for (const anchorDateISO of [
      '2026-02-31',
      '2026-13-01',
      '2026-00-10',
      '2026-1-01',
      'not-a-date',
    ]) {
      const port = capture();
      const result = await loadSampleScenario(settings, port, { ...VALID_INPUT, anchorDateISO });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('INVALID_REQUEST');
      expect(port.claimCalls).toHaveLength(0);
      expect(port.calls).toHaveLength(0);
    }
  });

  it('I-6 rejects an unbounded or control-bearing author identifier without claiming', async () => {
    for (const authorAccountId of ['', 'x'.repeat(129), 'line\nbreak', 'tab\tid', 'delete\u007f']) {
      const port = capture();
      const result = await loadSampleScenario(settings, port, { ...VALID_INPUT, authorAccountId });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('INVALID_REQUEST');
      expect(port.claimCalls).toHaveLength(0);
      expect(port.calls).toHaveLength(0);
    }
  });

  it('C-08.9 returns ALREADY_LOADED when another load holds the claim', async () => {
    const port = capture({ claimGranted: false });
    const result = await loadSampleScenario(settings, port, VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ALREADY_LOADED');
    expect(port.claimCalls).toHaveLength(1);
    expect(port.releaseCalls).toHaveLength(0);
    expect(port.listCalls).toHaveLength(0);
    expect(port.calls).toHaveLength(0);
  });

  it('C-08.9 two concurrent loads produce one complete set, not two', async () => {
    const shared = contendedPort();
    const [first, second] = await Promise.all([
      loadSampleScenario(settings, shared.port, VALID_INPUT),
      loadSampleScenario(settings, shared.port, VALID_INPUT),
    ]);
    const outcomes = [first, second].map((result) => (result.ok ? 'OK' : result.code));
    expect(outcomes).toContain('OK');
    expect(outcomes).toContain('ALREADY_LOADED');
    expect(shared.calls).toHaveLength(7);
    expect(new Set(shared.calls.map((call) => call.ref)).size).toBe(7);
  });

  it('C-08.9 a create failure yields an explicit PARTIAL_LOAD and releases the claim', async () => {
    const port = capture({ failCreateAt: 3 });
    const result = await loadSampleScenario(settings, port, VALID_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PARTIAL_LOAD');
    if (result.code !== 'PARTIAL_LOAD') return;
    expect(result.createdCount).toBe(2);
    expect(result.totalCreatedCount).toBe(2);
    expect(result.remainingCount).toBe(5);
    expect(result.issueKeys).toEqual(['KW-1', 'KW-2']);
    expect(port.calls).toHaveLength(3);
    expect(port.releaseCalls).toEqual(port.claimCalls);
  });

  it('C-08.9 a partial set resumes by creating only the missing refs', async () => {
    const firstPort = capture();
    await loadSampleScenario(settings, firstPort, VALID_INPUT);

    const port = capture({ existingRefs: ['H1', 'H2', 'H3'] });
    const result = await loadSampleScenario(settings, port, VALID_INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(port.calls.map((call) => call.ref)).toEqual(['H4', 'H5', 'A1', 'A2']);
    expect(result.createdCount).toBe(4);
    expect(result.totalCreatedCount).toBe(7);
    expect(result.issueKeys).toEqual(['KW-1', 'KW-2', 'KW-3', 'KW-4']);

    const originalKeys = new Map(firstPort.calls.map((call) => [call.ref, call.idempotencyKey]));
    for (const call of port.calls) {
      expect(call.idempotencyKey).toBe(originalKeys.get(call.ref));
    }
    expect(port.claimCalls).toEqual(firstPort.claimCalls);
    expect(port.releaseCalls).toEqual(port.claimCalls);
  });

  it('C-08.9 a complete set returns ALREADY_LOADED and releases the claim', async () => {
    const port = capture({ existingRefs: [...ALL_REFS] });
    const result = await loadSampleScenario(settings, port, VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('ALREADY_LOADED');
    expect(port.calls).toHaveLength(0);
    expect(port.releaseCalls).toEqual(port.claimCalls);
  });

  it('C-08.9 a failed claim does not create or release', async () => {
    const port = capture({ claimFails: true });
    const result = await loadSampleScenario(settings, port, VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('DEPENDENCY_FAILED');
    expect(port.calls).toHaveLength(0);
    expect(port.releaseCalls).toHaveLength(0);
  });

  it('C-08.9 a dependency failure before create releases the claim', async () => {
    const port = capture();
    port.listCreatedRefs = async () => {
      throw new Error('SQL_UNAVAILABLE');
    };
    const result = await loadSampleScenario(settings, port, VALID_INPUT);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('DEPENDENCY_FAILED');
    expect(port.calls).toHaveLength(0);
    expect(port.releaseCalls).toEqual(port.claimCalls);
  });

  it('C-08.9 a failed release after creates cannot be reported as a clean success', async () => {
    const port = capture({ releaseFails: true });
    const result = await loadSampleScenario(settings, port, VALID_INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PARTIAL_LOAD');
    if (result.code !== 'PARTIAL_LOAD') return;
    expect(result.createdCount).toBe(7);
    expect(result.remainingCount).toBe(0);
    expect(port.releaseCalls).toEqual(port.claimCalls);
  });

  it('I-6/I-12 results carry identifiers and counts only, never fixture prose, keys or account ids', async () => {
    const canaryInput: LoadSampleInput = { ...VALID_INPUT, authorAccountId: 'canary-account-991' };
    const results = [
      await loadSampleScenario(settings, capture(), canaryInput),
      await loadSampleScenario(settings, capture({ failCreateAt: 2 }), canaryInput),
      await loadSampleScenario(settings, capture({ claimGranted: false }), canaryInput),
      await loadSampleScenario(settings, capture({ existingRefs: [...ALL_REFS] }), canaryInput),
    ];
    const serialised = JSON.stringify(results);
    for (const forbidden of [
      'app froze',
      'emergency room',
      'Passing to engineering',
      'Field call',
      'canary-account-991',
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});
