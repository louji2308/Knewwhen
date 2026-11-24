/**
 * P3.B1 — IF-3: rule screener and strict lexicon loader (Arch §7.3, C-01.4).
 * Pure core: no @forge/* import. A missing or invalid lexicon is DEGRADED; it
 * is never reported as "no signal". Every candidate span is cut from the live
 * text and passes through the one verbatim validator (IF-2) before it leaves
 * this module, so no acceptance path bypasses I-1/I-2.
 *
 * The real lexicon is rule data owned by locked `rules/*.json` and is not
 * available yet (OI-1/U-1): only the schema and a test fixture ship here.
 */

import { validateQuote, OI4_QUOTE_LIMITS, type QuoteLimits } from './validate';

export const LEXICON_CATEGORIES = Object.freeze([
  'INJURY',
  'HARM',
  'MALFUNCTION',
  'DEVICE_FAILURE',
] as const);
export type LexiconCategory = (typeof LEXICON_CATEGORIES)[number];

export interface LexiconPhrase {
  readonly id: string;
  readonly category: LexiconCategory;
  readonly text: string;
}

export interface Lexicon {
  readonly version: string;
  readonly phrases: readonly LexiconPhrase[];
}

export type LoadFailureCode = 'LEXICON_MISSING' | 'LEXICON_INVALID';

export type LexiconLoadResult =
  | { readonly status: 'LOADED'; readonly lexicon: Lexicon }
  | { readonly status: 'UNVALIDATED'; readonly reasonCode: LoadFailureCode };

export interface ScreenCandidate {
  readonly spanStart: number;
  readonly spanLen: number;
  readonly slice: string;
  readonly phraseId: string;
  readonly category: LexiconCategory;
  readonly method: 'RULE_MATCH';
}

export type ScreenResult =
  | {
      readonly status: 'SCREENED';
      readonly candidates: readonly ScreenCandidate[];
      readonly lexiconVersion: string;
    }
  | {
      readonly status: 'DEGRADED';
      readonly reasonCode: LoadFailureCode;
      readonly candidates: readonly ScreenCandidate[];
    };

/** Bounded input size for rule data; a technical choice, not regulatory content. */
const MAX_PHRASES = 1000;
const MAX_PHRASE_CHARS = OI4_QUOTE_LIMITS.maxChars;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

/** Hand-written strict schema check: no schema library, no coercion, no defaults. */
export function loadLexicon(raw: unknown): LexiconLoadResult {
  if (raw === undefined || raw === null)
    return { status: 'UNVALIDATED', reasonCode: 'LEXICON_MISSING' };

  // Accept an already-loaded result so callers can pass either parsed rule data
  // or the loader's output; it is re-validated either way.
  let candidate: unknown = raw;
  if (isRecord(raw) && raw.status === 'LOADED') candidate = raw.lexicon;

  if (
    !isRecord(candidate) ||
    !exactKeys(candidate, ['phrases', 'version']) ||
    typeof candidate.version !== 'string' ||
    candidate.version.length === 0 ||
    !Array.isArray(candidate.phrases) ||
    candidate.phrases.length === 0 ||
    candidate.phrases.length > MAX_PHRASES
  ) {
    return { status: 'UNVALIDATED', reasonCode: 'LEXICON_INVALID' };
  }

  const ids = new Set<string>();
  const phrases: LexiconPhrase[] = [];
  for (const entry of candidate.phrases) {
    if (
      !isRecord(entry) ||
      !exactKeys(entry, ['category', 'id', 'text']) ||
      typeof entry.id !== 'string' ||
      entry.id.length === 0 ||
      typeof entry.text !== 'string' ||
      entry.text.length === 0 ||
      entry.text.length > MAX_PHRASE_CHARS ||
      typeof entry.category !== 'string' ||
      !LEXICON_CATEGORIES.includes(entry.category as LexiconCategory) ||
      ids.has(entry.id)
    ) {
      return { status: 'UNVALIDATED', reasonCode: 'LEXICON_INVALID' };
    }
    ids.add(entry.id);
    phrases.push({
      id: entry.id,
      category: entry.category as LexiconCategory,
      text: entry.text,
    });
  }

  return { status: 'LOADED', lexicon: { version: candidate.version, phrases } };
}

/** Length-preserving case folding so reported offsets always address live text. */
const fold = (character: string): string => {
  const upper = character.toUpperCase();
  return upper.length === 1 ? upper : character;
};

const matchesAt = (text: string, phrase: string, start: number): boolean => {
  for (let offset = 0; offset < phrase.length; offset += 1) {
    if (fold(text.charAt(start + offset)) !== fold(phrase.charAt(offset))) return false;
  }
  return true;
};

/**
 * Screen one normalised segment. Case-insensitive matching widens recall, but
 * the span itself is always taken from the live text and validated verbatim.
 * Overlapping candidates are reduced to the earliest longest one; merging
 * multiple provenances belongs to the scan-level combination, not to IF-3.
 */
export function screen(
  normalisedText: string,
  lexiconValue: unknown,
  limits: QuoteLimits = OI4_QUOTE_LIMITS,
): ScreenResult {
  const loaded = loadLexicon(lexiconValue);
  if (loaded.status !== 'LOADED') {
    return { status: 'DEGRADED', reasonCode: loaded.reasonCode, candidates: [] };
  }

  const found: ScreenCandidate[] = [];
  for (const phrase of loaded.lexicon.phrases) {
    if (phrase.text.length > limits.maxChars) continue;
    const lastStart = normalisedText.length - phrase.text.length;
    for (let index = 0; index <= lastStart; index += 1) {
      if (!matchesAt(normalisedText, phrase.text, index)) continue;
      const liveSpan = normalisedText.slice(index, index + phrase.text.length);
      const validated = validateQuote(normalisedText, liveSpan, limits);
      if (validated.accepted) {
        found.push({
          spanStart: validated.spanStart,
          spanLen: validated.spanLen,
          slice: validated.slice,
          phraseId: phrase.id,
          category: phrase.category,
          method: 'RULE_MATCH',
        });
      }
      index += phrase.text.length - 1;
    }
  }

  found.sort((a, b) => a.spanStart - b.spanStart || b.spanLen - a.spanLen);
  const candidates: ScreenCandidate[] = [];
  let coveredUntil = -1;
  for (const candidate of found) {
    if (candidate.spanStart < coveredUntil) continue;
    candidates.push(candidate);
    coveredUntil = candidate.spanStart + candidate.spanLen;
  }

  return { status: 'SCREENED', candidates, lexiconVersion: loaded.lexicon.version };
}
