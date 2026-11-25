import { describe, expect, it } from 'vitest';
import type { LookbackAnchor } from '../src/contracts/lookback';
import { buildLookbackQueries, escapeJqlLiteral } from '../src/core/lookback-jql';

const anchor: LookbackAnchor = {
  entryId: 'entry-1',
  issueKey: 'KW-9',
  recordTs: '2026-11-24T15:00:00.000Z',
  tokens: ['dose', 'calculation'],
  watchedProjects: ['KW', "O'Brien"],
  relationships: { reporterId: "rep'1", orgKey: 'org-1', productKey: 'prod-1' },
  unavailableRelationships: [],
};

describe('P8.A2 JQL builders (C-03.1-3, I-6, Arch §8.2)', () => {
  it('escapes JQL literals so no client value can alter the query', () => {
    expect(escapeJqlLiteral("a'b\\c")).toBe("a\\'b\\\\c");
    expect(buildLookbackQueries(anchor).every((query) => !query.jql.includes("O'Brien"))).toBe(
      true,
    );
    expect(buildLookbackQueries(anchor).some((query) => query.jql.includes("rep\\'1"))).toBe(true);
  });

  it('filters to watched projects, strictly earlier records and all available tiers', () => {
    const queries = buildLookbackQueries(anchor);
    expect(queries.map((query) => query.reason)).toEqual([
      'LINKED',
      'SAME_REPORTER',
      'SAME_ORG',
      'SAME_PRODUCT',
      'TEXT_OVERLAP',
    ]);
    for (const query of queries) {
      expect(query.jql).toContain("created < '2026-11-24T15:00:00.000Z'");
      expect(query.jql).toContain('ORDER BY created ASC');
    }
  });

  it('omits relationships that cannot be evaluated and handles no tokens', () => {
    const queries = buildLookbackQueries({
      ...anchor,
      tokens: [],
      relationships: {},
      unavailableRelationships: ['ORG_JSM_ABSENT', 'PRODUCT_NOT_MAPPED'],
    });
    expect(queries.map((query) => query.reason)).toEqual(['LINKED']);
    expect(buildLookbackQueries({ ...anchor, watchedProjects: [] })).toEqual([]);
  });
});
