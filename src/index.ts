import { runSchemaMigration } from './adapters/forge-sql';
import { resolverHandler } from './adapters/forge-resolver';
import { noop, type NoopResult } from './handlers/noop';
import { runScheduled, type ScheduledOutcome } from './handlers/scheduled';

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

/**
 * Daily scheduled trigger. Migration always runs first; the reconciler is not
 * injected until its SQL/KVS ports are approved, so the deployed job reports
 * `reconciler: null` rather than inventing a sweep (P10.B2, N-01(c)).
 */
export function scheduled(): Promise<ScheduledOutcome> {
  return runScheduled(runSchemaMigration);
}
