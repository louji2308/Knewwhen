/**
 * P10.A3 — sample scenario loader (C-08.1-9, G-10, I-11/I-12, I-6).
 * Pure service: Jira issue creation and the claim are injected ports. The same
 * generated records go through the normal scan path; there is no hidden demo
 * code path.
 *
 * PA-4 is unresolved. D-018 chooses an explicit refusal, and this revision
 * adds a bounded claim plus a resumable, counted partial result. The app never
 * deletes: C-08.7 documents admin cleanup by JQL outside this app.
 */

import {
  assertSyntheticFixtures,
  generateScenarios,
  GENERATOR_VERSION,
  JUDGE_SEED,
} from '../core/generator';
import type { AdminSettings } from './admin-settings';

export const SAMPLE_LABEL = 'knewwhen-sample';

const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,19}$/u;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F-\u009F]/u;
const MAX_AUTHOR_ID_LENGTH = 128;

export interface SampleIssueInput {
  readonly projectKey: string;
  readonly ref: string;
  readonly scenario: string;
  readonly origin: 'CSV' | 'SAMPLE';
  readonly summary: string;
  readonly description: string;
  readonly labels: readonly string[];
  readonly createdISO: string;
  /** Stable under retry; derived from version, seed, anchor date and ref only. */
  readonly idempotencyKey: string;
  readonly comments: readonly {
    readonly date: string;
    readonly accountId: string;
    readonly body: string;
  }[];
}

export interface SampleIssueRef {
  readonly id: string;
  readonly key: string;
}

export interface SampleLoaderPort {
  /** Atomic single-writer claim; false means another or recent load holds it. */
  claimLoad(projectKey: string, claimKey: string): Promise<boolean>;
  releaseLoad(projectKey: string, claimKey: string): Promise<void>;
  /** Refs (H1..A2) already created in this project, for resumable loading. */
  listCreatedRefs(projectKey: string): Promise<readonly string[]>;
  createIssue(input: SampleIssueInput): Promise<SampleIssueRef>;
}

export interface LoadSampleInput {
  readonly projectKey: string;
  readonly anchorDateISO: string;
  readonly authorAccountId: string;
}

interface SampleCounts {
  readonly createdCount: number;
  readonly totalCreatedCount: number;
  readonly issueKeys: readonly string[];
}

export type SampleLoadSuccess = {
  readonly ok: true;
  readonly csvRecordCount: number;
} & SampleCounts;

export type SampleLoadPartialFailure = {
  readonly ok: false;
  readonly code: 'PARTIAL_LOAD';
  readonly remainingCount: number;
} & SampleCounts;

export type SampleLoadSimpleCode =
  'INVALID_REQUEST' | 'PROJECT_NOT_WATCHED' | 'ALREADY_LOADED' | 'DEPENDENCY_FAILED';

export type SampleLoadResult =
  | SampleLoadSuccess
  | SampleLoadPartialFailure
  | { readonly ok: false; readonly code: SampleLoadSimpleCode };

/** Mutable only inside one claimed call; never exposed to a caller. */
interface LoadProgress {
  createdCount: number;
  totalCreatedCount: number;
  remainingCount: number;
  issueKeys: string[];
}

function validCalendarDate(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  // Date.parse silently rolls 2026-02-31 forward, so require an exact round trip.
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validRequest(input: LoadSampleInput): boolean {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof input.projectKey === 'string' &&
    PROJECT_KEY_PATTERN.test(input.projectKey) &&
    typeof input.anchorDateISO === 'string' &&
    validCalendarDate(input.anchorDateISO) &&
    typeof input.authorAccountId === 'string' &&
    input.authorAccountId.length >= 1 &&
    input.authorAccountId.length <= MAX_AUTHOR_ID_LENGTH &&
    !CONTROL_CHARACTER_PATTERN.test(input.authorAccountId)
  );
}

/** Version, fixed seed and anchor date only: no account id or record text. */
function claimKeyFor(input: LoadSampleInput): string {
  return `${GENERATOR_VERSION}:${JUDGE_SEED}:${input.anchorDateISO}`;
}

