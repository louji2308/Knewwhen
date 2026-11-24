/**
 * P6.A2/A3 — pure Signal Finder consumer (Arch §7, C-01.1–10, C-02.5, G-7).
 * It receives current record segments from an adapter, never trusts event
 * payload text, and keeps the fixed order: scope/own filter → segment diff →
 * lexicon → AI → one verbatim validator → evidence → case → initial trail →
 * SIGNAL_FLAG outbox. No @forge/* import, no clock, no random id and no model
 * call inside this module.
 */

import { screen, type Lexicon } from '../core/screener';
import { validateQuote } from '../core/validate';
import { hmacRecord, type HashKeyMaterial } from '../services/hash-key';
import { classifyEvidenceStrength } from '../services/evidence';
import { type CaptureSource, type EvidenceStrength } from '../contracts/evidence';
import {
  analyseWithLlm,
  type LlmFallbackCode,
  type LlmGateway,
  type LlmPolicy,
  type LlmState,
} from './scan/llm';
import { parseScanMessage, type ScanReasonCode } from '../contracts/scan';
import type { SqlRow } from './sql';

export interface ScanSegmentInput {
  readonly segmentKey: string;
  readonly text: string;
  readonly recordKind: 'COMMENT' | 'DESCRIPTION' | 'SUMMARY';
  readonly recordCreatedAt: string;
  readonly recordUpdatedAt: string;
  readonly authorAccountId: string;
  readonly changelogChecked: boolean;
  readonly changelogHadEdit: boolean;
  readonly isOwn?: boolean;
}

export interface ScanInput {
  readonly issueId: string;
  readonly scanId: string;
  readonly startedAt: string;
  readonly now: string;
  readonly timeoutMs: number;
  readonly rawMessage?: unknown;
  readonly segments: readonly ScanSegmentInput[];
  readonly lexicon?: Lexicon | undefined;
}

export interface CaptureCall {
  readonly id: string;
  readonly issueId: string;
  readonly segmentKey: string;
  readonly authorAccountId: string | null;
  readonly recordCreatedAt: string;
  readonly recordUpdatedAt: string;
  readonly segmentText: string;
  readonly quote: string;
  readonly capturedBy: CaptureSource;
  readonly strength: EvidenceStrength;
  readonly capturedAt: string;
  readonly scanId: string;
}

export interface ScanPorts {
  readonly key: HashKeyMaterial;
  capture(input: CaptureCall): Promise<{ inserted: boolean; row: SqlRow; span: string }>;
  findSegmentStates(issueId: string): Promise<readonly SqlRow[]>;
  saveSegmentState(row: SqlRow): Promise<SqlRow>;
  findCase(issueId: string): Promise<SqlRow | null>;
  createCase(row: SqlRow): Promise<SqlRow>;
  findTrailEntries(evidenceId: string): Promise<readonly SqlRow[]>;
  addRecord(row: SqlRow): Promise<SqlRow>;
  findTask(caseId: string, kind: string, dedupeKey: string): Promise<SqlRow | null>;
  enqueueTask(row: SqlRow): Promise<SqlRow>;
  saveScan(row: SqlRow): Promise<SqlRow | void>;
  now(): string;
  readonly llmGateway?: LlmGateway;
  readonly llmPolicy?: LlmPolicy;
  readonly llmState?: LlmState;
}

export interface ScanResult {
  readonly status: 'DONE' | 'DEFERRED' | 'FAILED';
  readonly result: 'SIGNAL' | 'NO_SIGNAL' | 'SKIPPED';
  readonly reasonCode: ScanReasonCode;
  readonly segmentsSeen: number;
  readonly segmentsScanned: number;
  readonly evidenceCount: number;
  readonly caseId: string | null;
  readonly aiReasonCode: LlmFallbackCode | null;
}

const strengthFor = (segment: ScanSegmentInput): EvidenceStrength =>
  classifyEvidenceStrength({
    kind: segment.recordKind,
    recordCreatedAt: segment.recordCreatedAt,
    recordUpdatedAt: segment.recordUpdatedAt,
    changelogChecked: segment.changelogChecked,
    changelogHadEdit: segment.changelogHadEdit,
  });

function bodyHash(keyValue: string, input: ScanInput, segment: ScanSegmentInput): string {
  return hmacRecord(keyValue, {
    version: 'segment-body-v1',
    kind: 'body',
    issueId: input.issueId,
    segmentKey: segment.segmentKey,
    text: segment.text,
  });
}

