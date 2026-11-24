import { describe, expect, it, vi } from 'vitest';
import {
  ensureHashKey,
  hmacRecord,
  type HashKeyMaterial,
  type HashKeyStore,
} from '../src/services/hash-key';

const KEY_A: HashKeyMaterial = { id: 'key-a', value: 'base64keyA' };
const KEY_B: HashKeyMaterial = { id: 'key-b', value: 'base64keyB' };

const store = (overrides: Partial<HashKeyStore> = {}): HashKeyStore => ({
  get: async () => null,
  setIfAbsent: async () => true,
  ...overrides,
});

const PARTS = {
  version: 'normalise-v1',
  kind: 'span' as const,
  issueId: '12345',
  segmentKey: 'comment:678',
  text: 'the reported event text',
};

describe('P2.C1 per-installation hash key (Arch §6.2, §14.3; PF-DB-8; U-3)', () => {
  it('adopts an existing key and never generates a new one', async () => {
    const generate = vi.fn(() => KEY_B);
    const result = await ensureHashKey(store({ get: async () => KEY_A }), generate);
    expect(result).toEqual(KEY_A);
    expect(generate).not.toHaveBeenCalled();
  });

  it('creates and returns a key when none exists', async () => {
    const setIfAbsent = vi.fn(async () => true);
    const result = await ensureHashKey(store({ setIfAbsent }), () => KEY_A);
    expect(result).toEqual(KEY_A);
    expect(setIfAbsent).toHaveBeenCalledWith(KEY_A);
  });

  it('a lost create race adopts the winner and never regenerates', async () => {
    const generate = vi.fn(() => KEY_B);
    let reads = 0;
    const result = await ensureHashKey(
      store({
        setIfAbsent: async () => false, // someone else won
        get: async () => (reads++ === 0 ? null : KEY_A), // then the winner is visible
      }),
      generate,
    );
    expect(result).toEqual(KEY_A);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('fails closed if a lost race leaves no readable key (do not hash with an unstored key)', async () => {
    await expect(
      ensureHashKey(store({ setIfAbsent: async () => false, get: async () => null }), () => KEY_A),
    ).rejects.toThrow('KEY_UNAVAILABLE');
  });
});

describe('P2.C1 identity-bound HMAC-SHA-256 (Arch §6.2; I-1, I-6)', () => {
  it('is deterministic and a 64-character hex digest', () => {
    const a = hmacRecord(KEY_A.value, PARTS);
    expect(a).toBe(hmacRecord(KEY_A.value, PARTS));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('binds to record identity: identical text in two records hashes differently', () => {
    expect(hmacRecord(KEY_A.value, PARTS)).not.toBe(
      hmacRecord(KEY_A.value, { ...PARTS, issueId: '99999' }),
    );
    expect(hmacRecord(KEY_A.value, PARTS)).not.toBe(
      hmacRecord(KEY_A.value, { ...PARTS, segmentKey: 'comment:999' }),
    );
  });

  it('binds to kind, version and key', () => {
    const base = hmacRecord(KEY_A.value, PARTS);
    expect(base).not.toBe(hmacRecord(KEY_A.value, { ...PARTS, kind: 'body' }));
    expect(base).not.toBe(hmacRecord(KEY_A.value, { ...PARTS, version: 'normalise-v2' }));
    expect(base).not.toBe(hmacRecord(KEY_B.value, PARTS));
  });

  it('never leaks the text or a canary probe into the digest', () => {
    const digest = hmacRecord(KEY_A.value, { ...PARTS, text: 'canary-record-text-alpha-7f3a' });
    expect(digest).not.toContain('canary');
    expect(digest).not.toContain('reported event');
  });
});
