/**
 * P6/P7 — gated manual scan and write-back retry resolvers. The pure services
 * are injected; no live port means no handler, so the registry returns an
 * honest NOT_FOUND instead of a hidden demo path (I-11). Payloads carry only
 * an issue id or a limit: never record text, role claims or comment bodies.
 */

import type { Action } from '../contracts/authorisation';
import type { ResolverEnvelope } from '../contracts/envelope';
import type { GatedHandler } from './authorisation';

export interface OperationDependencies {
  readonly now: () => string;
  readonly manualScan?: (issueId: string) => Promise<unknown>;
  readonly retryWriteback?: (limit: number) => Promise<unknown>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function envelope<T>(
  data: T | null,
  role: string,
  code: ResolverEnvelope<T>['code'],
): ResolverEnvelope<T> {
  return {
    data,
    roleHint: role,
    correlationId: globalThis.crypto.randomUUID(),
    code,
  };
}

function issueIdFrom(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const keys = Object.keys(payload);
  if (keys.length !== 1 || keys[0] !== 'issueId') return null;
  const value = payload.issueId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function limitFrom(payload: unknown): number | null {
  if (payload === undefined) return 20;
  if (!isRecord(payload)) return null;
  const keys = Object.keys(payload);
  if (keys.length > 1 || (keys.length === 1 && keys[0] !== 'limit')) return null;
  const value = keys.length === 0 ? 20 : payload.limit;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100
    ? value
    : null;
}

/** Returns only the actions for which a live port was actually supplied. */
export function createOperationHandlers(
  deps: OperationDependencies,
): Partial<Record<Action, GatedHandler>> {
  const handlers: Partial<Record<Action, GatedHandler>> = {};
  if (deps.manualScan !== undefined) {
    handlers.MANUAL_SCAN = async (_context, decision, payload) => {
      const issueId = issueIdFrom(payload);
      if (issueId === null) return envelope(null, decision.role, 'INVALID_REQUEST');
      try {
        return envelope(await deps.manualScan?.(issueId), decision.role, 'OK');
      } catch {
        return envelope(null, decision.role, 'DEPENDENCY_FAILED');
      }
    };
  }
  if (deps.retryWriteback !== undefined) {
    handlers.RETRY_WRITEBACK = async (_context, decision, payload) => {
      const limit = limitFrom(payload);
      if (limit === null) return envelope(null, decision.role, 'INVALID_REQUEST');
      try {
        return envelope(await deps.retryWriteback?.(limit), decision.role, 'OK');
      } catch {
        return envelope(null, decision.role, 'DEPENDENCY_FAILED');
      }
    };
  }
  return handlers;
}
