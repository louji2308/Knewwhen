import {
  SHELL_MODULES,
  SHELL_STRINGS,
  type ShellModule,
  type ShellStatus,
  type ShellStatusCode,
} from '../contracts/shell';

type Context = Readonly<Record<string, unknown>>;

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readRecord(value: unknown): Context | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Context)
    : null;
}

function issueKeyFrom(context: Context): string | null {
  const direct = readString(context['issueKey']);
  if (direct !== null) return direct;

  const extension = readRecord(context['extension']);
  if (extension === null) return null;
  const issue = readRecord(extension['issue']);
  return issue === null ? null : readString(issue['key']);
}

function moduleFrom(payload: unknown): ShellModule | null {
  const record = readRecord(payload);
  if (record === null) return null;
  const candidate = record['module'];
  return SHELL_MODULES.find((module) => module === candidate) ?? null;
}

/**
 * The resolver's identity comes only from the platform context. Payload fields
 * are data: they select a UI shell and are never copied into the response.
 */
export function shellStatus(payload: unknown, context: Context): ShellStatus {
  const accountId = readString(context['accountId']);
  if (accountId === null) {
    return status('error', 'SHELL_IDENTITY_MISSING', 'unknown', null, null, SHELL_STRINGS.error);
  }

  const module = moduleFrom(payload);
  if (module === null) {
    return status('error', 'SHELL_BAD_MODULE', 'unknown', accountId, null, SHELL_STRINGS.error);
  }

  return status(
    'ready',
    'SHELL_READY',
    module,
    accountId,
    issueKeyFrom(context),
    SHELL_STRINGS.ready,
  );
}

function status(
  state: ShellStatus['state'],
  code: ShellStatusCode,
  module: ShellStatus['module'],
  accountId: string | null,
  issueKey: string | null,
  message: string,
): ShellStatus {
  return {
    state,
    code,
    module,
    accountId,
    issueKey,
    message,
    notice: SHELL_STRINGS.notice,
  };
}
