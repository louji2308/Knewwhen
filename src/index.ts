import { runSchemaMigration } from './adapters/forge-sql';
import { resolverHandler } from './adapters/forge-resolver';
import { noop, type NoopResult } from './handlers/noop';
import type { MigrationOutcome } from './handlers/migration';

/** Manifest function handlers: index.resolver, index.trigger, index.scanConsumer,
 * index.writebackConsumer and index.scheduled (P1.B2, Arch §3.2). */

export const resolver = resolverHandler;

export function trigger(_event: unknown): NoopResult {
  return noop('trigger');
}

export function scanConsumer(_event: unknown): NoopResult {
  return noop('scan');
}

export function writebackConsumer(_event: unknown): NoopResult {
  return noop('writeback');
}

/** Daily scheduled trigger: official empty migration runner (P1.B2). */
export async function scheduled(): Promise<MigrationOutcome> {
  return runSchemaMigration();
}
