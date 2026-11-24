import { describe, expect, it, vi } from 'vitest';
import { createLogger, type LogSink } from '../src/services/logger';
import type { LogFields } from '../src/contracts/logging';

describe('P2.B2 structured logger with canary guard (IF-14, N-09, I-6)', () => {
  it('forwards only allowed fields to the sink', () => {
    const sink = vi.fn() as unknown as LogSink;
    const log = createLogger(sink);
    const fields: LogFields = { actionCode: 'MANUAL_SCAN', count: 3, durationMs: 12 };
    log.info(fields);
    expect(sink).toHaveBeenCalledWith('info', fields);
  });

  it('blocks a canary value and never reaches the sink', () => {
    const sink = vi.fn() as unknown as LogSink;
    const log = createLogger(sink);
    expect(() => log.error({ actionCode: 'canary-record-text-alpha-7f3a' })).toThrow('CANARY_LEAK');
    expect(sink).not.toHaveBeenCalled();
  });

  it('blocks an unknown field name before the sink', () => {
    const sink = vi.fn() as unknown as LogSink;
    const log = createLogger(sink);
    expect(() => log.warn({ summary: 'x' } as unknown as LogFields)).toThrow('CANARY_FIELD');
    expect(sink).not.toHaveBeenCalled();
  });

  it('keeps every level guarded', () => {
    const sink = vi.fn() as unknown as LogSink;
    const log = createLogger(sink);
    for (const level of ['info', 'warn', 'error'] as const) {
      expect(() => log[level]({ reasonCode: 'canary-quote-secret-bravo-91cd' })).toThrow(
        'CANARY_LEAK',
      );
    }
    expect(sink).not.toHaveBeenCalled();
  });
});
