/**
 * P5.D1 — gated Awareness resolvers. The gate supplies the authoritative role;
 * nothing in a payload can grant authority. Every response is an envelope with
 * ids, codes and dates only. A live Jira slice is fetched transiently for
 * re-validation and is never returned or persisted (I-1, I-4, I-6).
 */

import type { Action, GateContext, GateDecision, Role } from '../contracts/authorisation';
import type {
  AwarenessCaseView,
  AwarenessEntryView,
  AwarenessRoleHint,
  AwarenessView,
} from '../contracts/awareness';
import type { EnvelopeErrorCode, ResolverEnvelope } from '../contracts/envelope';
import type { AuditRepository } from '../services/audit';
import { revalidateEvidence, type LiveSegment } from '../services/evidence';
import type { HashKeyMaterial } from '../services/hash-key';
import type { Repositories } from '../services/repositories';
import type { SqlRow } from '../services/sql';
import { candidateDates, createTrailService } from '../services/trail';
import type { AuditSink, GatedHandler, RoleResolver } from './authorisation';

type AllowDecision = Extract<GateDecision, { readonly allow: true }>;

export type LiveSegmentLoader = (input: {
  readonly issueId: string;
  readonly segmentKey: string;
}) => Promise<LiveSegment>;

export interface AwarenessDependencies {
  readonly repositories: Repositories;
  readonly audit: AuditRepository;
  readonly trail: ReturnType<typeof createTrailService>;
  readonly liveSegment: LiveSegmentLoader;
  readonly currentKey: () => Promise<HashKeyMaterial | null>;
  readonly keyFor: (keyId: string) => Promise<string | null>;
  readonly now: () => string;
  /** App observation time is never an awareness basis (I-3). */
  readonly timeZone: string | null;
  readonly resolveRoles: RoleResolver;
  readonly recordAudit: AuditSink;
}

type Payload = Readonly<Record<string, unknown>>;

function asRecord(value: unknown): Payload | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Payload)
    : null;
}

