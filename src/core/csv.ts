/**
 * P3.C1 — hand-written CSV writer (C-08.4, Tools §4: no CSV library).
 * Every field is quoted; one `Comment` column is emitted per comment in the
 * form `date;accountId;body`. Rows are never reordered, so the same input is
 * byte-identical on every run. Pure core: no @forge/* import.
 */

export interface CsvComment {
  readonly date: string;
  readonly accountId: string;
  readonly body: string;
}

export interface CsvRow {
  readonly fields: readonly string[];
  readonly comments: readonly CsvComment[];
}

export interface CsvTable {
  readonly header: readonly string[];
  readonly rows: readonly CsvRow[];
}

const quote = (value: string): string => `"${value.replace(/"/gu, '""')}"`;

export function writeCsv(table: CsvTable): string {
  for (const row of table.rows) {
    if (row.fields.length !== table.header.length) throw new Error('CSV_FIELD_COUNT_MISMATCH');
  }

  const maxComments = table.rows.reduce(
    (maximum, row) => Math.max(maximum, row.comments.length),
    0,
  );
  const header = [...table.header, ...Array.from({ length: maxComments }, () => 'Comment')];
  const lines = [header.map(quote).join(',')];

  for (const row of table.rows) {
    const commentCells = row.comments.map(
      (comment) => `${comment.date};${comment.accountId};${comment.body}`,
    );
    const padding = Array.from({ length: maxComments - row.comments.length }, () => '');
    lines.push([...row.fields, ...commentCells, ...padding].map(quote).join(','));
  }

  return `${lines.join('\r\n')}\r\n`;
}
