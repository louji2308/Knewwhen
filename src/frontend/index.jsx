import React, { useEffect, useState } from 'react';
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
import {
  AWARENESS_UI_STRINGS,
  awarenessViewModel,
  receiptDateProblem,
  tableRows,
} from './awareness-view';
import { SCAN_UI_STRINGS, scanViewModel } from './scan-view';
import { DEADLINES_UI_STRINGS, deadlinesViewModel } from './deadlines-view';
import { DECISION_UI_STRINGS, decisionViewModel } from './decision-view';

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

const AwarenessSlice = ({ model, onAction }) => {
  const [selected, setSelected] = useState('');
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
        onChange={(event) => setSelected(String(event.target?.value ?? ''))}
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

  const issueKey = status?.issueKey ?? null;
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
    if (module !== 'issuePanel' || status?.state !== 'ready' || issueKey === null) return;
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
    if (module !== 'issuePanel' || status?.state !== 'ready') return;
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
      <AwarenessSlice model={awarenessModel} onAction={onAction} />
    </Box>
  );
};

ForgeReconciler.render(<App />);
