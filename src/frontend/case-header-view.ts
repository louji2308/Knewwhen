/**
 * P10.B1 — pure case header view model (Arch §3, C-09.1–6, WF-9/10, G-8).
 * Next step is the first match in the fixed Workflow §7.3 table; colour and
 * gut feeling play no part. Role views follow Workflow §7.2: the role hint is
 * advisory presentation input only, never an authority (I-4/I-5). The model
 * carries fixed codes, strings, ids and counts — no quote or record text.
 */

import type { ResolverEnvelope } from '../contracts/envelope';
import { decisionViewModel } from './decision-view';
import { lookbackViewModel } from './lookback-view';
import { scanViewModel } from './scan-view';

export const CASE_HEADER_UI_STRINGS = Object.freeze({
  title: 'Case',
  notice: 'Decision support, not a regulatory determination or legal advice.',
  nudgeRoute: 'This issue shows a possible signal. Route it to the complaint unit.',
  restricted:
    'You are a Jira admin. Case work needs the Reviewer or Qualified person role (KnewWhen admin page → Settings).',
  roleViews: Object.freeze({
    NUDGE_ROUTE: 'Nudge and route only',
    CASE_ACTIONS: 'Case actions',
    DECISIONS: 'Case actions and decisions',
    RESTRICTED: 'No case authority',
  }),
  chips: Object.freeze({
    aiOn: 'AI screening: on',
    aiOff: 'AI screening: off',
    ruleSet: 'Rule set {id} v{version} · {status}',
    reviewed: 'Reviewed',
    preview: 'Preview',
    notReviewed: 'Not reviewed',
  }),
  banners: Object.freeze({
    newInfo: 'New information since final decision v{n}',
    newInfoNoVersion: 'New information since final decision',
    evidenceChanged: 'Evidence changed in {n} cited records',
    aiUnavailable: 'AI screening unavailable, rule-based screening used',
    searchIncomplete: 'Search incomplete. Other records may exist.',
  }),
  nextSteps: Object.freeze({
    waitForScan: 'Wait for the background scan or scan now',
    searchEarlier: 'Search earlier records',
    answerSameEvent: "A qualified person answers 'Same event?' for {n} records",
    confirmTrail: 'A qualified person confirms or rejects {n} trail entries',
    calculate: 'Calculate deadlines',
    recordDecision: 'Record the decision',
    finishDraft: 'Finish and finalise the draft',
    checkWriteback: 'Check the Jira write-back',
    reviewNewInfo: 'Review the new information',
  }),
  tabs: Object.freeze({
    THIS_ISSUE: 'This issue',
    EARLIER_RECORDS: 'Earlier records',
    AWARENESS_DEADLINES: 'Awareness & deadlines',
    DECISION: 'Decision',
  }),
  roleView: 'Access',
  chipsLabel: 'Status',
  bannersLabel: 'Notices',
  nextStepLabel: 'Next step',
  actionsLabel: 'Available actions',
  noNextStep: 'No further step is needed.',
});

export type RoleView = 'NUDGE_ROUTE' | 'CASE_ACTIONS' | 'DECISIONS' | 'RESTRICTED';
export type CaseHeaderState = 'FLAGGED' | 'IN_REVIEW' | 'DECIDED' | '';
export type DecisionState = 'NONE' | 'DRAFT' | 'FINAL';
export type WritebackState = '' | 'PENDING' | 'DONE' | 'FAILED';
export type RuleSetState = 'REVIEWED' | 'PREVIEW' | 'UNREVIEWED';

export interface CaseHeaderInput {
  readonly roleHint: string;
  readonly caseView: ResolverEnvelope<unknown> | null;
  readonly scan: ResolverEnvelope<unknown> | null;
  readonly lookback: ResolverEnvelope<unknown> | null;
  readonly decision: ResolverEnvelope<unknown> | null;
  readonly writeback: ResolverEnvelope<unknown> | null;
}

