/**
 * P8.A1 — pure matcher and ranker (Arch §8.4-8.6, C-03.4-5/13).
 * The overlap is a deterministic count ratio, never a probability. The profile
 * numbers are orchestrator engineering defaults from OI-4, recorded in D-016;
 * QA/RA content and pass bars are not invented here (I-7).
 */

import type {
  LookbackCaps,
  LookbackConfidence,
  LookbackProfile,
  LookbackReasonCode,
} from '../contracts/lookback';
import { normalise } from './normalise';

export const LOOKBACK_PROFILE_VERSION = 'lookback-profile-v1' as const;

export const DEFAULT_LOOKBACK_PROFILE: LookbackProfile = Object.freeze({
  version: LOOKBACK_PROFILE_VERSION,
  highOverlap: 0.34,
  moderateOverlap: 0.18,
  minDistinctiveTokens: 2,
});

/** OI-4 engineering defaults, not regulatory values (D-016). */
export const DEFAULT_LOOKBACK_CAPS: LookbackCaps = Object.freeze({
  maxSearchCalls: 4,
  maxIssues: 40,
  maxCandidatesPerLabel: 10,
  depth: 2,
});

export const CONFIDENCE_ORDER: Readonly<Record<LookbackConfidence, number>> = Object.freeze({
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
});

const STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'but',
  'by',
  'for',
  'from',
  'he',
  'her',
  'his',
  'i',
  'if',
  'in',
  'is',
  'it',
  'its',
  'me',
  'my',
  'note',
  'of',
  'on',
  'or',
  'our',
  'please',
  'she',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'to',
  'update',
  'was',
  'we',
  'were',
  'what',
  'when',
  'which',
  'who',
  'why',
  'with',
  'you',
  'your',
]);

/** Terms that occur in nearly every record and would create false agreement. */
const BOILERPLATE_TERMS: ReadonlySet<string> = new Set([
  'advise',
  'alpha',
  'app',
  'application',
  'beta',
  'case',
  'clinic',
  'company',
  'customer',
  'device',
  'issue',
  'north',
  'product',
  'ticket',
  'user',
]);

const TOKEN = /[\p{L}\p{N}]+/gu;

export function distinctiveTokens(text: string): readonly string[] {
  const tokens = normalise(text)
    .toLocaleLowerCase('en-US')
    .match(TOKEN)
    ?.filter(
      (token) => token.length >= 3 && !STOP_WORDS.has(token) && !BOILERPLATE_TERMS.has(token),
    );
  return [...new Set(tokens ?? [])].sort();
}

export function overlapCount(
  anchorTokens: readonly string[],
  candidateTokens: readonly string[],
): number {
  const anchor = new Set(anchorTokens);
  return new Set(candidateTokens).size === 0
    ? 0
    : [...new Set(candidateTokens)].filter((token) => anchor.has(token)).length;
}

export interface RankInput {
  readonly reasonCodes: readonly LookbackReasonCode[];
  readonly anchorTokens: readonly string[];
  readonly candidateTokens: readonly string[];
  readonly profile?: LookbackProfile;
}

export interface RankResult {
  readonly confidence: LookbackConfidence;
  readonly reasonCodes: readonly LookbackReasonCode[];
  readonly overlap: number;
}

const RELATIONSHIP_CODES: ReadonlySet<LookbackReasonCode> = new Set([
  'LINKED',
  'LINKED_2',
  'SAME_REPORTER',
  'SAME_ORG',
  'SAME_PRODUCT',
]);

/**
 * Architecture §8.5 fixes two limits regardless of tuning: no "confirmed"
 * label, and relationship-only matches never above LOW. The plan's "LINKED
 * alone = MEDIUM" example conflicts with that fixed limit; the fixed limit is
 * applied and the conflict is recorded as CF-P8-1 in TODO.md.
 */
export function rankCandidate(input: RankInput): RankResult {
  const profile = input.profile ?? DEFAULT_LOOKBACK_PROFILE;
  const anchor = new Set(input.anchorTokens);
  const candidate = new Set(input.candidateTokens);
  if (anchor.size === 0 || candidate.size === 0) {
    return { confidence: 'LOW', reasonCodes: [], overlap: 0 };
  }
  const shared = [...candidate].filter((token) => anchor.has(token)).length;
  const denominator = Math.min(anchor.size, candidate.size);
  const overlap = denominator === 0 ? 0 : shared / denominator;
  const hasText =
    candidate.size >= profile.minDistinctiveTokens && overlap >= profile.moderateOverlap;
  const reasonCodes = [
    ...new Set(input.reasonCodes.filter((code) => code !== 'TEXT_OVERLAP' || hasText)),
  ].sort();
  const hasRelationship = reasonCodes.some((code) => RELATIONSHIP_CODES.has(code));
  const hasTextCode = reasonCodes.includes('TEXT_OVERLAP');

  let confidence: LookbackConfidence = 'LOW';
  if (hasTextCode && hasRelationship && overlap >= profile.highOverlap) confidence = 'HIGH';
  else if (hasTextCode && overlap >= profile.highOverlap) confidence = 'MEDIUM';

  return { confidence, reasonCodes, overlap };
}

/** Plain-language reasons: codes and counts only, never candidate text (I-6). */
export function matchReasons(
  reasonCodes: readonly LookbackReasonCode[],
  sharedTokens: number,
): readonly string[] {
  return reasonCodes.map((code) => {
    switch (code) {
      case 'LINKED':
        return 'linked directly to the anchor record';
      case 'LINKED_2':
        return 'linked through one intermediate record';
      case 'SAME_REPORTER':
        return 'same reporter';
      case 'SAME_ORG':
        return 'same organisation (JSM)';
      case 'SAME_PRODUCT':
        return 'same mapped product field';
      case 'TEXT_OVERLAP':
        return `${sharedTokens} shared distinctive terms`;
    }
  });
}
