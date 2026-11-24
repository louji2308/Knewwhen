import { describe, expect, it } from 'vitest';
import {
  parseScanMessage,
  SCAN_REASON_CODES,
  SCAN_STATUSES,
  SCAN_TRIGGERS,
} from '../src/contracts/scan';

describe('P6.0 IF-10 scan contract (C-01.10, Arch §7)', () => {
  it('freezes the trigger, status and reason vocabularies', () => {
    expect([...SCAN_TRIGGERS]).toEqual([
      'ISSUE_CREATED',
      'ISSUE_UPDATED',
      'COMMENT_CREATED',
      'LINK_CREATED',
      'DAILY_SWEEP',
      'MANUAL',
    ]);
    expect([...SCAN_STATUSES]).toEqual(['QUEUED', 'RUNNING', 'DONE', 'FAILED', 'DEFERRED']);
    expect([...SCAN_REASON_CODES]).toEqual([
      'NO_SIGNAL',
      'SIGNAL',
      'SKIPPED_SCOPE',
      'SKIPPED_SELF',
      'SKIPPED_NOACCESS',
      'UNCHANGED',
      'LLM_DEFERRED',
      'LLM_BLOCKED',
      'LLM_TIMEOUT',
      'LLM_INVALID',
      'LEXICON_MISSING',
      'LEXICON_INVALID',
      'SCAN_TIMEOUT',
      'SCAN_FAILED',
    ]);
  });

  it('accepts only the four pinned message fields', () => {
    expect(
      parseScanMessage({
        issueId: 'KW-100',
        eventType: 'COMMENT_CREATED',
        entityId: '12345',
        trigger: 'MANUAL',
      }),
    ).toEqual({
      issueId: 'KW-100',
      eventType: 'COMMENT_CREATED',
      entityId: '12345',
      trigger: 'MANUAL',
    });
  });

  it('rejects extra claims, missing fields and unknown enum values', () => {
    const base = {
      issueId: 'KW-100',
      eventType: 'COMMENT_CREATED',
      entityId: '12345',
      trigger: 'MANUAL',
    };
    expect(parseScanMessage({ ...base, role: 'QUALIFIED_PERSON' })).toBeNull();
    expect(parseScanMessage({ ...base, issueId: '' })).toBeNull();
    expect(parseScanMessage({ ...base, trigger: 'HIDDEN_DEMO' })).toBeNull();
    expect(parseScanMessage(null)).toBeNull();
  });
});
