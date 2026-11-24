import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  captureEvidence,
  revalidateEvidence,
  type EvidenceCaptureInput,
} from '../src/services/evidence';
import { createRepositories } from '../src/services/repositories';
import { createSqlFake } from './support/sql-fake';
import type { HashKeyMaterial } from '../src/services/hash-key';
import { candidateDates, createTrailService } from '../src/services/trail';
import type { AuditRepository } from '../src/services/audit';
import type { SqlRow } from '../src/services/sql';

const KEY_A: HashKeyMaterial = { id: 'key-a', value: 'fk-key-a' };
const KEY_B: HashKeyMaterial = { id: 'key-b', value: 'fk-key-b' };
const keyForBoth = (id: string): string | null =>
  id === KEY_A.id ? KEY_A.value : id === KEY_B.id ? KEY_B.value : null;

const word = fc.constantFrom('alpha', 'beta', 'gamma', 'delta');
const phrase = fc.array(word, { minLength: 1, maxLength: 5 }).map((parts) => parts.join(' '));
const label = fc
  .array(fc.constantFrom(...'abcdefgh0123456789'), { minLength: 5, maxLength: 10 })
  .map((chars) => chars.join(''));

function auditCapture(): { audit: AuditRepository; codes: string[] } {
  const codes: string[] = [];
  return {
    audit: {
      insert: async (event) => {
        codes.push(event.actionCode);
      },
    },
    codes,
  };
}

async function captured(text: string, quote: string, key: HashKeyMaterial = KEY_A) {
  const fake = createSqlFake();
  const repos = createRepositories(fake);
  const result = await captureEvidence(repos.evidence_item, key, {
    ...BASE_CAPTURE,
    segmentText: text,
    quote,
  });
  return { repos, row: result.row, span: result.span };
}

const BASE_CAPTURE: EvidenceCaptureInput = {
  id: 'fk-evidence',
  issueId: '10001',
  segmentKey: 'comment:7001',
  authorAccountId: 'acct-author',
  recordCreatedAt: '2026-11-05T09:12:00.000Z',
  recordUpdatedAt: '2026-11-05T09:12:00.000Z',
  segmentText: '',
  quote: '',
  capturedBy: 'RULE_MATCH',
  strength: 'SYSTEM_UNEDITED',
  capturedAt: '2026-11-24T12:00:00.000Z',
  scanId: 'scan-fk',
};

const REVALIDATE_AT = '2026-11-24T13:00:00.000Z';

function revalidate(
  repos: ReturnType<typeof createRepositories>,
  row: SqlRow,
  live: Parameters<typeof revalidateEvidence>[1]['live'],
  options: Partial<Parameters<typeof revalidateEvidence>[1]> = {},
) {
  const { audit, codes } = auditCapture();
  return {
    codes,
    result: revalidateEvidence(repos.evidence_item, {
      row,
      live,
      currentKey: KEY_A,
      keyFor: keyForBoth,
      audit,
      actorAccountId: 'acct-viewer',
      at: REVALIDATE_AT,
      ...options,
    }),
  };
}

describe('P5.C1 evidence lifecycle properties (Arch §16.1, C-04.8–10)', () => {
  it('keeps an unchanged quote VALID for every generated segment (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(phrase, phrase, phrase, async (prefix, quote, suffix) => {
        const text = `${prefix} ${quote} ${suffix}`;
        const { repos, row, span } = await captured(text, quote);
        const { result, codes } = revalidate(repos, row, { status: 'FOUND', text });
        const state = await result;
        expect(state.state).toBe('VALID');
        expect(state.bodyEdited).toBe(false);
        expect(state.slice).toBe(span);
        expect(codes).toEqual([]);
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });

  it('reports a body edit without degrading a quote that is still present (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(phrase, phrase, phrase, async (prefix, quote, suffix) => {
        const text = `${prefix} ${quote} ${suffix}`;
        const { repos, row } = await captured(text, quote);
        const { result } = revalidate(repos, row, {
          status: 'FOUND',
          text: `${text} tailnote`,
        });
        expect((await result).state).toBe('VALID');
        expect((await result).bodyEdited).toBe(true);
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });

  it('finds a moved quote inside the capped window and audits RELOCATED (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(label, phrase, phrase, async (tag, quote, suffix) => {
        const text = `${quote} ${suffix}`;
        const { repos, row } = await captured(text, quote);
        const lead = `lead${tag}. `;
        const { result, codes } = revalidate(repos, row, {
          status: 'FOUND',
          text: `${lead}${text}`,
        });
        const state = await result;
        expect(state.state).toBe('RELOCATED');
        expect(Number(state.row.span_start)).toBe(Number(row.span_start) + lead.length);
        expect(codes).toContain('EVIDENCE_STATUS_CHANGED');
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });

  it('marks a removed quote MODIFIED and a deleted comment UNAVAILABLE (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(
        phrase,
        fc.constantFrom('unrelated-one', 'unrelated-two'),
        async (quote, other) => {
          const { repos, row } = await captured(`lead ${quote} tail`, quote);
          const modified = revalidate(repos, row, { status: 'FOUND', text: `only ${other}` });
          expect((await modified.result).state).toBe('MODIFIED');
          const unavailable = revalidate(repos, row, { status: 'DELETED' });
          expect((await unavailable.result).state).toBe('UNAVAILABLE');
        },
      ),
      { numRuns: 100, seed: 20261124 },
    );
  });

  it('keeps an issue-level denial or outage AMBIGUOUS and writes nothing (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(phrase, async (quote) => {
        const text = `lead ${quote} tail`;
        const { repos, row } = await captured(text, quote);
        for (const live of [{ status: 'DENIED' }, { status: 'ISSUE_UNAVAILABLE' }] as const) {
          const { result, codes } = revalidate(repos, row, live);
          expect((await result).state).toBe('AMBIGUOUS');
          expect(codes).toEqual([]);
        }
        expect(
          (await repos.evidence_item.findBy({ id: String(row.id) }))[0]?.validation_status,
        ).toBe('VALID');
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });

  it('returns UNVERIFIABLE when the recorded key cannot be read (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(phrase, async (quote) => {
        const text = `lead ${quote} tail`;
        const { repos, row } = await captured(text, quote);
        const { result } = revalidate(
          repos,
          row,
          { status: 'FOUND', text },
          { keyFor: () => null },
        );
        expect((await result).state).toBe('UNVERIFIABLE');
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });

  it('re-keys only after a successful unchanged validation (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(phrase, async (quote) => {
        const text = `lead ${quote} tail`;
        const { repos, row } = await captured(text, quote);
        const { result } = revalidate(
          repos,
          row,
          { status: 'FOUND', text },
          { currentKey: KEY_B, keyFor: keyForBoth },
        );
        const state = await result;
        expect(state.state).toBe('VALID');
        expect(state.row.hash_key_id).toBe(KEY_B.id);
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });
});

