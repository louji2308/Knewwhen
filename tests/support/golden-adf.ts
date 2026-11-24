/**
 * P3.A4 — frozen golden ADF corpus. Expected values are authored from the
 * Architecture §6.3 rules (not captured from the implementation). Placeholder
 * tokens are private-use characters so they cannot occur in ordinary text:
 * mention E000, emoji E001, media E002, inline card E003, status E004,
 * date E005, unknown node E00F.
 */

export interface GoldenCase {
  readonly name: string;
  readonly adf: Readonly<Record<string, unknown>>;
  readonly expectedSegments: readonly string[];
}

export const GOLDEN_CASES: readonly GoldenCase[] = [
  {
    name: 'mention, hardBreak and ordinary text',
    adf: {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Patient reported ' },
            { type: 'mention', attrs: { id: 'acct-1', text: '@Old Name' } },
            { type: 'text', text: ' that the pump ' },
            { type: 'hardBreak' },
            { type: 'text', text: 'stopped unexpectedly.' },
          ],
        },
      ],
    },
    expectedSegments: ['Patient reported \uE000 that the pump stopped unexpectedly.'],
  },
  {
    name: 'volatile nodes become distinct placeholders',
    adf: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Device ' },
            { type: 'emoji', attrs: { shortName: ':smile:' } },
            { type: 'text', text: ' and ' },
            { type: 'mediaSingle', content: [{ type: 'media', attrs: { id: 'media-1' } }] },
            { type: 'text', text: ' shown ' },
            { type: 'inlineCard', attrs: { url: 'https://example.invalid/card' } },
            { type: 'text', text: ' status ' },
            { type: 'status', attrs: { text: 'OPEN' } },
            { type: 'text', text: ' date ' },
            { type: 'date', attrs: { timestamp: '2026-11-24' } },
          ],
        },
      ],
    },
    expectedSegments: ['Device \uE001 and \uE002 shown \uE003 status \uE004 date \uE005'],
  },
  {
    name: 'block boundaries, list items, code block and table cells',
    adf: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Summary line' }] },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First bullet' }] }],
            },
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second bullet' }] }],
            },
          ],
        },
        { type: 'codeBlock', content: [{ type: 'text', text: 'code   value' }] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell A' }] }],
                },
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell B' }] }],
                },
              ],
            },
          ],
        },
      ],
    },
    expectedSegments: [
      'Summary line',
      'First bullet',
      'Second bullet',
      'code value',
      'Cell A',
      'Cell B',
    ],
  },
  {
    name: 'Unicode NFC, whitespace collapse and trim',
    adf: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '  Cafe\u0301  was\n\n  examined\tagain.  ' }],
        },
      ],
    },
    expectedSegments: ['Café was examined again.'],
  },
  {
    name: 'unknown node becomes the unknown placeholder',
    adf: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Before ' },
            { type: 'futureNode' },
            { type: 'text', text: ' after' },
          ],
        },
      ],
    },
    expectedSegments: ['Before \uE00F after'],
  },
  {
    name: 'very long text is preserved intact',
    adf: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(1200) }] }],
    },
    expectedSegments: ['a'.repeat(1200)],
  },
];
