import { describe, expect, it } from 'vitest';
import {
  CAPTURE_SOURCES,
  EVIDENCE_STRENGTHS,
  VALIDATION_STATUSES,
} from '../src/contracts/evidence';
import { createRepositories } from '../src/services/repositories';
import {
  captureEvidence,
  classifyEvidenceStrength,
  revalidateEvidence,
  revalidationDecision,
  type EvidenceCaptureInput,
  type LiveSegment,
} from '../src/services/evidence';
import { hmacRecord, type HashKeyMaterial } from '../src/services/hash-key';
import { createSqlFake, type SqlFake } from './support/sql-fake';

const KEY_A: HashKeyMaterial = { id: 'key-a', value: 'test-key-a' };
const KEY_B: HashKeyMaterial = { id: 'key-b', value: 'test-key-b' };
const TEXT =
  'Clinic North: the Alpha app froze during dose calculation. Patient went to the ER for observation.';
const QUOTE = 'app froze during dose calculation';

function setup(): {
  fake: SqlFake;
  repos: ReturnType<typeof createRepositories>;
  values: string[];
} {
  const fake = createSqlFake();
  const values: string[] = [];
  const prepare = fake.prepare.bind(fake);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fake.prepare = ((query: string): any => {
    const statement = prepare(query);
    const bind = statement.bindParams.bind(statement);
    statement.bindParams = (...bound) => {
      values.push(...bound.map((value) => String(value)));
      return bind(...bound);
    };
    return statement;
  }) as SqlFake['prepare'];
  return { fake, repos: createRepositories(fake), values };
}

const CAPTURE: EvidenceCaptureInput = {
  id: 'evidence-1',
  issueId: '10001',
  segmentKey: 'comment:7001',
  authorAccountId: 'acct-author',
  recordCreatedAt: '2026-11-05T09:12:00.000Z',
  recordUpdatedAt: '2026-11-05T09:12:00.000Z',
  segmentText: TEXT,
  quote: QUOTE,
  capturedBy: 'RULE_MATCH',
  strength: 'SYSTEM_UNEDITED',
  capturedAt: '2026-11-24T12:00:00.000Z',
  scanId: 'scan-1',
};

describe('P5.0 frozen evidence and trail vocabulary (Arch §12, IF-8/IF-9)', () => {
  it('pins the audited enumerations', () => {
    expect([...CAPTURE_SOURCES]).toEqual([
      'LLM_VALIDATED',
      'RULE_MATCH',
      'HUMAN_PHRASE',
      'HUMAN_SEGMENT',
    ]);
    expect([...EVIDENCE_STRENGTHS]).toEqual([
      'SYSTEM_UNEDITED',
      'SYSTEM_EDITED',
      'HISTORY_UNVERIFIED',
    ]);
    expect([...VALIDATION_STATUSES]).toEqual([
      'VALID',
      'RELOCATED',
      'MODIFIED',
      'UNAVAILABLE',
      'UNVERIFIABLE',
    ]);
  });
});

describe('P5.A1 evidence capture (C-04.1, N-04, I-1/I-6)', () => {
  it('stores pointers, offsets and keyed hashes only — never record text', async () => {
    const { fake, repos, values } = setup();
    const result = await captureEvidence(repos.evidence_item, KEY_A, CAPTURE);
    expect(result.inserted).toBe(true);
    expect(result.row).toMatchObject({
      id: 'evidence-1',
      issue_id: '10001',
      segment_key: 'comment:7001',
      span_start: TEXT.indexOf(QUOTE),
      span_len: QUOTE.length,
      validation_status: 'VALID',
      normalisation_version: 'normalise-v1',
      hash_key_id: 'key-a',
    });
    expect(result.span).toBe(QUOTE);
    expect(JSON.stringify(fake.dump('evidence_item'))).not.toContain('app froze');
    expect(values.join(' ')).not.toContain('app froze');
  });

  it('is idempotent for the same pointer, offsets and span hash', async () => {
    const { repos } = setup();
    const first = await captureEvidence(repos.evidence_item, KEY_A, CAPTURE);
    const again = await captureEvidence(repos.evidence_item, KEY_A, CAPTURE);
    expect(again.inserted).toBe(false);
    expect(again.row.id).toBe(first.row.id);
  });

  it('appends a new item when the same pointer yields a different span', async () => {
    const { repos } = setup();
    await captureEvidence(repos.evidence_item, KEY_A, CAPTURE);
    const second = await captureEvidence(repos.evidence_item, KEY_A, {
      ...CAPTURE,
      id: 'evidence-2',
      quote: 'Patient went to the ER',
    });
    expect(second.inserted).toBe(true);
  });

  it('rejects a non-verbatim proposal before any SQL and never echoes the text', async () => {
    const { repos, values } = setup();
    await expect(
      captureEvidence(repos.evidence_item, KEY_A, { ...CAPTURE, quote: 'the device was unsafe' }),
    ).rejects.toMatchObject({ code: 'CAPTURE_REJECTED', reasonCode: 'NOT_VERBATIM' });
    expect(values).toEqual([]);
  });

  it('rejects unknown provenance and strength codes', async () => {
    const { repos } = setup();
    await expect(
      captureEvidence(repos.evidence_item, KEY_A, {
        ...CAPTURE,
        capturedBy: 'AI_INVENTED' as EvidenceCaptureInput['capturedBy'],
      }),
    ).rejects.toThrow('CAPTURE_INVALID');
    await expect(
      captureEvidence(repos.evidence_item, KEY_A, {
        ...CAPTURE,
        strength: 'PROVEN' as EvidenceCaptureInput['strength'],
      }),
    ).rejects.toThrow('CAPTURE_INVALID');
  });

  it('rejects a canary probe that is not verbatim in the live segment', async () => {
    const { repos, values } = setup();
    await expect(
      captureEvidence(repos.evidence_item, KEY_A, {
        ...CAPTURE,
        quote: 'canary-record-text-alpha-7f3a',
      }),
    ).rejects.toThrow('CAPTURE_REJECTED');
    expect(values).toEqual([]);
  });
});

