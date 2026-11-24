import { makeResolver, type Request } from '@forge/resolver';
import type { ShellModule, ShellStatus } from '../contracts/shell';
import { shellStatus } from '../handlers/shell';

/**
 * P1.B2 — the only runtime bridge to @forge/resolver. The handler remains pure:
 * this adapter passes the platform context through and never logs its contents.
 */
interface ShellPayload {
  module?: ShellModule;
}

type ShellDefinition = {
  knewwhenShell: (request: Request<ShellPayload>) => ShellStatus;
};

const handlers: ShellDefinition = {
  knewwhenShell: (request) => shellStatus(request.payload, request.context),
};

export const resolverHandler = makeResolver(handlers);
