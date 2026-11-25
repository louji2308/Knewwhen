# P10 independent task review dispositions

**Date:** 25 Nov 2026 · **Scope:** uncommitted P10 integration diff on `master` at base `154d8ce8a40b020cca711fcdfe993fbe1ccd62b2`.
**Review type:** two read-only task reviews under AGENTS §13.4, not Verification A or B. Both reviews were separate contexts from the builder.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| **RV-19** | Major | Settings-change and gate-denial audit events were emitted without an actor; the adapter hardcoded `SYSTEM` with a null actor id. | Fixed. `AuditEvent` carries an optional structured actor id from `GateContext` only; `actorFromAuditEvent` maps it to `USER`/`actor_account_id` and leaves absent actors as `SYSTEM`/null. Regression tests in `tests/authorisation.test.ts`, `tests/admin-handlers.test.ts` and `tests/audit.test.ts` failed for the intended reason before the fix and pass after it. Req: I-6, I-8, G-5, N-07. |
| **RV-20** | Minor | A comment said the no-port admin dispatcher returns `NOT_FOUND`; the gate denies first, so the live envelope is `NOT_PERMITTED`. | Fixed in `src/adapters/forge-resolver.ts`. The comment now distinguishes the live gate denial from the intended no-port state after approval. Req: I-11, C-10.5. |
| **RV-21** | Minor | `safeCount(..., required=true)` swallowed untyped errors and reported a down required source as zero. | Fixed in `src/services/health.ts`. Any required-source failure becomes `HEALTH_DEPENDENCY_FAILED`; optional sources still degrade honestly. Regression test updated in `tests/health-service.test.ts`. Req: N-09, G-8. |
| **RV-22** | Major | Health queried columns absent from the frozen migration (`scan.created_at`, `audit_event.created_at`, `usage_counter.counter_value`) and read `RECONCILER_RUN` without any producer. | Fixed. `src/services/health.ts` now queries `scan.started_at`, `audit_event.at` and `usage_counter.count`; `src/services/reconciler.ts` emits allow-listed `RECONCILER_RUN` on completion. `tests/health-service.test.ts` and `tests/reconciler-service.test.ts` assert the frozen column names and the emitted code. Req: C-10.8, N-09, I-6. |
| **RV-23** | Major | Reconciler cursor and ids accepted arbitrary free text, which could be persisted as the durable cursor. | Fixed. `src/services/reconciler.ts` validates stored cursors as empty or bounded numeric Jira issue ids, validates sweep ids numerically and other ids as bounded opaque pointers, and emits typed `CURSOR_INVALID`/`ID_SHAPE_INVALID` without echoing the text. Two new tests in `tests/reconciler-service.test.ts` prove no persistence and no canary leakage. Req: N-01(c), N-04, I-6. |
| **RV-24** | Major | Admin settings accepted overlong/control-bearing identity and version labels, and stored values were returned without re-parsing, allowing a truncated save-back. | Fixed. `src/services/admin-settings.ts` applies bounded printable validation to identity values, a 64-char `VERSION_CODE` label to rule-set versions, and `readAdminSettings` re-parses stored rows. `tests/admin-settings.test.ts` covers rejection and safe fallback. Req: C-10.1–4, I-6. |
| **RV-25** | Major | Admin save had no in-flight guard and a rapid double-save could duplicate audits or lose an update. | Fixed in `src/frontend/index.jsx` with `adminSaving` state, a `useRef` guard and a disabled save button. No browser test was run; this is a source-level fix only. Attribution to the caller was already fixed under RV-19. Req: C-10.4, N-07, I-8. |
| **RV-26** | Minor | The second sample load produced only a generic UI error, while the decision log claimed an explicit code; ledger and evidence paths were stale. | Fixed. `src/handlers/admin.ts` carries allow-listed `resultCode`, `src/frontend/sample-view.ts` shows the fixed `ALREADY_LOADED` message and rejects untrusted prose; `docs/08-decisions.md`, `evidence/P10/task-review.md` and `TODO.md` are reconciled. Req: C-08.9, AGENTS §14.4, §18.1. |

## Verified clean

- No Blocker finding in either review.
- Fail-closed production wiring: no settings store, Jira create, health or reconciler port is injected; no hidden demo path.
- Strict boundary parsers rebuild allow-listed fields only; canary probes are rejected.
- No `console.*`, `process.env`, `any`, new dependency, locked-file edit or record text in the changed source.
- Banned-wording scan found only the approved disclaimer and the phrase-list definition.
- Tests use fixed expectations and injected ports; no mocked-away requirement observed.

## Verification

- Targeted suites before the first fixes: 6 failures with the intended messages.
- Targeted suites after the second fixes: 5 files, 69 tests PASS (`health-service`, `reconciler-service`, `admin-settings`, `admin-handlers`, `sample-view`).
- Full `npm run check` after all fixes: **PASS**, 67 test files, **519 tests**, strict types, ESLint, Prettier, manifest parity, import boundary and `forge lint` (**No issues found**): `evidence/P1/check-2026-11-25T06-14-01-910Z.txt`.
- The second reviewer's own full check at `evidence/P1/check-2026-11-25T05-58-32-097Z.txt` passed with 512 tests before RV-22…RV-26 were fixed; it is superseded by the final evidence above.

## Not verified

- No deployed runtime, outside-organisation install, live Jira/SQL/KVS port, manual accessibility run or Verification A/B was performed. This review is not phase acceptance.