describe('P5.A3 strength labelling (Arch §6.4, C-04.1)', () => {
  it('labels an unedited comment and an edited comment from Jira claims only', () => {
    expect(
      classifyEvidenceStrength({
        kind: 'COMMENT',
        recordCreatedAt: '2026-11-05T09:12:00.000Z',
        recordUpdatedAt: '2026-11-05T09:12:00.000Z',
        changelogChecked: false,
        changelogHadEdit: false,
      }),
    ).toBe('SYSTEM_UNEDITED');
    expect(
      classifyEvidenceStrength({
        kind: 'COMMENT',
        recordCreatedAt: '2026-11-05T09:12:00.000Z',
        recordUpdatedAt: '2026-11-06T09:12:00.000Z',
        changelogChecked: false,
        changelogHadEdit: false,
      }),
    ).toBe('SYSTEM_EDITED');
  });

  it('requires a changelog check for summary/description and never infers from issue.updated', () => {
    const base = {
      kind: 'DESCRIPTION' as const,
      recordCreatedAt: '2026-11-05T09:12:00.000Z',
      recordUpdatedAt: '2026-11-20T09:12:00.000Z',
      changelogHadEdit: false,
    };
    expect(classifyEvidenceStrength({ ...base, changelogChecked: false })).toBe(
      'HISTORY_UNVERIFIED',
    );
    expect(
      classifyEvidenceStrength({ ...base, changelogChecked: true, changelogHadEdit: false }),
    ).toBe('SYSTEM_UNEDITED');
    expect(
      classifyEvidenceStrength({ ...base, changelogChecked: true, changelogHadEdit: true }),
    ).toBe('SYSTEM_EDITED');
  });
});

