import { describe, expect, it } from 'vitest';
import {
  distinctiveTokens,
  LOOKBACK_PROFILE_VERSION,
  overlapCount,
  rankCandidate,
} from '../src/core/lookback-matcher';
import { LOOKBACK_CONFIDENCE_LABELS, type LookbackReasonCode } from '../src/contracts/lookback';

const anchor = distinctiveTokens(
  'The Alpha app froze during dose calculation; the patient went to the ER for observation.',
);

describe('P8.A1 lookback matcher and ranker (C-03.5, C-03.13, Arch §8.5)', () => {
  it('tokenises deterministically and suppresses stop and boilerplate terms', () => {
    expect(anchor).toEqual([...anchor].sort());
    expect(anchor).toContain('dose');
    expect(anchor).toContain('calculation');
    expect(anchor).toContain('patient');
    expect(anchor).not.toContain('the');
    expect(anchor).not.toContain('app');
    expect(anchor).not.toContain('alpha');
    expect(distinctiveTokens('The app issue. Please advise.')).toEqual([]);
  });

  it('counts shared distinctive tokens and never returns a probability', () => {
    const candidate = distinctiveTokens('Dose calculation froze again; patient went to the ER.');
    expect(overlapCount(anchor, candidate)).toBeGreaterThanOrEqual(3);
    expect(LOOKBACK_CONFIDENCE_LABELS).not.toContain('CONFIRMED' as never);
    expect(LOOKBACK_PROFILE_VERSION).toBe('lookback-profile-v1');
  });

  it('allows HIGH only for text plus one relationship family above the high threshold', () => {
    const ranked = rankCandidate({
      reasonCodes: ['LINKED', 'TEXT_OVERLAP'],
      anchorTokens: anchor,
      candidateTokens: anchor,
    });
    expect(ranked.confidence).toBe('HIGH');
    expect(ranked.overlap).toBe(1);
  });

  it('caps text-only matches at MEDIUM', () => {
    const ranked = rankCandidate({
      reasonCodes: ['TEXT_OVERLAP'],
      anchorTokens: anchor,
      candidateTokens: anchor,
    });
    expect(ranked.confidence).toBe('MEDIUM');
  });

  it('never raises relationship-only matches above LOW', () => {
    const cases: readonly (readonly LookbackReasonCode[])[] = [
      ['LINKED'],
      ['SAME_REPORTER', 'SAME_PRODUCT'],
      ['LINKED_2', 'SAME_ORG'],
    ];
    for (const reasonCodes of cases) {
      expect(
        rankCandidate({ reasonCodes, anchorTokens: anchor, candidateTokens: anchor }).confidence,
      ).toBe('LOW');
    }
  });

  it('keeps a weak text overlap LOW and rejects candidates below the minimum token count', () => {
    const weak = rankCandidate({
      reasonCodes: ['SAME_REPORTER', 'TEXT_OVERLAP'],
      anchorTokens: anchor,
      candidateTokens: distinctiveTokens('An unrelated note about invoices.'),
    });
    expect(weak.confidence).toBe('LOW');
    expect(weak.reasonCodes).not.toContain('TEXT_OVERLAP');
  });
});
