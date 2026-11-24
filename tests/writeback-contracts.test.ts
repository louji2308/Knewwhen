import { describe, expect, it } from 'vitest';
import {
  parseWritebackTask,
  WRITEBACK_TASK_KINDS,
  WRITEBACK_TASK_STATUSES,
} from '../src/contracts/writeback';

describe('P7.0 IF-12 write-back outbox contract (Arch §11.3)', () => {
  it('freezes the four task kinds and three statuses', () => {
    expect([...WRITEBACK_TASK_KINDS]).toEqual([
      'SIGNAL_FLAG',
      'PROPERTY',
      'SUMMARY_COMMENT',
      'REMINDER',
    ]);
    expect([...WRITEBACK_TASK_STATUSES]).toEqual(['PENDING', 'DONE', 'FAILED']);
  });

  it('parses a task without interpolating a body or rationale', () => {
    expect(
      parseWritebackTask({
        id: 'task-1',
        caseId: 'case-1',
        kind: 'SUMMARY_COMMENT',
        dedupeKey: 'case-1:v1',
        status: 'PENDING',
        attempts: 0,
        lastErrorCode: null,
        commentId: null,
      }),
    ).toEqual({
      id: 'task-1',
      caseId: 'case-1',
      kind: 'SUMMARY_COMMENT',
      dedupeKey: 'case-1:v1',
      status: 'PENDING',
      attempts: 0,
      lastErrorCode: null,
      commentId: null,
    });
  });

  it('rejects unknown kinds, invalid attempts and extra fields', () => {
    const base = {
      id: 'task-1',
      caseId: 'case-1',
      kind: 'PROPERTY',
      dedupeKey: 'case-1:property',
      status: 'PENDING',
      attempts: 0,
      lastErrorCode: null,
      commentId: null,
    };
    expect(parseWritebackTask({ ...base, kind: 'DELETE' })).toBeNull();
    expect(parseWritebackTask({ ...base, attempts: -1 })).toBeNull();
    expect(parseWritebackTask({ ...base, body: 'anything' })).toBeNull();
    expect(parseWritebackTask(undefined)).toBeNull();
  });
});
