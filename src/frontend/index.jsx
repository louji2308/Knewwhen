import React, { useEffect, useState } from 'react';
import ForgeReconciler, { SectionMessage, Spinner, Text, useProductContext } from '@forge/react';
import { invoke } from '@forge/bridge';
import { SHELL_STRINGS } from '../contracts/shell';

function moduleFrom(context) {
  const type = context?.extension?.type;
  if (type === 'jira:adminPage') return 'adminPage';
  if (type === 'jira:issueContext') return 'issueContext';
  return 'issuePanel';
}

const App = () => {
  const context = useProductContext();
  const module = moduleFrom(context);
  const [status, setStatus] = useState(null);
  const [failed, setFailed] = useState(false);

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

  return (
    <>
      <Text>{SHELL_STRINGS.ready}</Text>
      <Text>{SHELL_STRINGS.notice}</Text>
    </>
  );
};

ForgeReconciler.render(<App />);
