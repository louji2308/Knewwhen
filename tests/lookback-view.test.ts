import { describe, expect, it } from 'vitest';
import {
  groupLookbackCandidates,
  LOOKBACK_UI_STRINGS,
  lookbackAnchorEntryId,
  lookbackViewModel,
} from '../src/frontend/lookback-view';
import type { ResolverEnvelope } from '../src/contracts/envelope';

const envelope = (data: unknown, roleHint = 'REVIEWER'): ResolverEnvelope<unknown> => ({
  data,
  roleHint,
  code: 'OK',
  correlationId: 'c1',
});

const step = {
  kind: 'LOOKBACK_STEP',
  status: 'PARTIAL',
  candidates: [
    {
      id: 'cand-1',
      issueKey: 'KW-1',
      recordTs: '2026-11-05T09:12:00.000Z',
      tsStrength: 'JIRA_COMMENT_TIMESTAMP',
      reasons: ['linked directly to the anchor record', '3 shared distinctive terms'],
      confidence: 'HIGH',
      state: 'PROPOSED',
      candidateSegmentKey: 's0',
      text: 'dose calculation froze',
    },
  ],
  incomplete: true,
  done: false,
  nextCursor: 'c2',
  capsHit: ['MAX_ISSUES_EXAMINED'],
  unavailableRelationships: ['PRODUCT_NOT_MAPPED'],
  examined: 40,
  searchCalls: 1,
};

describe('P8.C1 Earlier records view model (C-03.4/10/13, C-09.2-3, I-6)', () => {
  it('starts idle and fails closed on unavailable or malformed results', () => {
    expect(lookbackViewModel(null)).toMatchObject({ kind: 'IDLE' });
    expect(lookbackViewModel({ ...envelope(null), code: 'NOT_FOUND' })).toMatchObject({
      kind: 'UNAVAILABLE',
    });
    expect(lookbackViewModel(envelope({}))).toMatchObject({ kind: 'ERROR' });
  });

  it('shows metadata, coverage and confidence help but never record text', () => {
    const model = lookbackViewModel(envelope(step));
    expect(model.kind).toBe('RESULT');
    if (model.kind !== 'RESULT') return;
    expect(model.candidates[0]).toMatchObject({
      issueKey: 'KW-1',
      confidence: 'HIGH',
      state: 'Proposed',
    });
    expect(model.coverage).toEqual([
      LOOKBACK_UI_STRINGS.caps.MAX_ISSUES_EXAMINED,
      LOOKBACK_UI_STRINGS.unavailableRelationships.PRODUCT_NOT_MAPPED,
    ]);
    expect(JSON.stringify(model)).not.toContain('froze');
    expect(model.canAnswer).toBe(false);
  });

  it('enables answers only for the server role hint', () => {
    const model = lookbackViewModel(envelope(step, 'QUALIFIED_PERSON'));
    expect(model.kind === 'RESULT' && model.canAnswer).toBe(true);
  });

  it('reads segment metadata and the new anchor from a decision envelope', () => {
    const shown = lookbackViewModel(
      envelope({
        kind: 'LOOKBACK_SEGMENTS',
        ...{ candidates: [], coverage: [] },
        segments: [
          {
            key: 's0',
            authorAccountId: 'a1',
            recordCreatedAt: '2026-11-05T09:12:00.000Z',
            strength: 'SYSTEM_UNEDITED',
            wholeSegmentAllowed: true,
            text: 'dose calculation froze',
          },
        ],
      }),
    );
    expect(shown.kind).toBe('SEGMENTS');
    if (shown.kind === 'SEGMENTS') expect(shown.segments).toHaveLength(1);
    expect(JSON.stringify(shown)).not.toContain('froze');

    const decided = lookbackViewModel(
      envelope(
        {
          kind: 'LOOKBACK_DECISION',
          candidates: [],
          trailEntryId: 'trail-1',
        },
        'QUALIFIED_PERSON',
      ),
    );
    expect(decided.kind === 'DECISION' && decided.newAnchorEntryId).toBe('trail-1');
  });

  it('takes an anchor only from a Jira-backed trail entry', () => {
    const entries = [
      { entryId: 'entered-1', kind: 'Entered by a person' },
      { entryId: 'jira-1', kind: 'From a Jira record' },
      { entryId: 'jira-2', kind: 'From a Jira record' },
    ];
    expect(lookbackAnchorEntryId(entries)).toBe('jira-1');
    expect(lookbackAnchorEntryId(entries, 'entered-1')).toBe('jira-1');
    expect(lookbackAnchorEntryId(entries, 'jira-2')).toBe('jira-2');
    expect(
      lookbackAnchorEntryId([{ entryId: 'entered-1', kind: 'Entered by a person' }]),
    ).toBeNull();
  });

  it('groups candidates by confidence without changing their order', () => {
    const result = lookbackViewModel(envelope(step));
    if (result.kind !== 'RESULT') throw new Error('expected RESULT');
    const low = { ...result.candidates[0]!, id: 'cand-low', confidence: 'LOW' };
    const medium = { ...low, id: 'cand-medium', confidence: 'MEDIUM' };
    const grouped = groupLookbackCandidates([low, result.candidates[0]!, medium]);
    expect(grouped.map((group) => group.confidence)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    expect(grouped[0]!.rows.map((row) => row.id)).toEqual(['cand-1']);
  });
});
