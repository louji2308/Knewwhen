import { describe, expect, it } from 'vitest';
import { writeCsv, type CsvComment, type CsvRow } from '../src/core/csv';

const row = (fields: readonly string[], comments: readonly CsvComment[] = []): CsvRow => ({
  fields,
  comments,
});

describe('P3.C1 hand-written CSV writer (C-08.4, Tools §4)', () => {
  it('quotes every field and doubles internal quotes', () => {
    const csv = writeCsv({
      header: ['Summary', 'Description'],
      rows: [row(['A "quoted" summary', ''])],
    });
    expect(csv).toBe('"Summary","Description"\r\n"A ""quoted"" summary",""\r\n');
  });

  it('emits one Comment column per comment as date;accountId;body', () => {
    const csv = writeCsv({
      header: ['Summary'],
      rows: [
        row(
          ['one'],
          [
            { date: '2026-11-05T09:12:00.000Z', accountId: 'acct-a', body: 'first note' },
            { date: '2026-11-07T11:00:00.000Z', accountId: 'acct-b', body: 'second; note' },
          ],
        ),
      ],
    });
    expect(csv).toBe(
      '"Summary","Comment","Comment"\r\n' +
        '"one","2026-11-05T09:12:00.000Z;acct-a;first note","2026-11-07T11:00:00.000Z;acct-b;second; note"\r\n',
    );
  });

  it('pads rows with fewer comments with empty quoted cells', () => {
    const csv = writeCsv({
      header: ['Summary'],
      rows: [
        row(
          ['two comments'],
          [
            { date: 'd1', accountId: 'a', body: 'x' },
            { date: 'd2', accountId: 'b', body: 'y' },
          ],
        ),
        row(['one comment'], [{ date: 'd3', accountId: 'c', body: 'z' }]),
        row(['no comments']),
      ],
    });
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe('"Summary","Comment","Comment"');
    expect(lines[2]).toBe('"one comment","d3;c;z",""');
    expect(lines[3]).toBe('"no comments","",""');
  });

  it('preserves newlines inside a quoted field without breaking rows', () => {
    const csv = writeCsv({ header: ['Summary'], rows: [row(['line one\nline two'])] });
    expect(csv).toBe('"Summary"\r\n"line one\nline two"\r\n');
  });

  it('is byte-identical for the same input and does not reorder comments', () => {
    const table = {
      header: ['Summary', 'Description'],
      rows: [row(['same', ''], [{ date: 'd1', accountId: 'a', body: 'b' }])],
    };
    expect(writeCsv(table)).toBe(writeCsv(table));
    const reordered = {
      ...table,
      rows: [
        row(
          ['same', ''],
          [
            { date: 'd2', accountId: 'b', body: 'c' },
            { date: 'd1', accountId: 'a', body: 'b' },
          ],
        ),
      ],
    };
    expect(writeCsv(reordered)).not.toBe(writeCsv(table));
  });

  it('preserves Unicode as written (normalisation is a separate, versioned step)', () => {
    const csv = writeCsv({ header: ['Summary'], rows: [row(['Café — 装置'])] });
    expect(csv).toContain('"Café — 装置"');
  });

  it('an empty table still writes its header row', () => {
    expect(writeCsv({ header: ['Summary'], rows: [] })).toBe('"Summary"\r\n');
  });

  it('rejects a row whose field count differs from the header', () => {
    expect(() =>
      writeCsv({ header: ['Summary', 'Description'], rows: [row(['only one'])] }),
    ).toThrow('CSV_FIELD_COUNT_MISMATCH');
  });
});
