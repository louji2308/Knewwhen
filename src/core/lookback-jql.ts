/**
 * P8.A2 — deterministic JQL builders for the three candidate tiers
 * (Arch §8.2, C-03.1–3). Pure core: the resulting string contains only escaped
 * literals from server-resolved anchor data, never an unescaped client value
 * and never record text. The as-user identity is supplied to the Jira port by
 * the handler, not embedded in JQL.
 */

import type { LookbackAnchor } from '../contracts/lookback';
import { distinctiveTokens } from './lookback-matcher';

export interface LookbackQuery {
  readonly tier: 'L' | 'R' | 'T';
  readonly reason: 'LINKED' | 'SAME_REPORTER' | 'SAME_ORG' | 'SAME_PRODUCT' | 'TEXT_OVERLAP';
  readonly jql: string;
}

/** Jira JQL string literals use single quotes; backslashes and quotes are escaped. */
export function escapeJqlLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const list = (values: readonly string[]): string =>
  values.map((value) => `'${escapeJqlLiteral(value)}'`).join(', ');

/** Every field name is a fixed constant; no client value can become a field. */
const FIELDS = Object.freeze({
  project: 'project',
  created: 'created',
  reporter: 'reporter',
  organisation: 'organization',
  product: 'Product',
  text: 'text',
  link: 'issueLinkType',
});

function prefix(input: LookbackAnchor): string {
  return [
    `${FIELDS.project} in (${list(input.watchedProjects)})`,
    `${FIELDS.created} < '${escapeJqlLiteral(input.recordTs)}'`,
  ].join(' AND ');
}

/**
 * Link expansion is intentionally a separate query: the first degree is found
 * from the anchor's links by the Jira port, and the second degree from those
 * results. The depth cap is enforced by the service, not by JQL.
 */
export function buildLookbackQueries(input: LookbackAnchor): readonly LookbackQuery[] {
  if (input.watchedProjects.length === 0) return [];
  const base = prefix(input);
  const queries: LookbackQuery[] = [
    {
      tier: 'L',
      reason: 'LINKED',
      jql: `${base} AND issue in linkedIssues('${escapeJqlLiteral(input.issueKey)}') ORDER BY created ASC`,
    },
  ];
  if (input.relationships.reporterId !== undefined) {
    queries.push({
      tier: 'R',
      reason: 'SAME_REPORTER',
      jql: `${base} AND ${FIELDS.reporter} = '${escapeJqlLiteral(input.relationships.reporterId)}' ORDER BY created ASC`,
    });
  }
  if (input.relationships.orgKey !== undefined) {
    queries.push({
      tier: 'R',
      reason: 'SAME_ORG',
      jql: `${base} AND ${FIELDS.organisation} = '${escapeJqlLiteral(input.relationships.orgKey)}' ORDER BY created ASC`,
    });
  }
  if (input.relationships.productKey !== undefined) {
    queries.push({
      tier: 'R',
      reason: 'SAME_PRODUCT',
      jql: `${base} AND ${FIELDS.product} = '${escapeJqlLiteral(input.relationships.productKey)}' ORDER BY created ASC`,
    });
  }
  const tokens = [...new Set(input.tokens.flatMap((token) => distinctiveTokens(token)))];
  if (tokens.length > 0) {
    const clauses = tokens
      .map((token) => `${FIELDS.text} ~ '${escapeJqlLiteral(token)}'`)
      .join(' OR ');
    queries.push({
      tier: 'T',
      reason: 'TEXT_OVERLAP',
      jql: `${base} AND (${clauses}) ORDER BY created ASC`,
    });
  }
  return queries;
}
