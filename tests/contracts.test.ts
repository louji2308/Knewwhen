import { describe, expect, it } from 'vitest';
import { BUDGET_CLASSES, JIRA_ERROR_CLASSES, JIRA_WRITE_OPERATIONS } from '../src/contracts/jira';
import {
  ACTIONS,
  HANDLER_ACTIONS,
  ROLE_MATRIX,
  ROLES,
  type Action,
  type Role,
} from '../src/contracts/authorisation';
import { LOG_FIELD_ALLOWLIST } from '../src/contracts/logging';
import { ENVELOPE_ERROR_CODES } from '../src/contracts/envelope';

// Independent literals transcribed from Architecture §13.2/§13.3 and the
// approved plan §7 (IF-6/7/14/15) and §11 P2.B1. These are the authority for
// the tests; the contract modules under test must match them exactly.
const EXPECTED_WRITES = [
  'SET_ISSUE_PROPERTY',
  'SET_COMMENT_PROPERTY',
  'ADD_COMMENT',
  'ADD_LABEL',
  'CREATE_ISSUE',
];

const EXPECTED_BUDGET = ['panel', 'lookback', 'scan', 'sweep', 'writeback'];

const EXPECTED_ERROR_CLASSES = ['transient', 'permanent', 'auth'];

const EXPECTED_ROLES = ['VIEWER', 'REVIEWER', 'QUALIFIED_PERSON', 'SITE_ADMIN'];

const EXPECTED_ACTIONS = [
  'SEE_SIGNAL',
  'ROUTE_TO_COMPLAINT_UNIT',
  'MANUAL_SCAN',
  'VIEW_CASE',
  'RUN_LOOKBACK',
  'ENTER_RECEIPT_DATE',
  'CONFIRM_SAME_EVENT',
  'CONFIRM_TRAIL_ENTRY',
  'COMPUTE_DEADLINES',
  'DECIDE',
  'RETRY_WRITEBACK',
  'ADMIN_SETTINGS',
];

// Architecture §13.3 role matrix, transcribed cell by cell.
const EXPECTED_MATRIX: Record<Action, readonly Role[]> = {
  SEE_SIGNAL: ['VIEWER', 'REVIEWER', 'QUALIFIED_PERSON', 'SITE_ADMIN'],
  ROUTE_TO_COMPLAINT_UNIT: ['VIEWER', 'REVIEWER', 'QUALIFIED_PERSON', 'SITE_ADMIN'],
  MANUAL_SCAN: ['REVIEWER', 'QUALIFIED_PERSON'],
  VIEW_CASE: ['REVIEWER', 'QUALIFIED_PERSON'],
  RUN_LOOKBACK: ['REVIEWER', 'QUALIFIED_PERSON'],
  ENTER_RECEIPT_DATE: ['REVIEWER', 'QUALIFIED_PERSON'],
  CONFIRM_SAME_EVENT: ['QUALIFIED_PERSON'],
  CONFIRM_TRAIL_ENTRY: ['QUALIFIED_PERSON'],
  COMPUTE_DEADLINES: ['REVIEWER', 'QUALIFIED_PERSON'],
  DECIDE: ['QUALIFIED_PERSON'],
  RETRY_WRITEBACK: ['REVIEWER', 'QUALIFIED_PERSON'],
  ADMIN_SETTINGS: ['SITE_ADMIN'],
};

const EXPECTED_LOG_FIELDS = [
  'correlationId',
  'actorType',
  'actionCode',
  'errorCode',
  'reasonCode',
  'entityType',
  'entityId',
  'count',
  'durationMs',
];

const EXPECTED_ENVELOPE_ERRORS = [
  'OK',
  'NOT_PERMITTED',
  'INVALID_REQUEST',
  'DEPENDENCY_FAILED',
  'RATE_LIMITED',
  'NOT_FOUND',
];

describe('P2.D2 pinned contracts (IF-6, IF-7, IF-14, IF-15; Arch §12/§13)', () => {
  it('IF-6 exposes exactly the five approved Jira writes (C-07.10)', () => {
    expect([...JIRA_WRITE_OPERATIONS]).toEqual(EXPECTED_WRITES);
    expect(JIRA_WRITE_OPERATIONS).toHaveLength(5);
    expect(JIRA_WRITE_OPERATIONS).not.toContain('DELETE_ISSUE');
    expect(JIRA_WRITE_OPERATIONS).not.toContain('TRANSITION_ISSUE');
  });

  it('IF-6 pins exactly the five budget classes and three error classes (N-01)', () => {
    expect([...BUDGET_CLASSES]).toEqual(EXPECTED_BUDGET);
    expect([...JIRA_ERROR_CLASSES]).toEqual(EXPECTED_ERROR_CLASSES);
  });

  it('IF-7 pins the four roles and all twelve matrix actions (G-4)', () => {
    expect([...ROLES]).toEqual(EXPECTED_ROLES);
    expect([...ACTIONS]).toEqual(EXPECTED_ACTIONS);
  });

  it('IF-7 role matrix matches Architecture §13.3 cell by cell', () => {
    for (const action of EXPECTED_ACTIONS) {
      expect([...ROLE_MATRIX[action as Action]]).toEqual(EXPECTED_MATRIX[action as Action]);
    }
  });

  it('IF-7 handler registry list equals the role matrix actions (deny by default)', () => {
    expect([...HANDLER_ACTIONS].sort()).toEqual([...ACTIONS].sort());
  });

  it('IF-14 logger allow-list carries only ids, codes, counts and durations (I-6)', () => {
    expect([...LOG_FIELD_ALLOWLIST].sort()).toEqual([...EXPECTED_LOG_FIELDS].sort());
    for (const banned of ['text', 'body', 'quote', 'summary', 'description', 'comment']) {
      expect(LOG_FIELD_ALLOWLIST).not.toContain(banned);
    }
  });

  it('IF-15 envelope pins typed error codes (G-8)', () => {
    expect([...ENVELOPE_ERROR_CODES]).toEqual(EXPECTED_ENVELOPE_ERRORS);
  });
});