function segmentStateRow(
  input: ScanInput,
  segment: ScanSegmentInput,
  hash: string,
  keyId: string,
): SqlRow {
  return {
    issue_id: input.issueId,
    segment_key: segment.segmentKey,
    body_hash: hash,
    hash_key_id: keyId,
    extractor_version: 'segment-v1',
    state: 'SEEN',
    last_scan_id: input.scanId,
  };
}

async function persistScan(ports: ScanPorts, input: ScanInput, result: ScanResult): Promise<void> {
  const message = input.rawMessage === undefined ? null : parseScanMessage(input.rawMessage);
  await ports.saveScan({
    id: input.scanId,
    issue_id: input.issueId,
    trigger: message?.trigger ?? 'MANUAL',
    method: 'HYBRID',
    status: result.status,
    result: result.result,
    reason_code: result.reasonCode,
    lexicon_version: input.lexicon?.version ?? null,
    prompt_version: ports.llmPolicy?.promptVersion ?? null,
    model_id: ports.llmPolicy?.modelId ?? null,
    extractor_version: 'segment-v1',
    segments_seen: result.segmentsSeen,
    segments_scanned: result.segmentsScanned,
    quotes_proposed: result.evidenceCount,
    quotes_rejected: 0,
    started_at: input.startedAt,
    finished_at: ports.now(),
  });
}

/**
 * Runs one idempotent scan. `rawMessage` is validated when supplied; extra
 * claims in an event payload never reach this function's behaviour.
 */