function countsOf(progress: LoadProgress): SampleCounts {
  return {
    createdCount: progress.createdCount,
    totalCreatedCount: progress.totalCreatedCount,
    issueKeys: [...progress.issueKeys],
  };
}

function partialOf(progress: LoadProgress): SampleLoadPartialFailure {
  return {
    ok: false,
    code: 'PARTIAL_LOAD',
    ...countsOf(progress),
    remainingCount: progress.remainingCount,
  };
}

/** A release failure after work must not be reported as a clean success. */
function failureAfterRelease(progress: LoadProgress): SampleLoadResult {
  return progress.createdCount > 0 ? partialOf(progress) : { ok: false, code: 'DEPENDENCY_FAILED' };
}

async function loadClaimed(
  port: SampleLoaderPort,
  input: LoadSampleInput,
  claimKey: string,
  progress: LoadProgress,
): Promise<SampleLoadResult> {
  const generated = generateScenarios({
    seed: JUDGE_SEED,
    anchorDateISO: input.anchorDateISO,
    authorAccountId: input.authorAccountId,
  });
  assertSyntheticFixtures(generated);

  const existing = new Set(await port.listCreatedRefs(input.projectKey));
  const missing = generated.records.filter((record) => !existing.has(record.ref));
  progress.totalCreatedCount = generated.records.length - missing.length;
  progress.remainingCount = missing.length;
  if (missing.length === 0) return { ok: false, code: 'ALREADY_LOADED' };

  for (const record of missing) {
    try {
      const created = await port.createIssue({
        projectKey: input.projectKey,
        ref: record.ref,
        scenario: record.scenario,
        origin: record.origin,
        summary: record.summary,
        description: record.description,
        labels: [...record.labels, SAMPLE_LABEL],
        createdISO: record.createdISO,
        idempotencyKey: `${claimKey}:${record.ref}`,
        comments: record.comments.map((comment) => ({
          date: comment.date,
          accountId: comment.accountId,
          body: comment.body,
        })),
      });
      progress.issueKeys.push(created.key);
      progress.createdCount += 1;
      progress.totalCreatedCount += 1;
      progress.remainingCount -= 1;
    } catch {
      // Never hide work already committed by this call behind a generic code.
      return partialOf(progress);
    }
  }

  return {
    ok: true,
    ...countsOf(progress),
    csvRecordCount: generated.csvTable.rows.length,
  };
}

/**
 * Load only the missing frozen scenarios into one watched project. Results
 * carry counts and issue keys only: no summary, description, quote, comment
 * body, account id or claim key is ever placed in a result, envelope or log.
 */
export async function loadSampleScenario(
  settings: AdminSettings,
  port: SampleLoaderPort,
  input: LoadSampleInput,
): Promise<SampleLoadResult> {
  if (!validRequest(input)) return { ok: false, code: 'INVALID_REQUEST' };
  if (!settings.watchedProjects.includes(input.projectKey)) {
    return { ok: false, code: 'PROJECT_NOT_WATCHED' };
  }

  const claimKey = claimKeyFor(input);
  try {
    if (!(await port.claimLoad(input.projectKey, claimKey))) {
      return { ok: false, code: 'ALREADY_LOADED' };
    }
  } catch {
    return { ok: false, code: 'DEPENDENCY_FAILED' };
  }

  const progress: LoadProgress = {
    createdCount: 0,
    totalCreatedCount: 0,
    remainingCount: 0,
    issueKeys: [],
  };
  let result: SampleLoadResult;
  try {
    result = await loadClaimed(port, input, claimKey, progress);
  } catch {
    result =
      progress.createdCount > 0 ? partialOf(progress) : { ok: false, code: 'DEPENDENCY_FAILED' };
  }

  try {
    await port.releaseLoad(input.projectKey, claimKey);
  } catch {
    result = failureAfterRelease(progress);
  }
  return result;
}
