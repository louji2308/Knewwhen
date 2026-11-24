/**
 * P3.A1 — IF-1: ADF extraction and normalisation v1 (Arch §6.3, I-1).
 * Pure core: no @forge/* import. The output is versioned and frozen: once any
 * evidence has been captured under `normalise-v1`, this behaviour is never
 * edited; a new behaviour is a new version shipped alongside it.
 *
 * Placeholders are private-use characters. They cannot occur in ordinary
 * record text, so a quote that contains or crosses one is detectable (§6.3).
 */

export const NORMALISATION_VERSION = 'normalise-v1' as const;
export type NormalisationVersion = typeof NORMALISATION_VERSION;

export type AdfNode = Readonly<Record<string, unknown>>;

/** Volatile nodes are replaced so a rename or re-render cannot break evidence. */
export const PLACEHOLDER_TOKENS = Object.freeze({
  mention: '\uE000',
  emoji: '\uE001',
  media: '\uE002',
  mediaSingle: '\uE002',
  inlineCard: '\uE003',
  blockCard: '\uE003',
  status: '\uE004',
  date: '\uE005',
  unknown: '\uE00F',
} as const);

/** Every placeholder is a private-use code point; none is whitespace. */
export const PLACEHOLDER_CODE_POINTS: ReadonlySet<string> = new Set(
  Object.values(PLACEHOLDER_TOKENS),
);

const BLOCK_CONTAINERS = new Set(['bulletList', 'orderedList', 'table', 'blockquote', 'listItem']);
const LEAF_BLOCKS = new Set(['paragraph', 'heading', 'codeBlock', 'tableCell']);

function children(node: AdfNode): readonly AdfNode[] {
  return Array.isArray(node.content) ? (node.content as AdfNode[]) : [];
}

function typeOf(node: AdfNode): string {
  return typeof node.type === 'string' ? node.type : 'unknown';
}

function placeholderFor(type: string): string | undefined {
  return (PLACEHOLDER_TOKENS as Readonly<Record<string, string>>)[type];
}

/** Flatten one block's inline content into raw text, preserving case/punctuation. */
function flattenInline(nodes: readonly AdfNode[]): string {
  const parts: string[] = [];
  for (const node of nodes) {
    const type = typeOf(node);
    if (type === 'text') {
      if (typeof node.text === 'string') parts.push(node.text);
      continue;
    }
    if (type === 'hardBreak') {
      parts.push('\n');
      continue;
    }
    const placeholder = placeholderFor(type);
    if (placeholder) {
      parts.push(placeholder);
      continue;
    }
    if (BLOCK_CONTAINERS.has(type) || LEAF_BLOCKS.has(type)) {
      parts.push('\n', flattenInline(children(node)));
      continue;
    }
    parts.push(PLACEHOLDER_TOKENS.unknown);
  }
  return parts.join('');
}

export interface Segment {
  /** Stable key for a live re-fetch pointer (Arch §6.4). */
  readonly key: string;
  /** Normalised text; offsets in evidence refer to this string. */
  readonly text: string;
  /** ADF path from the document root, as a position map. */
  readonly path: readonly number[];
}

function assertVersion(version: string): void {
  if (version !== NORMALISATION_VERSION) throw new Error('UNSUPPORTED_VERSION');
}

/**
 * NFC, collapse every whitespace run to one space, trim. Idempotent. Applied to
 * plain-text quote proposals as well as to flattened ADF blocks so one rule
 * serves model, rule and human quotes (I-1).
 */
export function normalise(text: string, version: string = NORMALISATION_VERSION): string {
  assertVersion(version);
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

/** Extract normalised segments from an ADF document with stable keys and paths. */
export function extractSegments(
  adf: AdfNode,
  version: string = NORMALISATION_VERSION,
): readonly Segment[] {
  assertVersion(version);
  const segments: Segment[] = [];

  const walk = (nodes: readonly AdfNode[], path: readonly number[]): void => {
    nodes.forEach((node, index) => {
      const type = typeOf(node);
      const here = [...path, index];
      if (BLOCK_CONTAINERS.has(type)) {
        walk(children(node), here);
        return;
      }
      if (type === 'tableRow') {
        walk(children(node), here);
        return;
      }
      const text = normalise(flattenInline(children(node)), version);
      if (text.length > 0) segments.push({ key: `s:${segments.length}`, text, path: here });
    });
  };

  walk(children(adf), []);
  return segments;
}