export async function runScan(input: ScanInput, ports: ScanPorts): Promise<ScanResult> {
  if (input.rawMessage !== undefined && parseScanMessage(input.rawMessage) === null) {
    const invalid: ScanResult = {
      status: 'FAILED',
      result: 'SKIPPED',
      reasonCode: 'SCAN_FAILED',
      segmentsSeen: input.segments.length,
      segmentsScanned: 0,
      evidenceCount: 0,
      caseId: null,
      aiReasonCode: null,
    };
    await persistScan(ports, input, invalid);
    return invalid;
  }
  if (input.lexicon === undefined) {
    const degraded: ScanResult = {
      status: 'FAILED',
      result: 'SKIPPED',
      reasonCode: 'LEXICON_MISSING',
      segmentsSeen: input.segments.length,
      segmentsScanned: 0,
      evidenceCount: 0,
      caseId: null,
      aiReasonCode: null,
    };
    await persistScan(ports, input, degraded);
    return degraded;
  }

  const existing = await ports.findSegmentStates(input.issueId);
  const byKey = new Map(existing.map((row) => [String(row.segment_key), row]));
  const candidates: Array<{ segment: ScanSegmentInput; hash: string; row: SqlRow }> = [];
  let sawOnlyOwn = input.segments.length > 0;
  for (const segment of input.segments) {
    const hash = bodyHash(ports.key.value, input, segment);
    const row = segmentStateRow(input, segment, hash, ports.key.id);
    await ports.saveSegmentState(row);
    if (segment.isOwn === true) continue;
    sawOnlyOwn = false;
    if (byKey.get(segment.segmentKey)?.body_hash === hash) continue;
    candidates.push({ segment, hash, row });
  }
  if (candidates.length === 0) {
    const existingCase = await ports.findCase(input.issueId);
    const unchanged: ScanResult = {
      status: 'DONE',
      result: sawOnlyOwn ? 'SKIPPED' : existingCase !== null ? 'SIGNAL' : 'NO_SIGNAL',
      reasonCode: sawOnlyOwn ? 'SKIPPED_SELF' : 'UNCHANGED',
      segmentsSeen: input.segments.length,
      segmentsScanned: 0,
      evidenceCount: 0,
      caseId: null,
      aiReasonCode: null,
    };
    await persistScan(ports, input, unchanged);
    return unchanged;
  }
  if (
    Date.parse(input.now) - Date.parse(input.startedAt) >= input.timeoutMs ||
    candidates.length > 1
  ) {
    const deferred: ScanResult = {
      status: 'DEFERRED',
      result: 'SKIPPED',
      reasonCode: 'SCAN_TIMEOUT',
      segmentsSeen: input.segments.length,
      segmentsScanned: 0,
      evidenceCount: 0,
      caseId: null,
      aiReasonCode: null,
    };
    await persistScan(ports, input, deferred);
    return deferred;
  }

  const ruleHits = candidates.flatMap(({ segment }) => {
    const screened = screen(segment.text, input.lexicon);
    return screened.candidates.map((candidate) => ({ segment, quote: candidate.slice }));
  });
  let aiReasonCode: LlmFallbackCode | null = null;
  let llmProposals: readonly { segmentId: string; quote: string }[] = [];
  if (ports.llmGateway !== undefined && ports.llmPolicy !== undefined) {
    const llm = await analyseWithLlm(
      candidates.map(({ segment }) => ({ segmentId: segment.segmentKey, text: segment.text })),
      ports.llmGateway,
      ports.llmPolicy,
      ports.llmState ?? { issueCalls: 0, siteCalls: 0, invalidStreak: 0, breakerOpen: false },
    );
    if (llm.outcome.status === 'FALLBACK') aiReasonCode = llm.outcome.reasonCode;
    else llmProposals = llm.outcome.proposals;
  }

  const seen = new Set(ruleHits.map((hit) => `${hit.segment.segmentKey}:${hit.quote}`));
  const proposals: Array<{ segment: ScanSegmentInput; quote: string }> = [...ruleHits];
  for (const proposal of llmProposals) {
    const candidate = candidates.find(({ segment }) => segment.segmentKey === proposal.segmentId);
    if (candidate === undefined) continue;
    const validation = validateQuote(candidate.segment.text, proposal.quote);
    if (!validation.accepted) continue;
    const key = `${candidate.segment.segmentKey}:${validation.slice}`;
    if (!seen.has(key)) {
      seen.add(key);
      proposals.push({ segment: candidate.segment, quote: validation.slice });
    }
  }

  let evidenceCount = 0;
  let caseId: string | null = null;
  if (proposals.length > 0) {
    let caseRow = await ports.findCase(input.issueId);
    if (caseRow === null) {
      caseRow = await ports.createCase({
        id: globalThis.crypto.randomUUID(),
        anchor_issue_id: input.issueId,
        state: 'OPEN',
        created_at: input.startedAt,
      });
    }
    caseId = String(caseRow.id);
    for (const proposal of proposals) {
      const existingEntries = await ports.findTrailEntries(
        `capture:${proposal.segment.segmentKey}:${proposal.quote}`,
      );
      if (existingEntries.length > 0) continue;
      const capture = await ports.capture({
        id: `evidence-${globalThis.crypto.randomUUID()}`,
        issueId: input.issueId,
        segmentKey: proposal.segment.segmentKey,
        authorAccountId: proposal.segment.authorAccountId,
        recordCreatedAt: proposal.segment.recordCreatedAt,
        recordUpdatedAt: proposal.segment.recordUpdatedAt,
        segmentText: proposal.segment.text,
        quote: proposal.quote,
        capturedBy: 'RULE_MATCH',
        strength: strengthFor(proposal.segment),
        capturedAt: input.now,
        scanId: input.scanId,
      });
      evidenceCount += 1;
      await ports.addRecord({
        id: globalThis.crypto.randomUUID(),
        case_id: caseId,
        kind: 'RECORD',
        evidence_id: String(capture.row.id),
        source: 'RULE_MATCH',
        received_date_entered: null,
        entered_by: 'SYSTEM',
        entered_at: input.now,
        entered_note: null,
        status: 'PROPOSED',
        decided_by: null,
        decided_at: null,
        supersedes_id: null,
      });
      const dedupeKey = `${caseId}:${capture.row.id}`;
      if ((await ports.findTask(caseId, 'SIGNAL_FLAG', dedupeKey)) === null) {
        await ports.enqueueTask({
          id: globalThis.crypto.randomUUID(),
          case_id: caseId,
          kind: 'SIGNAL_FLAG',
          dedupe_key: dedupeKey,
          status: 'PENDING',
          attempts: 0,
          last_error_code: null,
          comment_id: null,
          created_at: input.now,
        });
      }
    }
  }

  const result: ScanResult = {
    status: 'DONE',
    result: proposals.length > 0 ? 'SIGNAL' : 'NO_SIGNAL',
    reasonCode:
      proposals.length === 0 ? 'NO_SIGNAL' : aiReasonCode !== null ? aiReasonCode : 'SIGNAL',
    segmentsSeen: input.segments.length,
    segmentsScanned: candidates.length,
    evidenceCount,
    caseId,
    aiReasonCode,
  };
  await persistScan(ports, input, result);
  return result;
}
