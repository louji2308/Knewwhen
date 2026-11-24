/**
 * P1.B2 — no-op background handlers. They acknowledge delivery with a code and
 * a task label. Event bodies are ignored: no record text, ids or model I/O.
 */

export type NoopTask = 'trigger' | 'scan' | 'writeback' | 'scheduled';

export interface NoopResult {
  readonly status: 'noop';
  readonly task: NoopTask;
}

export function noop(task: NoopTask, _event?: unknown): NoopResult {
  return { status: 'noop', task };
}
