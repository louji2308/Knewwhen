/**
 * P2.C1 — per-installation key custody and identity-bound hashing (Arch §6.2,
 * §14.3). One random 256-bit key per installation in the KVS secret store;
 * created once, never regenerated, lost races adopt the winner. The HMAC binds
 * text to the record identity so equal text in two records yields different
 * hashes. Only hashes are stored — never text, model I/O or the key (I-1, I-6).
 *
 * The KVS is injected: this module imports only node:crypto (a built-in allowed
 * by Arch §6.2) and never @forge/*.
 */

import { createHmac, randomBytes, randomUUID } from 'node:crypto';

export interface HashKeyMaterial {
  readonly id: string;
  readonly value: string;
}

/** Minimal KVS secret-store contract. `setIfAbsent` is the conditional create. */
export interface HashKeyStore {
  get(): Promise<HashKeyMaterial | null>;
  setIfAbsent(candidate: HashKeyMaterial): Promise<boolean>;
}

export type KeyGenerator = () => HashKeyMaterial;

/** Default generator: 256 random bits, referenced by a UUID. */
export const generateHashKey: KeyGenerator = () => ({
  id: randomUUID(),
  value: randomBytes(32).toString('base64'),
});

/**
 * Return the installation's key, creating it once if absent. A lost create race
 * re-reads and adopts the winner. If neither a create nor a readable key can be
 * confirmed, fail closed — hashing with an unstored key would produce evidence
 * no later reader could validate.
 */
export async function ensureHashKey(
  store: HashKeyStore,
  generate: KeyGenerator = generateHashKey,
): Promise<HashKeyMaterial> {
  const existing = await store.get();
  if (existing) return existing;

  const candidate = generate();
  const created = await store.setIfAbsent(candidate);
  if (created) return candidate;

  const winner = await store.get();
  if (!winner) throw new Error('KEY_UNAVAILABLE');
  return winner;
}

export interface HashParts {
  readonly version: string;
  readonly kind: 'span' | 'body';
  readonly issueId: string;
  readonly segmentKey: string;
  readonly text: string;
}

/**
 * HMAC-SHA-256 over version ‖ kind ‖ issue_id ‖ segment_key ‖ normalised_text.
 * NUL separators make the concatenation unambiguous; normalised text cannot
 * contain NUL (whitespace is collapsed). The key never appears in the output.
 */
export function hmacRecord(keyValue: string, parts: HashParts): string {
  const message = [parts.version, parts.kind, parts.issueId, parts.segmentKey, parts.text].join(
    '\u0000',
  );
  return createHmac('sha256', keyValue).update(message, 'utf8').digest('hex');
}
