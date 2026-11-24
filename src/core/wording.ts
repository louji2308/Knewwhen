/**
 * P4.C1 — G-1/C-05.11 wording guard (I-5/I-13). App-authored UI text, error
 * strings and log messages must never state or imply a reportability outcome,
 * compliance or legal advice. Rule-data questions are allowed as questions.
 * This guard scans authored strings, not record text (which is never logged).
 */

export const APPROVED_DISCLAIMERS: readonly string[] = Object.freeze([
  'Decision support, not a regulatory determination or legal advice.',
]);

/** Deliberately conservative: an app-authored string containing any of these is rejected. */
export const BANNED_PHRASES: readonly string[] = Object.freeze([
  'reportable',
  'compliant',
  'non-compliant',
  'late filing',
  'you must report',
  'should report',
  'determination',
  'legal advice',
]);

export interface WordingMatch {
  readonly textIndex: number;
  readonly phrase: string;
  readonly position: number;
}

export type WordingScanResult =
  | { readonly status: 'CLEAN' }
  | { readonly status: 'VIOLATION'; readonly matches: readonly WordingMatch[] };

const fold = (character: string): string => {
  const upper = character.toUpperCase();
  return upper.length === 1 ? upper : character;
};

function indexOfFolded(text: string, phrase: string): number {
  for (let index = 0; index <= text.length - phrase.length; index += 1) {
    let matched = true;
    for (let offset = 0; offset < phrase.length; offset += 1) {
      if (fold(text.charAt(index + offset)) !== fold(phrase.charAt(offset))) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

export function scanWording(texts: readonly string[]): WordingScanResult {
  const matches: WordingMatch[] = [];
  texts.forEach((text, textIndex) => {
    if (APPROVED_DISCLAIMERS.includes(text)) return;
    for (const phrase of BANNED_PHRASES) {
      const position = indexOfFolded(text, phrase);
      if (position >= 0) matches.push({ textIndex, phrase, position });
    }
  });
  return matches.length === 0 ? { status: 'CLEAN' } : { status: 'VIOLATION', matches };
}

export function assertNoBannedWording(texts: readonly string[]): void {
  if (scanWording(texts).status === 'VIOLATION') throw new Error('BANNED_WORDING');
}
