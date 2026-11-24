/**
 * P6.A1 — pure trigger decision (C-01.8/10, N-01(e), Arch §7.2). It reads only
 * narrow routing metadata from the event: ids, project key, issue type and the
 * app marker on a comment. It never reads summary/description/comment text as
 * evidence and has no Jira, SQL, queue, clock or model dependency.
 */

import { SCAN_TRIGGERS, type ScanEventType, type ScanMessage } from '../contracts/scan';

export interface TriggerEvent {
  readonly issueId: string;
  readonly projectKey: string;
  readonly issueType: string;
  readonly eventType: ScanEventType;
  readonly entityId: string | null;
  readonly commentMarker?: string;
}

export interface TriggerConfig {
  readonly watchedProjects: readonly string[];
  readonly watchedIssueTypes: readonly string[];
  readonly markerPrefix: string;
  readonly debounceSeconds: number;
  readonly maxDebounceSeconds: number;
}

export type TriggerDecision =
  | { readonly kind: 'ENQUEUE'; readonly message: ScanMessage; readonly debounceSeconds: number }
  | { readonly kind: 'SKIP'; readonly reasonCode: 'SKIPPED_SCOPE' | 'SKIPPED_SELF' };

const BASE_KEYS = ['entityId', 'eventType', 'issueId', 'issueType', 'projectKey'] as const;
const ALL_KEYS = [...BASE_KEYS, 'commentMarker'] as const;

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/**
 * Extra event fields such as `summary` or `description` are rejected, not read.
 * The comment marker is metadata used only to skip app-written comments.
 */
export function parseTriggerEvent(raw: unknown): TriggerEvent | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const value = raw as Readonly<Record<string, unknown>>;
  const keys = Object.keys(value).sort();
  if (
    !keys.every((key) => (ALL_KEYS as readonly string[]).includes(key)) ||
    !BASE_KEYS.every((key) => keys.includes(key))
  ) {
    return null;
  }
  const { issueId, projectKey, issueType, eventType, entityId, commentMarker } = value;
  if (
    !nonEmpty(issueId) ||
    !nonEmpty(projectKey) ||
    !nonEmpty(issueType) ||
    !nonEmpty(eventType) ||
    !SCAN_TRIGGERS.includes(eventType as ScanEventType) ||
    (entityId !== null && !nonEmpty(entityId))
  ) {
    return null;
  }
  if (commentMarker !== undefined && typeof commentMarker !== 'string') return null;
  return {
    issueId,
    projectKey,
    issueType,
    eventType: eventType as ScanEventType,
    entityId,
    ...(commentMarker === undefined ? {} : { commentMarker }),
  };
}

/** The trigger itself has no side effects; the caller enqueues the returned message. */
export function decideTrigger(raw: unknown, config: TriggerConfig): TriggerDecision | null {
  const event = parseTriggerEvent(raw);
  if (event === null) return null;
  if (
    !config.watchedProjects.includes(event.projectKey) ||
    !config.watchedIssueTypes.includes(event.issueType)
  ) {
    return { kind: 'SKIP', reasonCode: 'SKIPPED_SCOPE' };
  }
  if (
    event.eventType === 'COMMENT_CREATED' &&
    event.commentMarker !== undefined &&
    event.commentMarker.startsWith(config.markerPrefix)
  ) {
    return { kind: 'SKIP', reasonCode: 'SKIPPED_SELF' };
  }
  const debounce = Math.max(0, Math.min(config.debounceSeconds, config.maxDebounceSeconds, 900));
  return {
    kind: 'ENQUEUE',
    message: {
      issueId: event.issueId,
      eventType: event.eventType,
      entityId: event.entityId,
      trigger: event.eventType,
    },
    debounceSeconds: debounce,
  };
}