function text(payload: Payload, field: string): string | null {
  const value = payload[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function flag(payload: Payload, field: string): boolean {
  return payload[field] === true;
}

function required(payload: Payload, field: string): string {
  const value = text(payload, field);
  if (value === null) throw new Error('TRAIL_INVALID');
  return value;
}

function success<T>(data: T, decision: AllowDecision): ResolverEnvelope<T> {
  return {
    data,
    roleHint: decision.role as AwarenessRoleHint,
    correlationId: globalThis.crypto.randomUUID(),
    code: 'OK',
  };
}

function failure(code: EnvelopeErrorCode, decision: AllowDecision | null): ResolverEnvelope<null> {
  return {
    data: null,
    roleHint: (decision?.role ?? 'UNKNOWN') as AwarenessRoleHint,
    correlationId: globalThis.crypto.randomUUID(),
    code,
  };
}

function errorCode(error: unknown): EnvelopeErrorCode {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'TRAIL_NOT_FOUND':
      return 'NOT_FOUND';
    case 'TRAIL_ROLE_DENIED':
      return 'NOT_PERMITTED';
    case 'TRAIL_INVALID':
    case 'TRAIL_AMBIGUOUS':
    case 'TRAIL_DATE_FUTURE':
    case 'CAPTURE_REJECTED':
      return 'INVALID_REQUEST';
    default:
      return 'DEPENDENCY_FAILED';
  }
}

async function handled<T>(
  decision: AllowDecision,
  work: () => Promise<T>,
): Promise<ResolverEnvelope<T | null>> {
  try {
    return success(await work(), decision);
  } catch (error) {
    return failure(errorCode(error), decision);
  }
}

function entryView(row: SqlRow, evidence: SqlRow | undefined): AwarenessEntryView {
  const status: AwarenessEntryView['status'] =
    row.status === 'CONFIRMED' || row.status === 'REJECTED' ? row.status : 'PROPOSED';
  const kind: AwarenessEntryView['kind'] = row.kind === 'ENTERED' ? 'ENTERED' : 'RECORD';
  return {
    entryId: String(row.id),
    kind,
    status,
    source: String(row.source),
    evidenceId: row.evidence_id === null ? null : String(row.evidence_id),
    validationStatus:
      evidence && typeof evidence.validation_status === 'string'
        ? evidence.validation_status
        : null,
    strength: evidence && typeof evidence.strength === 'string' ? evidence.strength : null,
    receivedDateEntered:
      typeof row.received_date_entered === 'string' ? row.received_date_entered : null,
    enteredAt: String(row.entered_at),
    decidedAt: typeof row.decided_at === 'string' ? row.decided_at : null,
    supersedesId: typeof row.supersedes_id === 'string' ? row.supersedes_id : null,
  };
}

export function createAwarenessHandlers(
  deps: AwarenessDependencies,
): Partial<Record<Action, GatedHandler>> {
  const caseRepository = deps.repositories.review_case;
  const entryRepository = deps.repositories.trail_entry;
  const evidenceRepository = deps.repositories.evidence_item;

  const caseView = async (caseId: string): Promise<AwarenessCaseView> => {
    const cases = await caseRepository.findBy({ id: caseId });
    if (cases.length === 0) throw new Error('TRAIL_NOT_FOUND');
    const record = cases[0]!;
    const entries = await entryRepository.findBy({ case_id: caseId });
    const evidenceIds = entries
      .map((entry) => entry.evidence_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const evidenceRows = await Promise.all(
      evidenceIds.map(async (id) => (await evidenceRepository.findBy({ id }))[0]),
    );
    const evidenceById = new Map<string, SqlRow>();
    evidenceIds.forEach((id, index) => {
      const row = evidenceRows[index];
      if (row) evidenceById.set(id, row);
    });
    const candidates = candidateDates(entries, evidenceById, deps.timeZone);
    return {
      kind: 'CASE_VIEW',
      caseId,
      state: String(record.state),
      origin: String(record.origin),
      createdAt: String(record.created_at),
      entries: entries.map((entry) =>
        entryView(
          entry,
          typeof entry.evidence_id === 'string' ? evidenceById.get(entry.evidence_id) : undefined,
        ),
      ),
      candidates: candidates.candidates.map((candidate) => ({
        entryId: candidate.entryId,
        basis: candidate.basis,
        effectiveDate: candidate.effectiveDate,
        reasonCode: candidate.reasonCode,
        observationAt: candidate.observationAt,
        strength: candidate.strength,
      })),
      preselectedEntryId: candidates.preselectedEntryId,
      preselectedBasis: candidates.preselectedBasis,
    };
  };

  const revalidate = async (payload: Payload, context: GateContext): Promise<AwarenessView> => {
    const evidenceId = required(payload, 'evidenceId');
    const rows = await evidenceRepository.findBy({ id: evidenceId });
    if (rows.length === 0) throw new Error('TRAIL_NOT_FOUND');
    const row = rows[0]!;
    const currentKey = await deps.currentKey();
    if (!currentKey) throw new Error('DEPENDENCY_FAILED');
    const oldKey = await deps.keyFor(String(row.hash_key_id));
    const result = await revalidateEvidence(evidenceRepository, {
      row,
      live: await deps.liveSegment({
        issueId: String(row.issue_id),
        segmentKey: String(row.segment_key),
      }),
      currentKey,
      keyFor: () => oldKey,
      audit: deps.audit,
      actorAccountId: context.accountId,
      at: deps.now(),
    });
    const entries = await entryRepository.findBy({ evidence_id: evidenceId });
    return {
      kind: 'REVALIDATION_VIEW',
      evidenceId,
      caseId: entries.length > 0 ? String(entries[0]!.case_id) : null,
      state: result.state,
      bodyEdited: result.bodyEdited,
      updated: result.updated,
    };
  };

  /**
   * The panel knows an issue key, not an internal case id. Resolve by the
   * anchor id; more than one case is ambiguous and never silently picked.
   */
  const resolveCaseId = async (payload: Payload): Promise<string> => {
    const direct = text(payload, 'caseId');
    if (direct !== null) return direct;
    const issueKey = text(payload, 'issueKey');
    if (issueKey === null) throw new Error('TRAIL_INVALID');
    const matches = await caseRepository.findBy({ anchor_issue_id: issueKey });
    if (matches.length === 0) throw new Error('TRAIL_NOT_FOUND');
    if (matches.length > 1) throw new Error('TRAIL_AMBIGUOUS');
    return String(matches[0]!.id);
  };

  const viewCase: GatedHandler = async (context, decision, raw) => {
    const payload = asRecord(raw) ?? {};
    if (flag(payload, 'revalidate')) {
      return handled(decision, () => revalidate(payload, context));
    }
    return handled(decision, async () => caseView(await resolveCaseId(payload)));
  };

  const addReceipt: GatedHandler = async (context, decision, raw) => {
    const payload = asRecord(raw) ?? {};
    return handled(decision, async () => {
      const caseId = required(payload, 'caseId');
      const cases = await caseRepository.findBy({ id: caseId });
      if (cases.length === 0) throw new Error('TRAIL_NOT_FOUND');
      const at = deps.now();
      await deps.trail.addEntered({
        caseId,
        source: 'HUMAN',
        receivedDateEntered: required(payload, 'receivedDate'),
        enteredBy: context.accountId,
        enteredAt: at,
        asOfDate: at.slice(0, 10),
        enteredNote: text(payload, 'note'),
        status: 'PROPOSED',
      });
      return caseView(caseId);
    });
  };

  const confirmRejectCorrect: GatedHandler = async (context, decision, raw) => {
    const payload = asRecord(raw) ?? {};
    return handled(decision, async () => {
      const entryId = required(payload, 'entryId');
      const before = (await entryRepository.findBy({ id: entryId }))[0];
      if (!before) throw new Error('TRAIL_NOT_FOUND');
      const caseId = String(before.case_id);
      const actor = {
        entryId,
        actorRole: decision.role as Role,
        actorAccountId: context.accountId,
        at: deps.now(),
      };
      if (flag(payload, 'reject')) {
        const reasonCode = required(payload, 'reasonCode') as NonNullable<
          Parameters<typeof deps.trail.reject>[0]['reasonCode']
        >;
        await deps.trail.reject({ ...actor, reasonCode });
      } else if (flag(payload, 'correct')) {
        const reasonCode = required(payload, 'reasonCode') as NonNullable<
          Parameters<typeof deps.trail.correct>[0]['reasonCode']
        >;
        await deps.trail.correct({
          ...actor,
          caseId,
          source: String(before.source),
          receivedDateEntered: required(payload, 'receivedDate'),
          enteredBy: context.accountId,
          enteredAt: actor.at,
          asOfDate: actor.at.slice(0, 10),
          enteredNote: text(payload, 'note'),
          reasonCode,
        });
      } else {
        await deps.trail.confirm(actor);
      }
      return caseView(caseId);
    });
  };

  return {
    VIEW_CASE: viewCase,
    ENTER_RECEIPT_DATE: addReceipt,
    CONFIRM_TRAIL_ENTRY: confirmRejectCorrect,
  };
}