/** Fixed presentation flags: no raw envelope data survives into the model. */
export interface CaseHeaderFlags {
  readonly casePresent: boolean;
  readonly waitingForScan: boolean;
  readonly caseState: CaseHeaderState;
  readonly lookbackRun: boolean;
  readonly awaitingCandidateCount: number;
  readonly proposedEntryCount: number;
  readonly confirmedEntryCount: number;
  readonly currentCalculation: boolean;
  readonly decisionState: DecisionState;
  readonly writebackState: WritebackState;
  readonly newInfoSinceFinal: boolean;
  readonly decisionVersion: number;
  readonly evidenceChangedCount: number;
  readonly aiUnavailable: boolean;
  readonly searchIncomplete: boolean;
  readonly aiScreeningEnabled: boolean;
  readonly ruleSetId: string;
  readonly ruleSetVersion: string;
  readonly ruleSetStatus: RuleSetState;
}

export interface CaseHeaderChip {
  readonly code: string;
  readonly text: string;
}

export interface CaseHeaderBanner {
  readonly code: string;
  readonly text: string;
}

export interface NextStep {
  readonly code: string;
  readonly text: string;
  readonly tab: string;
}

export interface CaseHeaderViewModel extends CaseHeaderFlags {
  readonly roleView: RoleView;
  readonly canShowCaseHeader: boolean;
  readonly message: string;
  readonly caseId: string;
  readonly chips: readonly CaseHeaderChip[];
  readonly banners: readonly CaseHeaderBanner[];
  readonly actions: readonly string[];
  readonly nextStep: NextStep | null;
}

type Data = Readonly<Record<string, unknown>>;

const CASE_STATES = Object.freeze(['FLAGGED', 'IN_REVIEW', 'DECIDED'] as const);
const WRITEBACK_STATES = Object.freeze(['PENDING', 'DONE', 'FAILED'] as const);
const RULE_STATES = Object.freeze(['REVIEWED', 'PREVIEW', 'UNREVIEWED'] as const);
const AI_UNAVAILABLE_CODES = Object.freeze([
  'LLM_UNAVAILABLE',
  'LLM_BLOCKED',
  'LLM_DEFERRED',
  'BREAKER_OPEN',
  'HASH_KEY_MISSING',
  'MODEL_ERROR',
] as const);
const SAFE_ID = /^[A-Za-z][A-Za-z0-9_.-]{0,31}$/u;
const SAFE_VERSION = /^[A-Za-z0-9._:-]{1,32}$/u;
const REVIEWER_ACTIONS = Object.freeze([
  'MANUAL_SCAN',
  'OPEN_CASE',
  'RUN_LOOKBACK',
  'ENTER_RECEIPT_DATE',
  'COMPUTE_DEADLINES',
  'RETRY_WRITEBACK',
] as const);
const QP_ACTIONS = Object.freeze([
  ...REVIEWER_ACTIONS,
  'CONFIRM_SAME_EVENT',
  'CONFIRM_TRAIL_ENTRY',
  'DECIDE',
] as const);

const record = (value: unknown): Data | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Data) : null;

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function safeCode(value: unknown, pattern: RegExp): string {
  return typeof value === 'string' && pattern.test(value) ? value : '';
}

function fill(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{([a-zA-Z]+)\}/gu, (_match: string, key: string) => {
    const value = values[key];
    return value === undefined ? '' : String(value);
  });
}

function roleViewFor(roleHint: string): RoleView {
  if (roleHint === 'QUALIFIED_PERSON') return 'DECISIONS';
  if (roleHint === 'REVIEWER') return 'CASE_ACTIONS';
  if (roleHint === 'VIEWER') return 'NUDGE_ROUTE';
  return 'RESTRICTED';
}

function emptyFlags(): CaseHeaderFlags {
  return {
    casePresent: false,
    waitingForScan: false,
    caseState: '',
    lookbackRun: false,
    awaitingCandidateCount: 0,
    proposedEntryCount: 0,
    confirmedEntryCount: 0,
    currentCalculation: false,
    decisionState: 'NONE',
    writebackState: '',
    newInfoSinceFinal: false,
    decisionVersion: 0,
    evidenceChangedCount: 0,
    aiUnavailable: false,
    searchIncomplete: false,
    aiScreeningEnabled: false,
    ruleSetId: '',
    ruleSetVersion: '',
    ruleSetStatus: 'UNREVIEWED',
  };
}

