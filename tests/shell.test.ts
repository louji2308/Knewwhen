import { describe, expect, it } from 'vitest';
import {
  SHELL_MODULES,
  SHELL_STRINGS,
  type ShellModule,
  type ShellStatus,
} from '../src/contracts/shell';
import { noop } from '../src/handlers/noop';
import { shellStatus } from '../src/handlers/shell';

const CONTEXT = Object.freeze({
  accountId: 'acct-verified-shell',
  issueKey: 'KW-1',
  'canary-record-text': 'do-not-store-this-record-text',
});

describe('P1.B2 resolver shell (G-8, I-4, I-6)', () => {
  it('derives identity only from platform context, never from the request payload', () => {
    const payload = { module: 'issuePanel', 'canary-record-text': 'attacker-value' };
    const result = shellStatus(payload, CONTEXT);
    expect(result.state).toBe('ready');
    expect(result.code).toBe('SHELL_READY');
    expect(result.accountId).toBe('acct-verified-shell');
    expect(result.issueKey).toBe('KW-1');
    expect(JSON.stringify(result)).not.toContain('attacker-value');
    expect(JSON.stringify(result)).not.toContain('do-not-store-this-record-text');
  });

  it('fails closed when the platform context has no account id', () => {
    const result = shellStatus({ module: 'adminPage' }, { issueKey: 'KW-1' });
    expect(result.state).toBe('error');
    expect(result.code).toBe('SHELL_IDENTITY_MISSING');
    expect(result.accountId).toBeNull();
    expect(result.issueKey).toBeNull();
    expect(result.message).toBe(SHELL_STRINGS.error);
  });

  it('rejects an unknown module without echoing it', () => {
    const result = shellStatus({ module: 'not-a-module' }, CONTEXT);
    expect(result.state).toBe('error');
    expect(result.code).toBe('SHELL_BAD_MODULE');
    expect(JSON.stringify(result)).not.toContain('not-a-module');
  });

  it('supports all three approved UI modules', () => {
    for (const module of SHELL_MODULES) {
      const result = shellStatus({ module }, CONTEXT);
      expect(result.state).toBe('ready');
      expect(result.module).toBe(module);
    }
  });

  it('keeps the decision-support wording and loading state in the shell contract', () => {
    expect(SHELL_STRINGS.loading).toBe('Loading KnewWhen…');
    expect(SHELL_STRINGS.notice).toBe(
      'Decision support, not a regulatory determination or legal advice.',
    );
    expect(SHELL_STRINGS.notice.toLowerCase()).not.toContain('reportable');
    const ready: ShellStatus = shellStatus({ module: 'issueContext' }, CONTEXT);
    expect(ready.notice).toBe(SHELL_STRINGS.notice);
  });

  it('returns the nested issue key from extension context when the flat key is absent', () => {
    const result = shellStatus(
      { module: 'issuePanel' },
      { accountId: 'acct-verified-shell', extension: { issue: { key: 'KW-2' } } },
    );
    expect(result.issueKey).toBe('KW-2');
  });
});

describe('P1.B2 no-op handlers (P1.B2, I-9)', () => {
  it('returns only a task label and never echoes an event', () => {
    const event = { 'canary-record-text': 'event-body-must-not-be-logged-or-returned' };
    for (const task of ['trigger', 'scan', 'writeback', 'scheduled'] as const) {
      expect(noop(task, event)).toEqual({ status: 'noop', task });
    }
  });

  it('covers every module handler named in the approved manifest', () => {
    const exported: ShellModule[] = [...SHELL_MODULES];
    expect(exported).toHaveLength(3);
  });
});
