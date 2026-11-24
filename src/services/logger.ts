/**
 * P2.B2 — structured logger (IF-14). Every log call passes through the canary
 * field/value guard before it reaches a sink, so a record text, quote or model
 * I/O leak fails closed instead of being written (I-6). The sink is injected;
 * this module imports no Forge package.
 */

import { assertSafeFields } from '../contracts/canary';
import type { LogFields, StructuredLogger } from '../contracts/logging';

export type LogSink = (level: 'info' | 'warn' | 'error', fields: LogFields) => void;

export function createLogger(sink: LogSink): StructuredLogger {
  const write =
    (level: 'info' | 'warn' | 'error') =>
    (fields: LogFields): void => {
      assertSafeFields(fields);
      sink(level, fields);
    };
  return { info: write('info'), warn: write('warn'), error: write('error') };
}