function deriveFlags(input: CaseHeaderInput): {
  readonly flags: CaseHeaderFlags;
  readonly caseId: string;
} {
  const caseData =
    input.caseView !== null && input.caseView.code === 'OK' ? record(input.caseView.data) : null;
  const caseId = safeCode(caseData?.['caseId'], SAFE_ID);
  const rawState = typeof caseData?.['state'] === 'string' ? caseData['state'] : '';
  const caseState = CASE_STATES.includes(rawState as (typeof CASE_STATES)[number])
    ? (rawState as CaseHeaderState)
    : '';
  const rawRuleStatus =
    typeof caseData?.['ruleSetStatus'] === 'string' ? caseData['ruleSetStatus'] : '';
  const ruleSetStatus = RULE_STATES.includes(rawRuleStatus as (typeof RULE_STATES)[number])
    ? (rawRuleStatus as RuleSetState)
    : 'UNREVIEWED';
  const rawWriteback = record(input.writeback?.data ?? null);
  const rawWritebackState =
    typeof rawWriteback?.['status'] === 'string' ? rawWriteback['status'] : '';
  const writebackState = WRITEBACK_STATES.includes(
    rawWritebackState as (typeof WRITEBACK_STATES)[number],
  )
    ? (rawWritebackState as WritebackState)
    : '';
  const scan = scanViewModel(input.scan);
  const lookback = lookbackViewModel(input.lookback);
  const decision = decisionViewModel(input.decision);
  const decisionState: DecisionState =
    decision.kind === 'FINAL' ? 'FINAL' : decision.kind === 'DRAFT' ? 'DRAFT' : 'NONE';
  const reasonCode = scan.reasonCode;
  return {
    caseId,
    flags: {
      casePresent: caseId !== '',
      waitingForScan:
        caseData?.['waitingForScan'] === true ||
        scan.kind === 'IDLE' ||
        scan.state === 'QUEUED' ||
        scan.state === 'RUNNING',
      caseState,
      lookbackRun:
        lookback.kind === 'RESULT' || lookback.kind === 'SEGMENTS' || lookback.kind === 'DECISION',
      awaitingCandidateCount: count(caseData?.['awaitingCandidateCount']),
      proposedEntryCount: count(caseData?.['proposedEntryCount']),
      confirmedEntryCount: count(caseData?.['confirmedEntryCount']),
      currentCalculation: caseData?.['currentCalculation'] === true,
      decisionState,
      writebackState,
      newInfoSinceFinal: caseData?.['newInfoSinceFinal'] === true,
      decisionVersion: count(caseData?.['decisionVersion']),
      evidenceChangedCount: count(caseData?.['evidenceChangedCount']),
      aiUnavailable: AI_UNAVAILABLE_CODES.some((code) => code === reasonCode),
      searchIncomplete: 'incomplete' in lookback && lookback.incomplete === true,
      aiScreeningEnabled: caseData?.['aiScreeningEnabled'] === true,
      ruleSetId: safeCode(caseData?.['ruleSetId'], SAFE_ID),
      ruleSetVersion: safeCode(caseData?.['ruleSetVersion'], SAFE_VERSION),
      ruleSetStatus,
    },
  };
}

/** The first matching row of Workflow §7.3 wins; no row names an outcome. */
export function nextStep(flags: CaseHeaderFlags): NextStep | null {
  const s = CASE_HEADER_UI_STRINGS;
  const step = (code: string, text: string, tab: string): NextStep => ({ code, text, tab });
  if (!flags.casePresent || flags.waitingForScan) {
    return step('WAIT_FOR_SCAN', s.nextSteps.waitForScan, 'THIS_ISSUE');
  }
  if (flags.caseState === 'FLAGGED' && !flags.lookbackRun) {
    return step('SEARCH_EARLIER_RECORDS', s.nextSteps.searchEarlier, 'EARLIER_RECORDS');
  }
  if (flags.awaitingCandidateCount > 0) {
    return step(
      'ANSWER_SAME_EVENT',
      fill(s.nextSteps.answerSameEvent, { n: flags.awaitingCandidateCount }),
      'EARLIER_RECORDS',
    );
  }
  if (flags.proposedEntryCount > 0) {
    return step(
      'CONFIRM_TRAIL',
      fill(s.nextSteps.confirmTrail, { n: flags.proposedEntryCount }),
      'AWARENESS_DEADLINES',
    );
  }
  if (flags.confirmedEntryCount > 0 && !flags.currentCalculation) {
    return step('CALCULATE_DEADLINES', s.nextSteps.calculate, 'AWARENESS_DEADLINES');
  }
  if (flags.currentCalculation && flags.decisionState === 'NONE') {
    return step('RECORD_DECISION', s.nextSteps.recordDecision, 'DECISION');
  }
  if (flags.decisionState === 'DRAFT') {
    return step('FINISH_DRAFT', s.nextSteps.finishDraft, 'DECISION');
  }
  if (
    flags.decisionState === 'FINAL' &&
    (flags.writebackState === 'PENDING' || flags.writebackState === 'FAILED')
  ) {
    return step('CHECK_WRITEBACK', s.nextSteps.checkWriteback, 'DECISION');
  }
  if (flags.decisionState === 'FINAL' && flags.newInfoSinceFinal) {
    return step('REVIEW_NEW_INFO', s.nextSteps.reviewNewInfo, 'AWARENESS_DEADLINES');
  }
  return null;
}

