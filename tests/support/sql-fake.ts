/**
 * P2.A2 in-memory SQL fake, built from the Verified facts in docs/platform-facts.md
 * (PF-DB-1/2/3/4/5) and the frozen Arch §5.3 keys — not from assumptions.
 * It accepts the same parameterised SQL strings as the real driver so the
 * semantics the plan relies on can be checked locally. It is test-only and
 * contains no @forge/* import.
 *
 * Live validation against the demo-site database remains Unresolved (PF-SQL-2);
 * passing here is necessary but not sufficient for that acceptance step.
 */

import {
  CORE_TABLE_KEYS,
  CORE_TABLE_NAMES,
  type CoreTable,
  type SqlPort,
  type SqlResponse,
  type SqlRow,
  type SqlStatement,
  type SqlValue,
  type TableKeys,
} from '../../src/services/sql';

type Kind = 'insert' | 'select' | 'update' | 'delete';
interface Predicate {
  readonly column: string;
  readonly op: 'eq' | 'null';
}
interface Parsed {
  readonly kind: Kind;
  readonly table: CoreTable;
  readonly columns: readonly string[];
  readonly assignments: readonly string[];
  readonly predicates: readonly Predicate[];
  readonly placeholders: number;
}

const TABLES: ReadonlySet<string> = new Set<string>(CORE_TABLE_NAMES);
const IDENTIFIER = /^[a-z][a-z0-9_]*$/;

function parsePredicates(text: string): readonly Predicate[] {
  return text.split(' AND ').map((part) => {
    const eq = /^([a-z][a-z0-9_]*) = \?$/.exec(part.trim());
    if (eq) return { column: eq[1]!, op: 'eq' } as const;
    const nul = /^([a-z][a-z0-9_]*) IS NULL$/.exec(part.trim());
    if (nul) return { column: nul[1]!, op: 'null' } as const;
    throw new Error('SQL_UNSUPPORTED_PREDICATE');
  });
}

function parse(sql: string): Parsed {
  const single = sql.trim().replace(/;$/, '');
  if (single.includes(';')) throw new Error('SQL_MULTI_STATEMENT');

  const insert = /^INSERT INTO ([a-z_]+) \(([^)]+)\) VALUES \((.+)\)$/.exec(single);
  if (insert) {
    const columns = insert[2]!.split(',').map((c) => c.trim());
    if (columns.some((c) => !IDENTIFIER.test(c))) throw new Error('SQL_IDENTIFIER');
    return {
      kind: 'insert',
      table: table(insert[1]!),
      columns,
      assignments: [],
      predicates: [],
      placeholders: columns.length,
    };
  }

  const select = /^SELECT \* FROM ([a-z_]+)(?: WHERE (.+))?$/.exec(single);
  if (select) {
    const predicates = select[2] ? parsePredicates(select[2]) : [];
    return {
      kind: 'select',
      table: table(select[1]!),
      columns: [],
      assignments: [],
      predicates,
      placeholders: predicates.filter((p) => p.op === 'eq').length,
    };
  }

  const update = /^UPDATE ([a-z_]+) SET (.+) WHERE (.+)$/.exec(single);
  if (update) {
    const assignments = update[2]!.split(',').map((part) => {
      const match = /^([a-z][a-z0-9_]*) = \?$/.exec(part.trim());
      if (!match) throw new Error('SQL_UNSUPPORTED_ASSIGNMENT');
      return match[1]!;
    });
    const predicates = parsePredicates(update[3]!);
    return {
      kind: 'update',
      table: table(update[1]!),
      columns: [],
      assignments,
      predicates,
      placeholders: assignments.length + predicates.filter((p) => p.op === 'eq').length,
    };
  }

  const remove = /^DELETE FROM ([a-z_]+) WHERE (.+)$/.exec(single);
  if (remove) {
    const predicates = parsePredicates(remove[2]!);
    return {
      kind: 'delete',
      table: table(remove[1]!),
      columns: [],
      assignments: [],
      predicates,
      placeholders: predicates.filter((p) => p.op === 'eq').length,
    };
  }
  throw new Error('SQL_UNSUPPORTED_QUERY');
}

function table(name: string): CoreTable {
  if (!TABLES.has(name)) throw new Error('SQL_UNKNOWN_TABLE');
  return name as CoreTable;
}

function matches(
  row: SqlRow,
  predicates: readonly Predicate[],
  values: readonly SqlValue[],
  offset = 0,
): boolean {
  let index = offset;
  for (const predicate of predicates) {
    const actual = row[predicate.column] ?? null;
    if (predicate.op === 'null') {
      if (actual !== null) return false;
    } else if (actual !== values[index]) {
      return false;
    }
    index += predicate.op === 'eq' ? 1 : 0;
  }
  return true;
}

function duplicate(rows: readonly SqlRow[], row: SqlRow, keys: TableKeys): boolean {
  const groups: readonly (readonly string[])[] = [keys.primary, ...keys.unique];
  return groups.some((group) =>
    rows.some((existing) => group.every((column) => existing[column] === row[column])),
  );
}

export interface SqlFake extends SqlPort {
  dump(table: CoreTable): readonly SqlRow[];
}

export function createSqlFake(): SqlFake {
  const store = new Map<CoreTable, SqlRow[]>(CORE_TABLE_NAMES.map((name) => [name, []]));

  return {
    prepare(query: string): SqlStatement {
      const parsed = parse(query);
      let values: readonly SqlValue[] = [];
      const statement: SqlStatement = {
        bindParams(...bound: SqlValue[]): SqlStatement {
          values = bound;
          return statement;
        },
        async execute(): Promise<SqlResponse> {
          if (values.length !== parsed.placeholders) throw new Error('SQL_PARAM_COUNT');
          const rows = store.get(parsed.table)!;
          if (parsed.kind === 'insert') {
            const row: Record<string, SqlValue> = {};
            parsed.columns.forEach((column, index) => {
              row[column] = values[index] ?? null;
            });
            if (duplicate(rows, row, CORE_TABLE_KEYS[parsed.table])) {
              throw new Error('SQL_DUPLICATE_KEY');
            }
            rows.push(row);
            return { rows: [], affectedRows: 1 };
          }
          if (parsed.kind === 'select') {
            return {
              rows: rows
                .filter((row) => matches(row, parsed.predicates, values))
                .map((row) => ({ ...row })),
              affectedRows: 0,
            };
          }
          const selected = rows.filter((row) =>
            matches(
              row,
              parsed.predicates,
              values,
              parsed.kind === 'update' ? parsed.assignments.length : 0,
            ),
          );
          if (parsed.kind === 'update') {
            for (const row of selected) {
              parsed.assignments.forEach((column, index) => {
                (row as Record<string, SqlValue>)[column] = values[index] ?? null;
              });
            }
            return { rows: [], affectedRows: selected.length };
          }
          for (const row of selected) rows.splice(rows.indexOf(row), 1);
          return { rows: [], affectedRows: selected.length };
        },
      };
      return statement;
    },
    dump(table: CoreTable): readonly SqlRow[] {
      return store.get(table)!.map((row) => ({ ...row }));
    },
  };
}