describe('P5.A2 validation lifecycle (C-04.8–10, Arch §6.4)', () => {
  const live = (text: string): LiveSegment => ({ status: 'FOUND', text });

  async function captured() {
    const { fake, repos } = setup();
    const result = await captureEvidence(repos.evidence_item, KEY_A, CAPTURE);
    return { fake, repos, row: result.row };
  }

  it('keeps VALID unchanged and writes no audit event', async () => {
    const { repos, row } = await captured();
    const auditRows: string[] = [];
    const result = await revalidateEvidence(repos.evidence_item, {
      row,
      live: live(TEXT),
      currentKey: KEY_A,
      keyFor: (id) => (id === KEY_A.id ? KEY_A.value : null),
      audit: {
        insert: async (event) => {
          auditRows.push(event.actionCode);
        },
      },
      actorAccountId: 'acct-viewer',
      at: '2026-11-24T13:00:00.000Z',
    });
    expect(result.state).toBe('VALID');
    expect(result.bodyEdited).toBe(false);
    expect(result.slice).toBe(QUOTE);
    expect(auditRows).toEqual([]);
  });

  it('flags a body edit while the quote remains VALID', async () => {
    const { repos, row } = await captured();
    const result = await revalidateEvidence(repos.evidence_item, {
      row,
      live: live(`${TEXT} A later unrelated sentence.`),
      currentKey: KEY_A,
      keyFor: (id) => (id === KEY_A.id ? KEY_A.value : null),
      audit: { insert: async () => undefined },
      actorAccountId: 'acct-viewer',
      at: '2026-11-24T13:00:00.000Z',
    });
    expect(result.state).toBe('VALID');
    expect(result.bodyEdited).toBe(true);
  });

  it('finds a relocated span within the capped window and audits the change', async () => {
    const { repos, row } = await captured();
    const codes: string[] = [];
    const result = await revalidateEvidence(repos.evidence_item, {
      row,
      live: live(`Prefix. ${TEXT}`),
      currentKey: KEY_A,
      keyFor: (id) => (id === KEY_A.id ? KEY_A.value : null),
      audit: {
        insert: async (event) => {
          codes.push(event.actionCode);
        },
      },
      actorAccountId: 'acct-viewer',
      at: '2026-11-24T13:00:00.000Z',
    });
    expect(result.state).toBe('RELOCATED');
    expect(result.row.span_start).toBe(Number(row.span_start) + 'Prefix. '.length);
    expect(codes).toContain('EVIDENCE_STATUS_CHANGED');
  });

  it('marks a removed quote MODIFIED and a deleted comment UNAVAILABLE', async () => {
    const { repos, row } = await captured();
    const modified = await revalidateEvidence(repos.evidence_item, {
      row,
      live: live('Only unrelated text remains.'),
      currentKey: KEY_A,
      keyFor: (id) => (id === KEY_A.id ? KEY_A.value : null),
      audit: { insert: async () => undefined },
      actorAccountId: 'acct-viewer',
      at: '2026-11-24T13:00:00.000Z',
    });
    expect(modified.state).toBe('MODIFIED');

    const unavailable = await revalidateEvidence(repos.evidence_item, {
      row,
      live: { status: 'DELETED' },
      currentKey: KEY_A,
      keyFor: (id) => (id === KEY_A.id ? KEY_A.value : null),
      audit: { insert: async () => undefined },
      actorAccountId: 'acct-viewer',
      at: '2026-11-24T14:00:00.000Z',
    });
    expect(unavailable.state).toBe('UNAVAILABLE');
  });

  it('treats an issue-level denial or app failure as ambiguous and changes nothing', async () => {
    const { repos, row } = await captured();
    const codes: string[] = [];
    for (const denied of [
      { status: 'DENIED' } as LiveSegment,
      { status: 'ISSUE_UNAVAILABLE' } as LiveSegment,
    ]) {
      const result = await revalidateEvidence(repos.evidence_item, {
        row,
        live: denied,
        currentKey: KEY_A,
        keyFor: (id) => (id === KEY_A.id ? KEY_A.value : null),
        audit: {
          insert: async (event) => {
            codes.push(event.actionCode);
          },
        },
        actorAccountId: 'acct-viewer',
        at: '2026-11-24T13:00:00.000Z',
      });
      expect(result.state).toBe('AMBIGUOUS');
    }
    expect(codes).toEqual([]);
    expect((await repos.evidence_item.findBy({ id: String(row.id) }))[0]?.validation_status).toBe(
      'VALID',
    );
  });

  it('re-keys a successfully validated item when the installation key rotates', async () => {
    const { repos, row } = await captured();
    const result = await revalidateEvidence(repos.evidence_item, {
      row,
      live: live(TEXT),
      currentKey: KEY_B,
      keyFor: (id) => (id === KEY_A.id ? KEY_A.value : id === KEY_B.id ? KEY_B.value : null),
      audit: { insert: async () => undefined },
      actorAccountId: 'acct-viewer',
      at: '2026-11-24T13:00:00.000Z',
    });
    expect(result.state).toBe('VALID');
    expect(result.row.hash_key_id).toBe(KEY_B.id);
    expect(result.row.span_hash).toBe(
      hmacRecord(KEY_B.value, {
        version: 'normalise-v1',
        kind: 'span',
        issueId: '10001',
        segmentKey: 'comment:7001',
        text: QUOTE,
      }),
    );
  });

  it('returns UNVERIFIABLE when the recorded normalisation version is retired', async () => {
    const { repos, row } = await captured();
    const result = await revalidateEvidence(repos.evidence_item, {
      row: { ...row, normalisation_version: 'normalise-retired' },
      live: live(TEXT),
      currentKey: KEY_A,
      keyFor: (id) => (id === KEY_A.id ? KEY_A.value : null),
      audit: { insert: async () => undefined },
      actorAccountId: 'acct-viewer',
      at: '2026-11-24T13:00:00.000Z',
    });
    expect(result.state).toBe('UNVERIFIABLE');
  });

  it('returns UNVERIFIABLE rather than scanning beyond the capped window', async () => {
    const { repos, row } = await captured();
    const result = await revalidateEvidence(repos.evidence_item, {
      row,
      live: live(`${'x'.repeat(6000)} ${TEXT}`),
      currentKey: KEY_A,
      keyFor: (id) => (id === KEY_A.id ? KEY_A.value : null),
      audit: { insert: async () => undefined },
      actorAccountId: 'acct-viewer',
      at: '2026-11-24T13:00:00.000Z',
      maxWindowOffsets: 100,
    });
    expect(result.state).toBe('UNVERIFIABLE');
  });
});

describe('P5.A2 cache and per-case rate limit policy (Arch §6.4)', () => {
  it('uses a short cache, then fetches, then rate-limits without reading a clock', () => {
    const base = {
      nowISO: '2026-11-24T13:00:30.000Z',
      lastAtISO: '2026-11-24T13:00:00.000Z',
      callsInWindow: 1,
      maxCalls: 2,
      cacheMs: 60_000,
      windowMs: 3_600_000,
    };
    expect(revalidationDecision(base)).toBe('CACHE');
    expect(revalidationDecision({ ...base, lastAtISO: '2026-11-24T12:58:00.000Z' })).toBe('FETCH');
    expect(revalidationDecision({ ...base, callsInWindow: 2, lastAtISO: null })).toBe(
      'RATE_LIMITED',
    );
  });
});
