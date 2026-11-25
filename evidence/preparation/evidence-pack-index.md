# C-12 evidence-pack index — current state

**Date:** 25 Nov 2026 · **Baseline commit:** `de6230c` · **Status:** Partial; release pack **not complete** · **Requirement:** C-12 AC1–6

This index states only what exists. It does not convert local tests into running-product proof.

## Versions recorded in source

| Item | Version / seed | Source |
|---|---|---|
| Deadline engine | `deadline-engine-v1` | `src/core/deadlines.ts:20` |
| Normalisation | `normalise-v1` | `src/core/normalise.ts:11` |
| Lookback profile | `lookback-profile-v1` | `src/core/lookback-matcher.ts:16` |
| Generator | `generator-v1` | `src/core/generator.ts:15` |
| Lookback benchmark | `lookback-benchmark-v1` | `src/core/lookback-benchmark.ts:14` |
| Test seed | `20261124` | `package.json` / check evidence |
| Oracle seed and cases | `20261206`, 10,000 generated cases | `evidence/P4/oracle-agreement.txt`, full check evidence |

## C-12 AC1 — required contents

| Required item | Evidence that exists | Status / gap |
|---|---|---|
| Commit SHA | `evidence/P1/check-2026-11-25T07-23-53-563Z.txt` records the verified preparation base `de6230c…`. | Partial — final release-candidate SHA must be stamped when the A/B-verified build is frozen. |
| Engine, normaliser, lookback-profile versions | Version constants listed above. | Present in source; not yet assembled into a single release-candidate summary. |
| SHA-256 of every rule file | No `rules/*.json` files exist. | **Missing** — blocked by OI-1; regulatory content may not be invented. |
| Oracle seed and case count ≥ 10,000 | `evidence/P4/oracle-agreement.txt`; full check evidence, 10,000 cases with seed `20261206`. | Present. |
| Golden results | `evidence/P4/oracle-agreement.txt`; `tests/oracle-agreement.test.ts`, `tests/deadlines.test.ts`. | Present for synthetic arithmetic only; PS-2 legal-reading limit must accompany them. |
| Lookback benchmark: precision, recall, false-match rate, per tier/label, held-out split | `tests/lookback-benchmark.test.ts`, `tests/lookback-matcher.test.ts`, D-016 records HIGH precision `1` and MEDIUM precision `0`. | **Partial** — no standalone report with all requested metrics; no real labelled corpus. |
| Rule-screener metrics | `evidence/P3/screener-metrics.txt`. | Present; 7 synthetic segments, H5 miss reported honestly. |
| Recorded AI-path results; model not called by `npm run check` | `tests/llm-client.test.ts` proves fakes and parser paths; check evidence proves no live call in the gate. | **Missing** — no owner-approved controlled live call with synthetic data; DR-18 resources unavailable. |
| `forge lint` output | Full check evidence: “No issues found.” | Present on the local commit. |
| `forge eligibility` output | `evidence/P1/eligibility-app-a-2026-11-24T10-14-44-987Z.txt`. | Partial — old shell build; re-run on the final non-shell release candidate before any badge or listing claim. |
| Manifest parity report for App A and App B | Full check evidence: “MANIFEST CHECK: PASS (2 apps, 6 scopes, 10 modules, independent baseline intact)”; root manifest target `app-a`. | Present locally; U-B1-1 freeze review still pending. |
| Clean-site E2E log | `evidence/preparation/verification-a-scenarios.md` is a scenario list, not a run. | **Missing** — Verification A Blocked. |

## Other C-12 acceptance criteria

| AC | Evidence | Status |
|---|---|---|
| **AC2** — same seed reproduces results | Generator and oracle tests use fixed seeds; full check evidence records seed `20261124`; generator tests assert byte-identical output. | Partial — explicit release-candidate second run must be saved. |
| **AC3** — report unflattering results | `evidence/P3/screener-metrics.txt` reports the H5 miss; D-016 reports MEDIUM precision `0`; P10 review reports the in-flight UI fix as source-only. | Present. |
| **AC4** — state limits | Scope C-05 and Architecture §10.6 define oracle ≠ legal validation; CF-4 defines modified/unavailable evidence; Workflow §12 lists guide limitations. | Present in canonical sources; must be copied into the release pack. |
| **AC5** — tests and oracle dev-only, not deployed | Import-boundary evidence in full check: “no `@forge/*` outside adapters; no tests or oracle under `src/`”. | Partial — no deployed bundle inspection yet. |
| **AC6** — summary visible from README and listing validation notes | No root `README.md` exists; no listing has been drafted. | **Missing**. |

## Existing evidence files

| Path | What it supports |
|---|---|
| `evidence/P1/check-2026-11-25T07-23-53-563Z.txt` | Final local gate after ledger reconciliation: 67 test files, 519 tests, strict types, ESLint, Prettier, dependencies, imports, manifest parity, `forge lint`. |
| `evidence/P1/eligibility-app-a-2026-11-24T10-14-44-987Z.txt` | Earlier `forge eligibility` result; not a prize claim. |
| `evidence/P1/README.md` | P1 deploy/install/eligibility index and manifest candidate hashes; development shell only. |
| `evidence/P3/screener-metrics.txt` | Rule-screener precision/recall on 7 synthetic segments. |
| `evidence/P4/oracle-agreement.txt` | 11 golden cases plus 10,000 differential cases. |
| `evidence/P8/check-2026-11-25T04-55-04Z.txt` | P8 local lookback suites at the P8 checkpoint; superseded by the final full check. |
| `evidence/P9/local-proof.md` | P9 fail-closed rule-data seam and decision-service proof. |
| `evidence/P10/task-review.md` | RV-19…RV-26 task-review dispositions; not Verification A/B. |
| `evidence/P10/accessibility-checklist.md` | Local source-only accessibility checks; manual AA verification Blocked. |

## Gate to complete C-12

1. Supply QA/RA-reviewed rule data and record the SHA-256 of every rule file.
2. Run and record the single controlled synthetic live-model call; never call the model from `npm run check`.
3. Deploy the current non-shell build from a frozen commit to a clean outside-organisation site and execute all `VA-S*` scenarios.
4. Run independent Verification A and B on that exact commit; close Blocker/Major findings with regression tests.
5. Re-run `npm run check`, `forge lint` and `forge eligibility`; save a second deterministic run with the same seed.
6. Produce a standalone lookback benchmark report with every C-12 AC1 metric.
7. Add the evidence summary to a root README and the listing validation notes; state the four limits explicitly.
8. Complete manual accessibility and dark-mode proof, and the personal-data erasure cycle (U-5).

Until those steps are evidenced, C-12 is **Partial**, no phase is Accepted, and the app is not judge-ready.
