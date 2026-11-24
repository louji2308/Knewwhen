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

const App = () => {
  const context = useProductContext();
  const module = moduleFrom(context);
  const [status, setStatus] = useState(null);
  const [failed, setFailed] = useState(false);
  const [envelope, setEnvelope] = useState(null);

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

  return <AwarenessSlice model={awarenessViewModel(envelope)} onAction={onAction} />;
};

ForgeReconciler.render(<App />);
