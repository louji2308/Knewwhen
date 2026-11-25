import React, { useEffect, useRef, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  DatePicker,
  DynamicTable,
  Modal,
  ModalBody,
  ModalFooter,
  RadioGroup,
  SectionMessage,
  Spinner,
  Text,
  TextArea,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { SHELL_STRINGS } from '../contracts/shell';
import { JUDGE_SEED, generateScenarios } from '../core/generator';
import {
  COMMENT_VISIBILITIES,
  PRODUCT_IDENTITY_KINDS,
  RULE_SET_STATUSES,
} from '../services/admin-settings';
import {
  AWARENESS_UI_STRINGS,
  awarenessViewModel,
  receiptDateProblem,
  tableRows,
} from './awareness-view';
import { SCAN_UI_STRINGS, scanViewModel } from './scan-view';
import { DEADLINES_UI_STRINGS, deadlinesViewModel } from './deadlines-view';
import { DECISION_UI_STRINGS, decisionViewModel } from './decision-view';
import {
  groupLookbackCandidates,
  LOOKBACK_UI_STRINGS,
  lookbackAnchorEntryId,
  lookbackViewModel,
} from './lookback-view';
import { ADMIN_UI_STRINGS, adminViewModel } from './admin-view';
import { formFromSettings, settingsFromForm } from './admin-form';
import { HEALTH_UI_STRINGS, healthViewModel } from './health-view';
import { SAMPLE_UI_STRINGS, csvCopyBlock, sampleViewModel } from './sample-view';
import { CASE_HEADER_UI_STRINGS, caseHeaderViewModel } from './case-header-view';

/** Fixed synthetic author for the copyable CSV; no platform account id is shown. */
const SAMPLE_CSV_AUTHOR = 'synthetic-qa';

const TRAIL_HEAD = {
  cells: [
    { key: 'kind', content: AWARENESS_UI_STRINGS.headers.kind, width: 150 },
    { key: 'status', content: AWARENESS_UI_STRINGS.headers.status, width: 100 },
    { key: 'received', content: AWARENESS_UI_STRINGS.headers.received, width: 120 },
    { key: 'observed', content: AWARENESS_UI_STRINGS.headers.observed, width: 190 },
    { key: 'strength', content: AWARENESS_UI_STRINGS.headers.strength, width: 150 },
  ],
};

const CANDIDATE_HEAD = {
  cells: [
    { key: 'date', content: AWARENESS_UI_STRINGS.headers.date, width: 240 },
    { key: 'entry', content: AWARENESS_UI_STRINGS.headers.entry, width: 160 },
    { key: 'strength', content: AWARENESS_UI_STRINGS.headers.strength, width: 150 },
  ],
};

const LOOKBACK_HEAD = {
  cells: [
    { key: 'issueKey', content: 'Earlier record', width: 110 },
    { key: 'recordTs', content: 'Record time', width: 210 },
    { key: 'confidence', content: 'Signal', width: 110 },
    { key: 'reasons', content: 'Reasons', width: 260 },
    { key: 'state', content: 'State', width: 140 },
  ],
};

const REASON_OPTIONS = [
  { name: 'mistake', label: 'MISTAKE', value: 'MISTAKE' },
  { name: 'duplicate', label: 'DUPLICATE', value: 'DUPLICATE' },
  { name: 'superseded', label: 'SUPERSEDED', value: 'SUPERSEDED' },
  { name: 'out-of-scope', label: 'OUT_OF_SCOPE', value: 'OUT_OF_SCOPE' },
];

const CORRECT_OPTIONS = REASON_OPTIONS.filter((option) =>
  ['MISTAKE', 'DUPLICATE'].includes(option.value),
);

const asRows = (rows, keys) =>
  rows.map((row) => ({
    key: row.key,
    cells: row.cells.map((content, index) => ({
      key: keys[index] ?? `cell-${index}`,
      content: <Text>{content}</Text>,
    })),
  }));

const lookbackRows = (rows) =>
  rows.map((row) => ({
    key: row.id,
    cells: [
      { key: 'issueKey', content: <Text>{row.issueKey}</Text> },
      { key: 'recordTs', content: <Text>{row.recordTs}</Text> },
      { key: 'confidence', content: <Text>{row.confidence}</Text> },
      { key: 'reasons', content: <Text>{row.reasons.join(' · ')}</Text> },
      { key: 'state', content: <Text>{row.state}</Text> },
    ],
  }));

function moduleFrom(context) {
  const type = context?.extension?.type;
  if (type === 'jira:adminPage') return 'adminPage';
  if (type === 'jira:issueContext') return 'issueContext';
  return 'issuePanel';
}

function failedEnvelope(code) {
  return {
    code,
    correlationId: null,
    data: null,
    roleHint: 'UNKNOWN',
  };
}

const AwarenessSlice = ({ model, onAction, selected, onSelect }) => {
  const [modal, setModal] = useState(null);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('MISTAKE');
  const [problem, setProblem] = useState(null);

  if (model.kind === 'ERROR') {
    return (
      <SectionMessage appearance="warning">
        <Text>{model.message}</Text>
        <Text>{AWARENESS_UI_STRINGS.notice}</Text>
      </SectionMessage>
    );
  }
  if (model.kind === 'REVALIDATION') {
    return (
      <Box>
        <Text>{model.state}</Text>
        <Text>{AWARENESS_UI_STRINGS.notice}</Text>
      </Box>
    );
  }

  const entries = tableRows(model).trail;
  const candidates = tableRows(model).candidates;
  const canDecide = model.roleHint === 'QUALIFIED_PERSON';
  const canEnter = ['REVIEWER', 'QUALIFIED_PERSON'].includes(model.roleHint);
  const today = new Date().toISOString().slice(0, 10);

  const close = () => {
    setModal(null);
    setDate('');
    setNote('');
    setProblem(null);
  };

  const submit = (action, payload) => {
    const check = receiptDateProblem(payload.receivedDate ?? '', today);
    if (check !== null) {
      setProblem(
        check === 'EMPTY'
          ? AWARENESS_UI_STRINGS.emptyDate
          : check === 'FORMAT'
            ? AWARENESS_UI_STRINGS.badDate
            : AWARENESS_UI_STRINGS.futureDate,
      );
      return;
    }
    onAction(action, payload);
    close();
  };

  return (
    <Box>
      <Text>{AWARENESS_UI_STRINGS.title}</Text>
      <Text>{AWARENESS_UI_STRINGS.notice}</Text>

      <Text>{AWARENESS_UI_STRINGS.trailHeading}</Text>
      <RadioGroup
        name="trail-entry"
        label={AWARENESS_UI_STRINGS.selectEntry}
        value={selected}
        options={model.entries.map((entry) => ({
          name: entry.entryId,
          label: `${entry.status} · ${entry.entryId}`,
          value: entry.entryId,
        }))}
        onChange={(event) => onSelect(String(event.target?.value ?? ''))}
      />
      <DynamicTable
        label={AWARENESS_UI_STRINGS.trailHeading}
        head={TRAIL_HEAD}
        rows={asRows(entries, ['kind', 'status', 'received', 'observed', 'strength'])}
        emptyView={<Text>{AWARENESS_UI_STRINGS.noEntries}</Text>}
      />

      <Text>{AWARENESS_UI_STRINGS.candidateHeading}</Text>
      <DynamicTable
        label={AWARENESS_UI_STRINGS.candidateHeading}
        head={CANDIDATE_HEAD}
        rows={asRows(candidates, ['date', 'entry', 'strength'])}
        emptyView={<Text>{AWARENESS_UI_STRINGS.noCandidates}</Text>}
      />

      {canEnter ? (
        <Button onClick={() => setModal('receipt')}>{AWARENESS_UI_STRINGS.addReceipt}</Button>
      ) : null}
      {canEnter ? (
        <Button
          onClick={() =>
            onAction('VIEW_CASE', { evidenceId: model.entries[0]?.evidenceId, revalidate: true })
          }
        >
          {AWARENESS_UI_STRINGS.revalidate}
        </Button>
      ) : null}
      {canDecide && selected !== '' ? (
        <Button onClick={() => onAction('CONFIRM_TRAIL_ENTRY', { entryId: selected })}>
          {AWARENESS_UI_STRINGS.confirm}
        </Button>
      ) : null}
      {canDecide && selected !== '' ? (
        <Button onClick={() => setModal('reject')}>{AWARENESS_UI_STRINGS.reject}</Button>
      ) : null}
      {canDecide && selected !== '' ? (
        <Button onClick={() => setModal('correct')}>{AWARENESS_UI_STRINGS.correct}</Button>
      ) : null}

      {modal === 'receipt' ? (
        <Modal title={AWARENESS_UI_STRINGS.addReceipt} onClose={close} width="medium">
          <ModalBody>
            <Text>{AWARENESS_UI_STRINGS.noteWarning}</Text>
            <DatePicker label={AWARENESS_UI_STRINGS.datePrompt} value={date} onChange={setDate} />
            <TextArea
              label={AWARENESS_UI_STRINGS.notePrompt}
              value={note}
              onChange={(event) => setNote(String(event.target?.value ?? ''))}
            />
            {problem !== null ? <Text>{problem}</Text> : null}
          </ModalBody>
          <ModalFooter>
            <Button onClick={close}>{AWARENESS_UI_STRINGS.cancel}</Button>
            <Button
              appearance="primary"
              onClick={() =>
                submit('ENTER_RECEIPT_DATE', {
                  caseId: model.caseId,
                  receivedDate: date,
                  note: note || null,
                })
              }
            >
              {AWARENESS_UI_STRINGS.save}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}

      {modal === 'reject' ? (
        <Modal title={AWARENESS_UI_STRINGS.reject} onClose={close} width="medium">
          <ModalBody>
            <Text>{AWARENESS_UI_STRINGS.noteWarning}</Text>
            <RadioGroup
              name="reject-reason"
              label={AWARENESS_UI_STRINGS.reasonPrompt}
              options={REASON_OPTIONS}
              value={reason}
              onChange={(event) => setReason(String(event.target?.value ?? 'MISTAKE'))}
            />
          </ModalBody>
          <ModalFooter>
            <Button onClick={close}>{AWARENESS_UI_STRINGS.cancel}</Button>
            <Button
              appearance="primary"
              onClick={() => {
                onAction('CONFIRM_TRAIL_ENTRY', {
                  entryId: selected,
                  reject: true,
                  reasonCode: reason,
                });
                close();
              }}
            >
              {AWARENESS_UI_STRINGS.save}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}

      {modal === 'correct' ? (
        <Modal title={AWARENESS_UI_STRINGS.correct} onClose={close} width="medium">
          <ModalBody>
            <Text>{AWARENESS_UI_STRINGS.noteWarning}</Text>
            <DatePicker label={AWARENESS_UI_STRINGS.datePrompt} value={date} onChange={setDate} />
            <RadioGroup
              name="correct-reason"
              label={AWARENESS_UI_STRINGS.reasonPrompt}
              options={CORRECT_OPTIONS}
              value={reason}
              onChange={(event) => setReason(String(event.target?.value ?? 'MISTAKE'))}
            />
            <TextArea
              label={AWARENESS_UI_STRINGS.notePrompt}
              value={note}
              onChange={(event) => setNote(String(event.target?.value ?? ''))}
            />
            {problem !== null ? <Text>{problem}</Text> : null}
          </ModalBody>
          <ModalFooter>
            <Button onClick={close}>{AWARENESS_UI_STRINGS.cancel}</Button>
            <Button
              appearance="primary"
              onClick={() =>
                submit('CONFIRM_TRAIL_ENTRY', {
                  entryId: selected,
                  correct: true,
                  receivedDate: date,
                  reasonCode: reason,
                  note: note || null,
                })
              }
            >
              {AWARENESS_UI_STRINGS.save}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </Box>
  );
};

const ScanSlice = ({ model, onScan }) => (
  <Box>
    <Text>{SCAN_UI_STRINGS.title}</Text>
    <Text>{model.message}</Text>
    <Text>{SCAN_UI_STRINGS.notice}</Text>
    {model.kind === 'RESULT' ? (
      <Text>{`${model.state} · ${model.result} · ${model.reasonCode} · ${model.segmentsScanned}/${model.segmentsSeen}`}</Text>
    ) : null}
    <Button onClick={onScan}>{SCAN_UI_STRINGS.run}</Button>
  </Box>
);

const DeadlinesSlice = ({ model, onCompute, canCompute }) => (
  <Box>
    <Text>{DEADLINES_UI_STRINGS.title}</Text>
    <Text>{DEADLINES_UI_STRINGS.notice}</Text>
    {model.message ? <Text>{model.message}</Text> : null}
    {model.banner ? (
      <SectionMessage appearance="warning">
        <Text>{model.banner}</Text>
      </SectionMessage>
    ) : null}
    {model.sensitivity.map((line, index) => (
      <Text key={`sensitivity-${index}`}>{line}</Text>
    ))}
    {model.clocks.map((clock) => (
      <Box key={`${clock.clockId}-${clock.dueDate}`}>
        <Text>{`${clock.label} · ${clock.dueDate} · ${clock.daysLeft} days left · ${clock.state}`}</Text>
        {clock.details.map((detail, index) => (
          <Text key={`detail-${index}`}>{detail}</Text>
        ))}
      </Box>
    ))}
    {model.missing.map((reason, index) => (
      <Text key={`missing-${index}`}>{`${DEADLINES_UI_STRINGS.missingHeading}: ${reason}`}</Text>
    ))}
    <Button onClick={onCompute} isDisabled={!canCompute}>
      {DEADLINES_UI_STRINGS.calculate}
    </Button>
  </Box>
);

const DecisionSlice = ({ model, onStart, onFinalise }) => {
  const [answers, setAnswers] = useState({});
  const [rationale, setRationale] = useState('');
  const answered =
    model.questions.length > 0 &&
    model.questions.every((question) => answers[question.id] !== undefined);
  const canFinalise =
    model.kind === 'DRAFT' && model.canFinalise && answered && rationale.trim().length > 0;

  if (['IDLE', 'MISSING', 'UNAVAILABLE', 'ERROR'].includes(model.kind)) {
    return (
      <Box>
        <Text>{DECISION_UI_STRINGS.title}</Text>
        <Text>{DECISION_UI_STRINGS.notice}</Text>
        <Text>{model.message}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text>{DECISION_UI_STRINGS.title}</Text>
      <Text>{DECISION_UI_STRINGS.notice}</Text>
      <Text>{model.message}</Text>
      {model.questions.map((question) => (
        <RadioGroup
          key={question.id}
          name={`question-${question.id}`}
          label={question.prompt}
          value={answers[question.id] ?? ''}
          options={question.answerCodes.map((code) => ({
            name: `${question.id}-${code}`,
            label: code,
            value: code,
          }))}
          onChange={(event) =>
            setAnswers((current) => ({
              ...current,
              [question.id]: String(event.target?.value ?? ''),
            }))
          }
        />
      ))}
      {model.kind === 'QUESTIONS' ? (
        <Button onClick={onStart}>{DECISION_UI_STRINGS.startDraft}</Button>
      ) : null}
      {model.kind === 'DRAFT' ? (
        <Box>
          <Text>{DECISION_UI_STRINGS.noteWarning}</Text>
          <TextArea
            label="Rationale"
            value={rationale}
            onChange={(event) => setRationale(String(event.target?.value ?? ''))}
          />
          <Button
            appearance="primary"
            isDisabled={!canFinalise}
            onClick={() =>
              onFinalise({
                answers,
                rationale,
                featureReasonCodes: [],
                notAComplaint: false,
              })
            }
          >
            {DECISION_UI_STRINGS.finalise}
          </Button>
        </Box>
      ) : null}
      {model.kind === 'FINAL' ? (
        <Button onClick={onStart}>{DECISION_UI_STRINGS.supersede}</Button>
      ) : null}
    </Box>
  );
};

const LookbackSlice = ({ model, segments, decision, anchorEntryId, onRun, onShow, onDecide }) => {
  const [showing, setShowing] = useState(null);
  const [pendingDecision, setPendingDecision] = useState(null);
  const [segmentKey, setSegmentKey] = useState('');
  const [choiceMode, setChoiceMode] = useState('PHRASE');
  const [phrase, setPhrase] = useState('');

  const close = () => {
    setShowing(null);
    setPendingDecision(null);
    setSegmentKey('');
    setChoiceMode('PHRASE');
    setPhrase('');
  };

  const openSegments = (candidateId, nextDecision = null) => {
    setShowing(candidateId);
    setPendingDecision(nextDecision);
    setSegmentKey('');
    setChoiceMode('PHRASE');
    setPhrase('');
    onShow(candidateId);
  };

  const record = (candidateId, nextDecision, choice) => {
    onDecide(candidateId, nextDecision, choice);
    close();
  };

  const chosenSegment =
    segments.kind === 'SEGMENTS'
      ? segments.segments.find((segment) => segment.key === segmentKey)
      : undefined;
  const wholeAllowed = chosenSegment?.wholeSegmentAllowed === true;
  const canConfirmChoice =
    segmentKey !== '' &&
    ((choiceMode === 'WHOLE' && wholeAllowed) ||
      (choiceMode === 'PHRASE' && phrase.trim().length > 0));
  const groups = model.kind === 'RESULT' ? groupLookbackCandidates(model.candidates) : [];

  return (
    <Box>
      <Text>{LOOKBACK_UI_STRINGS.title}</Text>
      <Text>{LOOKBACK_UI_STRINGS.notice}</Text>
      {model.kind === 'IDLE' ? (
        <Text>
          {anchorEntryId === null ? LOOKBACK_UI_STRINGS.noAnchor : LOOKBACK_UI_STRINGS.idle}
        </Text>
      ) : null}
      {['UNAVAILABLE', 'ERROR'].includes(model.kind) ? <Text>{model.message}</Text> : null}
      {decision.kind === 'DECISION' ? <Text>{decision.message}</Text> : null}

      {model.kind === 'RESULT' ? (
        <Box>
          {model.message ? <Text>{model.message}</Text> : null}
          {model.coverage.map((line, index) => (
            <Text key={`lookback-coverage-${index}`}>{line}</Text>
          ))}
          <Text>{`Examined ${model.examined} records in ${model.searchCalls} searches.`}</Text>
          {groups.length === 0 ? <Text>{LOOKBACK_UI_STRINGS.noCandidates}</Text> : null}
          {groups.map((group) => (
            <Box key={`lookback-group-${group.confidence}`}>
              <Text>{`${group.confidence} · ${LOOKBACK_UI_STRINGS.confidence[group.confidence]}`}</Text>
              <DynamicTable
                label={`${group.confidence} earlier records`}
                head={LOOKBACK_HEAD}
                rows={lookbackRows(group.rows)}
                emptyView={<Text>{LOOKBACK_UI_STRINGS.noCandidates}</Text>}
              />
              {group.rows.map((candidate) => (
                <Box key={`lookback-candidate-${candidate.id}`}>
                  <Text>{`${candidate.issueKey} · ${candidate.strength} · ${candidate.state} · ${candidate.confidenceHelp}`}</Text>
                  <Button onClick={() => openSegments(candidate.id)}>
                    {LOOKBACK_UI_STRINGS.segmentsTitle}
                  </Button>
                  {model.canAnswer && candidate.rawState === 'REJECTED' ? (
                    <Button onClick={() => record(candidate.id, 'REOPEN', undefined)}>
                      {LOOKBACK_UI_STRINGS.reopen}
                    </Button>
                  ) : null}
                  {model.canAnswer && candidate.rawState !== 'REJECTED' ? (
                    <RadioGroup
                      name={`same-event-${candidate.id}`}
                      label={LOOKBACK_UI_STRINGS.sameEvent}
                      value=""
                      options={[
                        {
                          name: `yes-${candidate.id}`,
                          label: LOOKBACK_UI_STRINGS.yes,
                          value: 'YES',
                        },
                        { name: `no-${candidate.id}`, label: LOOKBACK_UI_STRINGS.no, value: 'NO' },
                        {
                          name: `unsure-${candidate.id}`,
                          label: LOOKBACK_UI_STRINGS.unsure,
                          value: 'UNSURE',
                        },
                      ]}
                      onChange={(event) => {
                        const answer = String(event.target?.value ?? '');
                        if (answer === 'YES') openSegments(candidate.id, 'YES');
                        if (answer === 'NO' || answer === 'UNSURE') {
                          record(candidate.id, answer, undefined);
                        }
                      }}
                    />
                  ) : null}
                </Box>
              ))}
            </Box>
          ))}
          {!model.canAnswer && model.candidates.length > 0 ? (
            <Text>{LOOKBACK_UI_STRINGS.restricted}</Text>
          ) : null}
          <Button
            isDisabled={model.nextCursor === null}
            onClick={() => onRun(model.nextCursor, null)}
          >
            {LOOKBACK_UI_STRINGS.continue}
          </Button>
        </Box>
      ) : null}

      {decision.kind === 'DECISION' && decision.newAnchorEntryId !== null ? (
        <Button onClick={() => onRun(null, decision.newAnchorEntryId)}>
          {LOOKBACK_UI_STRINGS.continue}
        </Button>
      ) : null}
      <Button isDisabled={anchorEntryId === null} onClick={() => onRun(null, null)}>
        {LOOKBACK_UI_STRINGS.run}
      </Button>

      {showing !== null ? (
        <Modal title={LOOKBACK_UI_STRINGS.segmentsTitle} onClose={close} width="medium">
          <ModalBody>
            <Text>{LOOKBACK_UI_STRINGS.phraseWarning}</Text>
            {segments.kind === 'SEGMENTS' && segments.segments.length > 0 ? (
              <RadioGroup
                name="lookback-segment"
                label={LOOKBACK_UI_STRINGS.segmentsTitle}
                value={segmentKey}
                options={segments.segments.map((segment) => ({
                  name: `segment-${segment.key}`,
                  label: `${segment.key} · ${segment.strength} · ${segment.recordCreatedAt}`,
                  value: segment.key,
                }))}
                onChange={(event) => {
                  setSegmentKey(String(event.target?.value ?? ''));
                  setChoiceMode('PHRASE');
                }}
              />
            ) : (
              <Text>{segments.message}</Text>
            )}
            {wholeAllowed ? (
              <RadioGroup
                name="lookback-choice-mode"
                label="Basis for the answer"
                value={choiceMode}
                options={[
                  { name: 'mode-phrase', label: LOOKBACK_UI_STRINGS.phrase, value: 'PHRASE' },
                  { name: 'mode-whole', label: LOOKBACK_UI_STRINGS.wholeSegment, value: 'WHOLE' },
                ]}
                onChange={(event) => setChoiceMode(String(event.target?.value ?? 'PHRASE'))}
              />
            ) : null}
            {choiceMode === 'PHRASE' ? (
              <TextArea
                label={LOOKBACK_UI_STRINGS.phrase}
                value={phrase}
                onChange={(event) => setPhrase(String(event.target?.value ?? ''))}
              />
            ) : null}
          </ModalBody>
          <ModalFooter>
            <Button onClick={close}>{LOOKBACK_UI_STRINGS.cancel}</Button>
            {pendingDecision === 'YES' ? (
              <Button
                appearance="primary"
                isDisabled={!canConfirmChoice}
                onClick={() =>
                  record(showing, 'YES', {
                    segmentKey,
                    ...(choiceMode === 'WHOLE' ? { wholeSegment: true } : { quote: phrase.trim() }),
                  })
                }
              >
                {LOOKBACK_UI_STRINGS.confirmChoice}
              </Button>
            ) : null}
          </ModalFooter>
        </Modal>
      ) : null}
    </Box>
  );
};

const ON_OFF_OPTIONS = Object.freeze([
  { name: 'on', label: 'ON', value: 'ON' },
  { name: 'off', label: 'OFF', value: 'OFF' },
]);

const PRODUCT_OPTIONS = Object.freeze([
  { name: 'identity-none', label: 'NONE', value: '' },
  ...PRODUCT_IDENTITY_KINDS.map((kind) => ({
    name: `identity-${kind}`,
    label: kind,
    value: kind,
  })),
]);
const RULE_STATUS_OPTIONS = Object.freeze(
  RULE_SET_STATUSES.map((status) => ({ name: `rule-${status}`, label: status, value: status })),
);
const VISIBILITY_OPTIONS = Object.freeze(
  COMMENT_VISIBILITIES.map((value) => ({ name: `visibility-${value}`, label: value, value })),
);

const AdminChecklistSlice = ({ steps }) => (
  <Box>
    <Text>{ADMIN_UI_STRINGS.getStarted}</Text>
    {steps.map((step) => (
      <Text key={step.id}>{`${step.label}: ${step.message}`}</Text>
    ))}
  </Box>
);

const AdminSettingsSlice = ({ model, form, message, saving, onField, onSave }) => {
  const usable = model.state === 'READY' && form !== null;
  const field = (key, label) => (
    <TextArea
      key={key}
      label={label}
      value={form[key]}
      onChange={(event) => onField(key, String(event.target?.value ?? ''))}
    />
  );
  const choice = (key, label, options) => (
    <RadioGroup
      key={key}
      name={`admin-${key}`}
      label={label}
      value={form[key]}
      options={options}
      onChange={(event) => onField(key, String(event.target?.value ?? ''))}
    />
  );

  return (
    <Box>
      <Text>{ADMIN_UI_STRINGS.formHeading}</Text>
      <Text>{model.message}</Text>
      <Text>{ADMIN_UI_STRINGS.notice}</Text>
      {usable ? (
        <Box>
          <Text>{ADMIN_UI_STRINGS.disclosure}</Text>
          {field('watchedProjects', ADMIN_UI_STRINGS.checklist.watchedProjects)}
          {field('issueTypeExclusions', 'Issue type exclusions')}
          {field('reviewerRoles', 'Reviewer roles')}
          {field('qualifiedRoles', 'Qualified roles')}
          {field('routingLabel', ADMIN_UI_STRINGS.checklist.routingLabel)}
          {choice('aiEnabled', 'AI screening', ON_OFF_OPTIONS)}
          {choice('killSwitch', 'AI kill switch', ON_OFF_OPTIONS)}
          {choice('writeBackEnabled', 'Jira write-back', ON_OFF_OPTIONS)}
          {choice('visibilityChosen', 'Comment visibility chosen', ON_OFF_OPTIONS)}
          {field('perIssueCap', 'AI calls per issue')}
          {field('perSiteCap', 'AI calls per site')}
          {choice(
            'productIdentityKind',
            ADMIN_UI_STRINGS.checklist.productIdentity,
            PRODUCT_OPTIONS,
          )}
          {field('productIdentityValue', 'Product identity value')}
          {choice('commentVisibility', 'Comment visibility', VISIBILITY_OPTIONS)}
          {field('commentVisibilityRef', 'Visibility group or role')}
          {field('ruleSetVersion', 'Rule set version')}
          {choice('ruleSetStatus', ADMIN_UI_STRINGS.checklist.ruleSetStatus, RULE_STATUS_OPTIONS)}
        </Box>
      ) : null}
      {message !== '' ? <Text>{message}</Text> : null}
      <Button isDisabled={!usable || saving} onClick={onSave}>
        {ADMIN_UI_STRINGS.save}
      </Button>
    </Box>
  );
};

const HealthSlice = ({ model }) => {
  const counters = (values) =>
    Object.entries(values)
      .map(([key, value]) => `${key} ${value}`)
      .join(' · ');
  return (
    <Box>
      <Text>{HEALTH_UI_STRINGS.title}</Text>
      <Text>{model.message}</Text>
      <Text>{HEALTH_UI_STRINGS.notice}</Text>
      {model.snapshot !== null ? (
        <Box>
          <Text>{`${HEALTH_UI_STRINGS.fields.scans}: ${counters(model.snapshot.scansByStatus)} / ${counters(model.snapshot.scansByResult)}`}</Text>
          <Text>{`${HEALTH_UI_STRINGS.fields.evidence}: ${counters(model.snapshot.evidenceStateCounts)}`}</Text>
          <Text>{`${HEALTH_UI_STRINGS.fields.writeback}: pending ${model.snapshot.writebackPending} · failed ${model.snapshot.writebackFailed}`}</Text>
          <Text>{`${HEALTH_UI_STRINGS.fields.ai}: ${counters(model.snapshot.ai)}`}</Text>
          <Text>{`${HEALTH_UI_STRINGS.fields.ruleSet}: ${model.snapshot.ruleSetVersion} · ${model.snapshot.ruleSetStatus}`}</Text>
          <Text>{`${HEALTH_UI_STRINGS.fields.capsHit}: ${model.snapshot.capsHit}`}</Text>
          <Text>{`${HEALTH_UI_STRINGS.fields.reconciler}: ${model.snapshot.lastReconcilerAt ?? HEALTH_UI_STRINGS.fields.none}`}</Text>
        </Box>
      ) : null}
    </Box>
  );
};

const SampleSlice = ({ model, csvCopy, projectKey, onLoad, onPrepareCsv }) => (
  <Box>
    <Text>{SAMPLE_UI_STRINGS.title}</Text>
    <Text>{model.message}</Text>
    <Text>{SAMPLE_UI_STRINGS.notice}</Text>
    {projectKey === '' ? <Text>{SAMPLE_UI_STRINGS.projectMissing}</Text> : null}
    <Button isDisabled={projectKey === ''} onClick={onLoad}>
      {SAMPLE_UI_STRINGS.load}
    </Button>
    <Button onClick={onPrepareCsv}>{SAMPLE_UI_STRINGS.csvHeading}</Button>
    {csvCopy !== null ? <Text>{csvCopy.text}</Text> : null}
  </Box>
);

const CaseHeaderSlice = ({ model }) => (
  <Box>
    <Text>{CASE_HEADER_UI_STRINGS.title}</Text>
    <Text>{CASE_HEADER_UI_STRINGS.notice}</Text>
    <Text>{model.message}</Text>
    {model.canShowCaseHeader ? (
      <Box>
        <Text>{`${CASE_HEADER_UI_STRINGS.roleView}: ${model.roleView}`}</Text>
        <Text>{CASE_HEADER_UI_STRINGS.chipsLabel}</Text>
        {model.chips.map((chip) => (
          <Text key={chip.code}>{chip.text}</Text>
        ))}
        {model.banners.length > 0 ? <Text>{CASE_HEADER_UI_STRINGS.bannersLabel}</Text> : null}
        {model.banners.map((banner) => (
          <Text key={banner.code}>{banner.text}</Text>
        ))}
        <Text>
          {model.nextStep === null
            ? CASE_HEADER_UI_STRINGS.noNextStep
            : `${CASE_HEADER_UI_STRINGS.nextStepLabel}: ${model.nextStep.text}`}
        </Text>
        <Text>{`${CASE_HEADER_UI_STRINGS.actionsLabel}: ${model.actions.join(' · ')}`}</Text>
      </Box>
    ) : null}
  </Box>
);

const App = () => {
  const context = useProductContext();
  const module = moduleFrom(context);
  const [status, setStatus] = useState(null);
  const [failed, setFailed] = useState(false);
  const [envelope, setEnvelope] = useState(null);
  const [scanEnvelope, setScanEnvelope] = useState(null);
  const [deadlineEnvelope, setDeadlineEnvelope] = useState(null);
  const [decisionEnvelope, setDecisionEnvelope] = useState(null);
  const [questionContext, setQuestionContext] = useState(null);
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [lookbackEnvelope, setLookbackEnvelope] = useState(null);
  const [lookbackSegments, setLookbackSegments] = useState(null);
  const [lookbackDecision, setLookbackDecision] = useState(null);
  const [adminEnvelope, setAdminEnvelope] = useState(null);
  const [healthEnvelope, setHealthEnvelope] = useState(null);
  const [sampleEnvelope, setSampleEnvelope] = useState(null);
  const [adminForm, setAdminForm] = useState(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const adminSaveInFlight = useRef(false);
  const [csvCopy, setCsvCopy] = useState(null);

  useEffect(() => {
    let active = true;
    invoke('knewwhenShell', { module })
      .then((result) => {
        if (active) setStatus(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [module]);

  useEffect(() => {
    if (module !== 'adminPage' || status?.state !== 'ready') return;
    let active = true;
    const call = (action) =>
      invoke('knewwhenOperations', { action: 'ADMIN_SETTINGS', payload: { action } })
        .then((result) => {
          if (active) setAdminEnvelope(result);
        })
        .catch(() => {
          if (active) setAdminEnvelope(failedEnvelope('DEPENDENCY_FAILED'));
        });
    call('GET_SETTINGS');
    invoke('knewwhenOperations', { action: 'ADMIN_SETTINGS', payload: { action: 'GET_HEALTH' } })
      .then((result) => {
        if (active) setHealthEnvelope(result);
      })
      .catch(() => {
        if (active) setHealthEnvelope(failedEnvelope('DEPENDENCY_FAILED'));
      });
    return () => {
      active = false;
    };
  }, [module, status?.state]);

  const issueKey = status?.issueKey ?? null;
  const adminModel = adminViewModel(adminEnvelope);
  const healthModel = healthViewModel(healthEnvelope);
  const sampleModel = sampleViewModel(sampleEnvelope);
  const isCaseModule = module === 'issuePanel' || module === 'issueContext';
  const awarenessModel = awarenessViewModel(envelope);
  const caseId = awarenessModel.kind === 'CASE_VIEW' ? awarenessModel.caseId : null;
  const candidates =
    awarenessModel.kind === 'CASE_VIEW'
      ? awarenessModel.candidates.map((candidate) => ({
          entryId: candidate.entryId,
          basis: candidate.basis,
          effectiveDate: candidate.effectiveDate,
          reasonCode: candidate.reasonCode,
        }))
      : [];
  const lookbackModel = lookbackViewModel(lookbackEnvelope);
  const lookbackSegmentsModel = lookbackViewModel(lookbackSegments);
  const lookbackDecisionModel = lookbackViewModel(lookbackDecision);
  const awarenessEntries = awarenessModel.kind === 'CASE_VIEW' ? awarenessModel.entries : [];
  const baseAnchor = lookbackAnchorEntryId(awarenessEntries, selectedEntryId || undefined);
  const decisionData =
    lookbackDecision?.code === 'OK' &&
    typeof lookbackDecision.data === 'object' &&
    lookbackDecision.data !== null
      ? lookbackDecision.data
      : null;
  const decidedAnchor =
    decisionData?.kind === 'LOOKBACK_DECISION' &&
    typeof decisionData.trailEntryId === 'string' &&
    decisionData.trailEntryId.length > 0
      ? decisionData.trailEntryId
      : null;
  const lookbackAnchor = decidedAnchor ?? baseAnchor;

  useEffect(() => {
    if (adminEnvelope?.code !== 'OK') return;
    setAdminForm(formFromSettings(adminViewModel(adminEnvelope)));
  }, [adminEnvelope]);

  useEffect(() => {
    setSelectedEntryId('');
    setLookbackEnvelope(null);
    setLookbackSegments(null);
    setLookbackDecision(null);
  }, [caseId]);

  const baseDecisionModel = decisionViewModel(decisionEnvelope);
  const decisionModel =
    questionContext !== null && ['DRAFT', 'FINAL'].includes(baseDecisionModel.kind)
      ? {
          ...baseDecisionModel,
          questionSetId: questionContext.questionSetId,
          questionSetVersion: questionContext.questionSetVersion,
          productKey: questionContext.productKey,
          canFinalise: baseDecisionModel.canFinalise || questionContext.canFinalise,
        }
      : baseDecisionModel;
  useEffect(() => {
    if (baseDecisionModel.kind !== 'QUESTIONS') return;
    setQuestionContext({
      questionSetId: baseDecisionModel.questionSetId,
      questionSetVersion: baseDecisionModel.questionSetVersion,
      productKey: baseDecisionModel.productKey,
      canFinalise: baseDecisionModel.canFinalise,
    });
  }, [
    baseDecisionModel.kind,
    baseDecisionModel.questionSetId,
    baseDecisionModel.questionSetVersion,
    baseDecisionModel.productKey,
    baseDecisionModel.canFinalise,
  ]);

  const onScan = () => {
    if (issueKey === null) return;
    invoke('knewwhenOperations', { action: 'MANUAL_SCAN', payload: { issueId: issueKey } })
      .then((result) => setScanEnvelope(result))
      .catch(() => setScanEnvelope(failedEnvelope('DEPENDENCY_FAILED')));
  };
  useEffect(() => {
    if (!isCaseModule || status?.state !== 'ready' || issueKey === null) return;
    let active = true;
    invoke('knewwhenAwareness', { action: 'VIEW_CASE', payload: { issueKey } })
      .then((result) => {
        if (active) setEnvelope(result);
      })
      .catch(() => {
        if (active) setEnvelope(failedEnvelope('DEPENDENCY_FAILED'));
      });
    return () => {
      active = false;
    };
  }, [issueKey, module, status?.state]);

  useEffect(() => {
    if (!isCaseModule || status?.state !== 'ready') return;
    let active = true;
    invoke('knewwhenOperations', { action: 'DECIDE', payload: { action: 'GET_QUESTIONS' } })
      .then((result) => {
        if (active) setDecisionEnvelope(result);
      })
      .catch(() => {
        if (active) setDecisionEnvelope(failedEnvelope('DEPENDENCY_FAILED'));
      });
    return () => {
      active = false;
    };
  }, [module, status?.state]);

  const onCompute = () => {
    if (caseId === null) return;
    invoke('knewwhenOperations', {
      action: 'COMPUTE_DEADLINES',
      payload: {
        caseId,
        asOfDate: new Date().toISOString().slice(0, 10),
        candidates,
      },
    })
      .then((result) => setDeadlineEnvelope(result))
      .catch(() => setDeadlineEnvelope(failedEnvelope('DEPENDENCY_FAILED')));
  };

  const invokeDecision = (payload) =>
    invoke('knewwhenOperations', { action: 'DECIDE', payload })
      .then((result) => setDecisionEnvelope(result))
      .catch(() => setDecisionEnvelope(failedEnvelope('DEPENDENCY_FAILED')));

  const onStartDecision = () => {
    if (caseId === null) return;
    invokeDecision({ action: 'START_DRAFT', caseId });
  };

  const onFinaliseDecision = (input) => {
    if (caseId === null || decisionModel.decision === null) return;
    invokeDecision({
      action: 'FINALISE',
      caseId,
      draftId: decisionModel.decision.id,
      questionSetId: decisionModel.questionSetId,
      questionSetVersion: decisionModel.questionSetVersion,
      productKey: decisionModel.productKey,
      ...input,
    });
  };

  const onAction = (action, payload) => {
    invoke('knewwhenAwareness', { action, payload })
      .then((result) => setEnvelope(result))
      .catch(() => setEnvelope(failedEnvelope('DEPENDENCY_FAILED')));
  };

  const invokeLookback = (payload, setter) =>
    invoke('knewwhenOperations', { action: 'RUN_LOOKBACK', payload })
      .then(setter)
      .catch(() => setter(failedEnvelope('DEPENDENCY_FAILED')));

  const onRunLookback = (cursor, nextAnchor) => {
    const anchor = nextAnchor ?? lookbackAnchor;
    if (caseId === null || anchor === null || anchor === '') return;
    setLookbackSegments(null);
    setLookbackDecision(null);
    invokeLookback(
      {
        caseId,
        anchorEntryId: anchor,
        ...(cursor === null || cursor === undefined ? {} : { cursor }),
      },
      setLookbackEnvelope,
    );
  };

  const onShowLookback = (candidateId) => {
    if (caseId === null) return;
    invokeLookback({ caseId, candidateId, view: 'SHOW' }, setLookbackSegments);
  };

  const refreshLookbackList = () => invokeLookback({ caseId, view: 'LIST' }, setLookbackEnvelope);

  const onDecideLookback = (candidateId, decision, choice) => {
    if (caseId === null) return;
    invoke('knewwhenOperations', {
      action: 'CONFIRM_SAME_EVENT',
      payload: {
        caseId,
        candidateId,
        decision,
        ...(choice === undefined ? {} : { choice }),
      },
    })
      .then((result) => {
        setLookbackDecision(result);
        if (result.code !== 'OK') {
          setLookbackEnvelope(failedEnvelope(result.code));
          return;
        }
        refreshLookbackList();
      })
      .catch(() => setLookbackEnvelope(failedEnvelope('DEPENDENCY_FAILED')));
  };

  const onAdminField = (key, value) =>
    setAdminForm((current) => (current === null ? current : { ...current, [key]: value }));

  const onAdminSave = () => {
    if (adminForm === null || adminSaveInFlight.current) return;
    const settings = settingsFromForm(adminForm);
    if (settings === null) {
      setAdminMessage(ADMIN_UI_STRINGS.saveInvalid);
      return;
    }
    adminSaveInFlight.current = true;
    setAdminSaving(true);
    setAdminMessage('');
    invoke('knewwhenOperations', {
      action: 'ADMIN_SETTINGS',
      payload: { action: 'SAVE_SETTINGS', settings },
    })
      .then((result) => {
        setAdminEnvelope(result);
        setAdminMessage(
          result.code === 'OK' ? ADMIN_UI_STRINGS.saveSaved : ADMIN_UI_STRINGS.saveFailed,
        );
      })
      .catch(() => setAdminMessage(ADMIN_UI_STRINGS.saveFailed))
      .finally(() => {
        adminSaveInFlight.current = false;
        setAdminSaving(false);
      });
  };

  const onLoadSample = () => {
    const projectKey = adminModel.watchedProjects[0] ?? '';
    if (projectKey === '') return;
    invoke('knewwhenOperations', {
      action: 'ADMIN_SETTINGS',
      payload: { action: 'LOAD_SAMPLE', projectKey },
    })
      .then(setSampleEnvelope)
      .catch(() => setSampleEnvelope(failedEnvelope('DEPENDENCY_FAILED')));
  };

  const onPrepareCsv = () => {
    try {
      const generated = generateScenarios({
        seed: JUDGE_SEED,
        anchorDateISO: new Date().toISOString().slice(0, 10),
        authorAccountId: SAMPLE_CSV_AUTHOR,
      });
      setCsvCopy(csvCopyBlock(generated.csv));
    } catch {
      setCsvCopy(csvCopyBlock(null));
    }
  };

  const caseHeaderModel = caseHeaderViewModel({
    roleHint:
      envelope?.roleHint ?? scanEnvelope?.roleHint ?? decisionEnvelope?.roleHint ?? 'UNKNOWN',
    caseView: envelope,
    scan: scanEnvelope,
    lookback: lookbackEnvelope,
    decision: decisionEnvelope,
    writeback: null,
  });

  if (failed || status?.state === 'error') {
    return (
      <SectionMessage appearance="error">
        <Text>{SHELL_STRINGS.error}</Text>
        <Text>{SHELL_STRINGS.notice}</Text>
      </SectionMessage>
    );
  }

  if (status === null) {
    return (
      <>
        <Spinner />
        <Text>{SHELL_STRINGS.loading}</Text>
      </>
    );
  }

  if (module === 'adminPage') {
    return (
      <Box>
        <AdminChecklistSlice steps={adminModel.getStarted} />
        <AdminSettingsSlice
          model={adminModel}
          form={adminForm}
          message={adminMessage}
          saving={adminSaving}
          onField={onAdminField}
          onSave={onAdminSave}
        />
        <HealthSlice model={healthModel} />
        <SampleSlice
          model={sampleModel}
          csvCopy={csvCopy}
          projectKey={adminModel.watchedProjects[0] ?? ''}
          onLoad={onLoadSample}
          onPrepareCsv={onPrepareCsv}
        />
      </Box>
    );
  }

  if (module === 'issueContext') {
    return <CaseHeaderSlice model={caseHeaderModel} />;
  }

  if (module !== 'issuePanel') {
    return (
      <>
        <Text>{SHELL_STRINGS.ready}</Text>
        <Text>{SHELL_STRINGS.notice}</Text>
      </>
    );
  }

  return (
    <Box>
      <ScanSlice model={scanViewModel(scanEnvelope)} onScan={onScan} />
      <DeadlinesSlice
        model={deadlinesViewModel(deadlineEnvelope)}
        onCompute={onCompute}
        canCompute={caseId !== null}
      />
      <DecisionSlice
        model={decisionModel}
        onStart={onStartDecision}
        onFinalise={onFinaliseDecision}
      />
      <LookbackSlice
        model={lookbackModel}
        segments={lookbackSegmentsModel}
        decision={lookbackDecisionModel}
        anchorEntryId={lookbackAnchor}
        onRun={onRunLookback}
        onShow={onShowLookback}
        onDecide={onDecideLookback}
      />
      <AwarenessSlice
        model={awarenessModel}
        onAction={onAction}
        selected={selectedEntryId}
        onSelect={setSelectedEntryId}
      />
    </Box>
  );
};

ForgeReconciler.render(<App />);
