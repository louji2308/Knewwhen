# Verification B — adversarial engineering checklist (preparation)

**Date:** 25 Nov 2026 · **Status:** Checklist only; independent adversarial execution **pending** · **Not a Verification B report**

## Independence protocol

Verification B must be a separate context from the builder and from Verification A. It reads the canonical files, source, tests and data flow. It completes and commits its own initial findings before the orchestrator shows it A's findings (AGENTS §13.3, Implementation plan §6). Findings are reported with command output, file/line evidence, severity and requirement IDs. A different model family is not available in this harness; that is a recorded limitation, not a pass.

## Checklist

| ID | Focus | Attack or mutation to attempt | Local evidence available now | Runtime proof still required | Status |
|---|---|---|---|---|---|
| **VB-01** | Server authority | Forge resolver payloads that claim roles, rule status, product key, answer codes, timestamps or Jira text. | `tests/authorisation.test.ts`, `tests/operation-dispatch.test.ts`, `tests/decision-handlers.test.ts`; `GateContext.roles` removed in D-013. | Live resolver with forged payloads on the deployed build. | Pending independent |
| **VB-02** | Identity model | Viewer/Reviewer/QP/admin-without-role and browse-denied combinations; dependency failure must deny. | Frozen 12-action × 4-role × 2-browse matrix in `tests/authorisation.test.ts`. | Real platform context and browse check. | Pending; role source absent |
| **VB-03** | As-user vs as-app | Make as-app scan/search results visible without an as-user re-fetch. | Jira client contract and `tests/jira-client.test.ts`. | Live demo-site read with a restricted issue. | Pending |
| **VB-04** | Jira write allow-list | Reach any write outside the five approved operations; generic delete/update must be unrepresentable. | `src/services/jira-client.ts`, `tests/jira-client.test.ts`, manifest snapshot. | Live write trace from the deployed app. | Pending |
| **VB-05** | Canary and privacy | Send canary text through SQL, KVS, logs, errors, properties, comments, audit details and UI. | `tests/canary.test.ts`, `tests/logger.test.ts`, `tests/audit.test.ts`, `tests/writeback-service.test.ts`. | Canary run on the live app and `forge logs`. | Pending |
| **VB-06** | Untrusted content | Prompt injection in ADF, SQL metacharacters, markup and huge Unicode input; nothing may be executed as instructions. | `tests/llm-client.test.ts`, `tests/validate.test.ts`, `tests/normalise.test.ts`, `tests/jira-client.test.ts`. | Live synthetic adversarial records. | Pending independent |
| **VB-07** | Verbatim validator | Break the validator on purpose; confirm golden and property tests fail. Try non-verbatim, reordered, case-changed and placeholder quotes. | `tests/validate.test.ts`, `tests/normalise.test.ts`, `tests/property.smoke.test.ts`. | Mutation proof by B in its own context. | Pending |
| **VB-08** | Evidence hash/key | Change issue, segment, normalisation version or key; confirm HMAC binding and key rotation do not silently validate old evidence. | `tests/evidence.test.ts`, `tests/hash-key.test.ts`. | Live secret store and rotation path. | Pending; key store absent |
| **VB-09** | Append-only | Try update/delete of confirmations, calculations, decisions and audit events; check supersession instead. | Repository interfaces in `src/services/repositories.ts`, `tests/p5-properties.test.ts`, `tests/audit.test.ts`. | Live SQL trace. | Pending |
| **VB-10** | Concurrency and replay | Duplicate, late and out-of-order triggers; crash between scan, case, evidence, trail and outbox; confirm/reject race; double-finalise. | `tests/p5-properties.test.ts`, `tests/scan-service.test.ts`, `tests/decision-service.test.ts`, `tests/reconciler-service.test.ts`. | Live replay with injected faults. | Pending |
| **VB-11** | Jira budget and retries | Exhaust call budget, send 429 with `Retry-After`, 5xx and malformed bodies; check no retry storm and no body echo. | `tests/jira-client.test.ts`. | Live 429/5xx simulation or approved fake boundary. | Pending |
| **VB-12** | Lookback | JQL injection through quote terms, cap bypass, cross-user cache, rejected-candidate resurfacing, benchmark split leakage, probability wording. | `tests/lookback-jql.test.ts`, `tests/lookback-service.test.ts`, `tests/lookback-matcher.test.ts`, `tests/lookback-benchmark.test.ts`; CF-P8-1 logged. | Live as-user search and adversarial corpus. | Pending |
| **VB-13** | Deadline engine | Inject an off-by-one; confirm the independent oracle and goldens fail. Search for hidden constants, common-mode rule data, bad holiday/year boundaries and `Intl` timezone assumptions. | `oracle/deadline-oracle.ts`, `tests/oracle-agreement.test.ts` (10,000 cases, seed `20261206`), `tests/deadlines.test.ts`; PS-2 logged. | QA/RA rule data and mutation proof by B. | Pending |
| **VB-14** | AI path | Kill-switch timing at all three checkpoints, malformed model output, prompt injection, breaker races, model I/O persistence, hidden live call in tests. | `tests/llm-client.test.ts`; `npm run check` never calls the model. | One owner-approved live synthetic call with result tables only. | Pending; DR-18 access/cost gate |
| **VB-15** | Admin boundary | Unsafe settings, overlong labels, kill-switch race, duplicate save, actor attribution and denial audits. | `tests/admin-settings.test.ts`, `tests/admin-handlers.test.ts`, `tests/admin-view.test.ts`; RV-19…RV-26 dispositions in `evidence/P10/task-review.md`. | Live admin actions and audit rows. | Pending |
| **VB-16** | Sample loader | Create outside watched projects, sixth Jira write, formula injection in CSV, double load, sample-specific behavior. | `tests/sample-loader.test.ts`, `tests/sample-view.test.ts`, `tests/csv.test.ts`, `tests/generator.test.ts`. | Live create/import on synthetic project. | Pending |
| **VB-17** | Reconciler and health | Run twice, corrupt cursor/ids, force health dependency failure, query columns outside the frozen migration. | `tests/reconciler-service.test.ts`, `tests/health-service.test.ts`, `tests/scheduled-handler.test.ts`; RV-21/RV-22/RV-23 fixed. | Live scheduled run and SQL observation. | Pending |
| **VB-18** | Personal data | Verify tombstone/erasure cycle and account-id handling. | Account-id actor mapping in D-019; no erasure cycle implemented. | Live personal-data cycle proof. | Blocked — U-5 |
| **VB-19** | Distribution and guards | Scope/module drift, key-order or comment parity bypass, `--no-verify`, uninstalled hook, secret in public files, manifest freeze. | `tests/manifest.test.ts`, `scripts/check-manifests.mjs`, `scripts/hooks/pre-commit.mjs`, `evidence/P1/README.md`; GV-1 and U-B1-1 logged. | Freeze review and outside-org build parity. | Pending |
| **VB-20** | Test quality | Find tests that mirror implementation, mock away the requirement, use weak assertions or hide failures. Mutation-check at least one core, one service and one view test. | Test suites named above; full gate evidence `evidence/P1/check-2026-11-25T06-14-01-910Z.txt`. | B's own mutation report on the current commit. | Pending |

## Required output format

1. Initial findings file and hash, committed before A's report is shown.
2. Per finding: ID, severity, requirement IDs, file/line or command evidence, reproduction, concrete failure in the product.
3. Fix verification: builder adds a regression test; B re-runs the affected check; if unsure, re-run both A and B.
4. Final verdict: **PASS** only with no open Blocker or Major on the current commit. Otherwise **FAIL** or **Blocked** with named dependencies.

## Current outcome

No independent Verification B has been performed on the P10 current tree. The task reviews in `evidence/P10/task-review.md` are read-only task reviews under AGENTS §13.4, not Verification B and not phase acceptance.
