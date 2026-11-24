import { describe, expect, it } from 'vitest';
import { decideTrigger, type TriggerConfig, type TriggerEvent } from '../src/handlers/trigger';

const config: TriggerConfig = {
  watchedProjects: ['KW'],
  watchedIssueTypes: ['Bug', 'Incident'],
  markerPrefix: 'knewwhen:',
  debounceSeconds: 30,
  maxDebounceSeconds: 900,
};

const event: TriggerEvent = {
  issueId: 'KW-100',
  projectKey: 'KW',
  issueType: 'Bug',
  eventType: 'ISSUE_CREATED',
  entityId: null,
};

describe('P6.A1 trigger purity and scope filter (C-01.8, C-01.10, N-01(e))', () => {
  it('enqueues the pinned message for a watched issue without any boundary call', () => {
    const decision = decideTrigger(event, config);
    expect(decision).toEqual({
      kind: 'ENQUEUE',
      message: {
        issueId: 'KW-100',
        eventType: 'ISSUE_CREATED',
        entityId: null,
        trigger: 'ISSUE_CREATED',
      },
      debounceSeconds: 30,
    });
  });

  it('skips unwatched projects and issue types with a reason code', () => {
    expect(decideTrigger({ ...event, projectKey: 'OTHER' }, config)).toEqual({
      kind: 'SKIP',
      reasonCode: 'SKIPPED_SCOPE',
    });
    expect(decideTrigger({ ...event, issueType: 'Task' }, config)).toEqual({
      kind: 'SKIP',
      reasonCode: 'SKIPPED_SCOPE',
    });
  });

  it('never scans a comment carrying the app marker', () => {
    const own = {
      ...event,
      eventType: 'COMMENT_CREATED' as const,
      entityId: 'comment-1',
      commentMarker: 'knewwhen:decision:case-1:v1',
    };
    expect(decideTrigger(own, config)).toEqual({ kind: 'SKIP', reasonCode: 'SKIPPED_SELF' });
    expect(decideTrigger({ ...own, commentMarker: 'ordinary text' }, config)).toEqual({
      kind: 'ENQUEUE',
      message: {
        issueId: 'KW-100',
        eventType: 'COMMENT_CREATED',
        entityId: 'comment-1',
        trigger: 'COMMENT_CREATED',
      },
      debounceSeconds: 30,
    });
  });

  it('caps debounce at 900 seconds and refuses unparseable payload text', () => {
    expect(decideTrigger(event, { ...config, debounceSeconds: 5000 })).toMatchObject({
      debounceSeconds: 900,
    });
    expect(
      decideTrigger({ ...event, summary: 'untrusted record text' } as never, config),
    ).toBeNull();
  });
});