function chipsFor(flags: CaseHeaderFlags): readonly CaseHeaderChip[] {
  const s = CASE_HEADER_UI_STRINGS;
  const statusLabel =
    flags.ruleSetStatus === 'REVIEWED'
      ? s.chips.reviewed
      : flags.ruleSetStatus === 'PREVIEW'
        ? s.chips.preview
        : s.chips.notReviewed;
  const statusCode =
    flags.ruleSetStatus === 'REVIEWED'
      ? 'RULE_SET_REVIEWED'
      : flags.ruleSetStatus === 'PREVIEW'
        ? 'RULE_SET_PREVIEW'
        : 'RULE_SET_NOT_REVIEWED';
  return [
    {
      code: flags.aiScreeningEnabled ? 'AI_SCREENING_ON' : 'AI_SCREENING_OFF',
      text: flags.aiScreeningEnabled ? s.chips.aiOn : s.chips.aiOff,
    },
    {
      code: statusCode,
      text: fill(s.chips.ruleSet, {
        id: flags.ruleSetId || '-',
        version: flags.ruleSetVersion || '-',
        status: statusLabel,
      }),
    },
  ];
}

function bannersFor(flags: CaseHeaderFlags): readonly CaseHeaderBanner[] {
  const s = CASE_HEADER_UI_STRINGS;
  const banners: CaseHeaderBanner[] = [];
  if (flags.newInfoSinceFinal && flags.caseState === 'DECIDED' && flags.decisionState === 'FINAL') {
    banners.push({
      code: 'NEW_INFO_SINCE_FINAL',
      text:
        flags.decisionVersion > 0
          ? fill(s.banners.newInfo, { n: flags.decisionVersion })
          : s.banners.newInfoNoVersion,
    });
  }
  if (flags.evidenceChangedCount > 0) {
    banners.push({
      code: 'EVIDENCE_CHANGED',
      text: fill(s.banners.evidenceChanged, { n: flags.evidenceChangedCount }),
    });
  }
  if (flags.aiUnavailable) {
    banners.push({
      code: 'AI_SCREENING_UNAVAILABLE',
      text: s.banners.aiUnavailable,
    });
  }
  if (flags.searchIncomplete) {
    banners.push({ code: 'SEARCH_INCOMPLETE', text: s.banners.searchIncomplete });
  }
  return banners;
}

/** Translate the six inputs into a role-scoped header model. */
export function caseHeaderViewModel(input: CaseHeaderInput): CaseHeaderViewModel {
  const roleView = roleViewFor(input.roleHint);
  const canShowCaseHeader = roleView === 'CASE_ACTIONS' || roleView === 'DECISIONS';
  const derived = deriveFlags(input);
  if (!canShowCaseHeader) {
    return {
      ...emptyFlags(),
      roleView,
      canShowCaseHeader: false,
      message:
        roleView === 'NUDGE_ROUTE'
          ? CASE_HEADER_UI_STRINGS.nudgeRoute
          : CASE_HEADER_UI_STRINGS.restricted,
      caseId: '',
      chips: [],
      banners: [],
      actions: [],
      nextStep: null,
    };
  }
  return {
    ...derived.flags,
    roleView,
    canShowCaseHeader: true,
    message: CASE_HEADER_UI_STRINGS.notice,
    caseId: derived.caseId,
    chips: chipsFor(derived.flags),
    banners: bannersFor(derived.flags),
    actions: roleView === 'DECISIONS' ? [...QP_ACTIONS] : [...REVIEWER_ACTIONS],
    nextStep: nextStep(derived.flags),
  };
}
