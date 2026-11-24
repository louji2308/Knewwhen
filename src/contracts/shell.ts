/**
 * P1.B2 — the smallest shared contract between the Forge shell handlers and UI.
 * It carries ids and fixed strings only. No Jira record text enters this module.
 */

export const SHELL_MODULES = ['issuePanel', 'adminPage', 'issueContext'] as const;

export type ShellModule = (typeof SHELL_MODULES)[number];

export const SHELL_STRINGS = Object.freeze({
  loading: 'Loading KnewWhen…',
  ready: 'KnewWhen shell is ready.',
  error: 'KnewWhen cannot identify this session. Reload the page or ask your administrator.',
  notice: 'Decision support, not a regulatory determination or legal advice.',
});

export type ShellStatusCode = 'SHELL_READY' | 'SHELL_IDENTITY_MISSING' | 'SHELL_BAD_MODULE';

export interface ShellStatus {
  readonly state: 'ready' | 'error';
  readonly code: ShellStatusCode;
  readonly module: ShellModule | 'unknown';
  readonly accountId: string | null;
  readonly issueKey: string | null;
  readonly message: string;
  readonly notice: string;
}