describe('P5.C2 idempotency and replay properties (G-7, WF-9)', () => {
  it('duplicate capture of the same pointer and span is idempotent (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(label, phrase, async (tag, quote) => {
        const fake = createSqlFake();
        const repos = createRepositories(fake);
        const text = `lead ${quote} tail`;
        const input: EvidenceCaptureInput = {
          ...BASE_CAPTURE,
          id: `evidence-${tag}`,
          issueId: `issue-${tag}`,
          segmentKey: `comment:${tag}`,
          segmentText: text,
          quote,
        };
        const first = await captureEvidence(repos.evidence_item, KEY_A, input);
        const second = await captureEvidence(repos.evidence_item, KEY_A, {
          ...input,
          id: `different-${tag}`,
        });
        expect(second.inserted).toBe(false);
        expect(second.row.id).toBe(first.row.id);
        expect(fake.dump('evidence_item')).toHaveLength(1);
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });

  it('concurrent case creation adopts one row by anchor and sequence (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(label, fc.integer({ min: 1, max: 99 }), async (anchor, seq) => {
        const fake = createSqlFake();
        const repos = createRepositories(fake);
        const { audit } = auditCapture();
        const service = createTrailService(repos.review_case, repos.trail_entry, audit);
        const base = {
          anchorIssueId: `issue-${anchor}`,
          caseSeq: seq,
          origin: 'SIGNAL',
          at: '2026-11-24T12:00:00.000Z',
        };
        const [left, right] = await Promise.all([
          service.createCase({ ...base, id: `left-${anchor}` }),
          service.createCase({ ...base, id: `right-${anchor}` }),
        ]);
        expect(right.id).toBe(left.id);
        expect(fake.dump('review_case')).toHaveLength(1);
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });

  it('a replayed confirmation is rejected without a second audit event (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(label, async (tag) => {
        const fake = createSqlFake();
        const repos = createRepositories(fake);
        const { audit, codes } = auditCapture();
        const service = createTrailService(repos.review_case, repos.trail_entry, audit);
        await service.createCase({
          id: `case-${tag}`,
          anchorIssueId: `issue-${tag}`,
          caseSeq: 1,
          origin: 'MANUAL',
          at: '2026-11-24T12:00:00.000Z',
        });
        await service.addEntered({
          id: `entry-${tag}`,
          caseId: `case-${tag}`,
          source: 'MANUAL',
          receivedDateEntered: '2026-11-01',
          enteredBy: 'acct-reviewer',
          enteredAt: '2026-11-24T12:10:00.000Z',
          asOfDate: '2026-11-24',
        });
        const input = {
          entryId: `entry-${tag}`,
          actorRole: 'QUALIFIED_PERSON' as const,
          actorAccountId: 'acct-qp',
          at: '2026-11-24T12:20:00.000Z',
        };
        expect((await service.confirm(input)).status).toBe('CONFIRMED');
        await expect(service.confirm(input)).rejects.toThrow('TRAIL_STATE');
        expect(codes).toEqual(['CONFIRM_TRAIL_ENTRY']);
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });

  it('candidate dates stay ordered by date under entry reordering (FK)', async () => {
    await fc.assert(
      fc.asyncProperty(label, fc.boolean(), async (tag, reverse) => {
        const early = {
          id: 'entry-early',
          status: 'CONFIRMED',
          kind: 'ENTERED',
          received_date_entered: '2026-11-01',
          entered_at: '2026-11-24T11:00:00.000Z',
        };
        const late = {
          id: 'entry-late',
          status: 'CONFIRMED',
          kind: 'ENTERED',
          received_date_entered: `2026-11-${tag.startsWith('a') ? '20' : '15'}`,
          entered_at: '2026-11-24T12:00:00.000Z',
        };
        const rows: SqlRow[] = reverse ? [late, early] : [early, late];
        const list = candidateDates(rows, new Map(), null);
        const dates = list.candidates
          .filter((candidate) => candidate.basis === 'ENTERED_RECEIPT_DATE')
          .map((candidate) => candidate.effectiveDate);
        expect(dates).toEqual([...dates].sort());
        expect(list.preselectedEntryId).toBeNull();
        expect(list.preselectedBasis).toBeNull();
      }),
      { numRuns: 100, seed: 20261124 },
    );
  });
});
