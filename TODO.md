# KnewWhen — TODO (execution ledger)

**Version:** 1.3 · **Date:** 24 Nov 2026 · **Owner:** Orchestrator (single writer, AGENTS §9.2)
**Authority:** built from the canonical documents in `docs/Project/` (read-only, AGENTS §2.7). This file records progress; it is **not** proof and **not** a source of scope (AGENTS §14.1).
**Status words:** Not Started · Ready · In Progress · In review · Blocked · Completed (tasks, AGENTS §14.3). Phase status: Not started · Active · Awaiting verification · Accepted.
**Verified baseline:** branch `master` · pushed commit `f3d294bb8233739a8de299fdd304a4c8518791af` · tracks `origin/master` at the same SHA · clean worktree before the D-008 ledger update. The governance/checkpoint commit for D-008 is the next commit (see `git log -1` after it is made).

---

## 1. Phase index

| ID | Name | Status | Entry condition | Exit condition | Owner | Critical? | Link |
|---|---|---|---|---|---|---|---|
| **PREP-0** | Bootstrap and contract readiness *(preparatory ledger phase; not an implementation phase)* | **Active** | Owner approved bootstrap and creation of this ledger | Repository state and capability gaps recorded; owner decisions on CF/OI and the missing plan/rule inputs either made or explicitly carried as Blocked; implementation index defined | Orchestrator | — | §2 |
| **P0** | Bootstrap, capability proof, decision packet | **Not started** | Plan approved | Capability record, `docs/platform-facts.md`, decision packet, external-status record, `evidence/P0/` complete | ORC | Yes | §3.1 |
| **P1** | Repository, toolchain, installable Forge shell | **Active** *(partial: A1–A4 only; formal entry conditions still open)* | P0.A1, A2, A3, B2 | `npm run check` green; hook tested; shell deployed and installed; parity passes; `evidence/P1/` | BE-1 / FA | Yes | §3.2 |
| **P2** | Platform foundation services | **Awaiting verification** | P1 shell deployed; P0.B1 facts; P2.D2 contracts pinned | Migrations, gate, Jira client, logger, settings/hash/audit; `evidence/P2/` — all eight tasks complete locally (128 tests); plan integration checkpoints on the demo site and PF-SQL-2 live validation still open, so not Accepted under §13 | BE-1…BE-4 | Yes | §3.3 |
| **P3** | Pure core A: evidence core and scenario generator | **Awaiting verification** | P1 toolchain; P3 contract tasks | Normaliser, validator, screener, corpus, generator; `evidence/P3/` — all eight tasks green locally (185 tests total); real lexicon and version-freeze tag still open, so not Accepted under §13 | BE-1…BE-3 / TE | Feeder | §3.4 |
| **P4** | Pure core B: deadline engine, rules loader, oracle | **Awaiting verification** | P1 toolchain; P4.A0 contract | Engine, independent oracle, ≥10,000-case differential run, golden cases; `evidence/P4/` — all tasks green locally incl. 10,000-run differential (seed `20261206`); real QA/RA rule data still Blocked, so not Accepted under §13 | BE-1 / TE-O | Feeder | §3.5 |
| **P5** | Evidence and Trail services | **Active** | P2 contracts; P3 IF-1/IF-2 accepted; P5.0 pinned | Evidence lifecycle, trail state machine, FE trail slice; `evidence/P5/` — services and A/B tasks green locally; C1/C2 FK reports, D1 resolvers and D2 FE slice remain; not Accepted under §13 | BE-1 / BE-2 / FE | Yes | §3.6 |
| **P6** | Signal Finder and capture | **Not started** | P5 IF-8/IF-9; P3 and P2 accepted; P6.0 pinned | Trigger, scan consumer, AI fake/tests, record path, FE tab; `evidence/P6/` | BE-1 / BE-2 / TE | Near | §3.7 |
| **P7** | Write-back outbox | **Not started** | P2 IF-6/IF-7; P7.A0 schema; P7.0 pinned | Outbox, property, comment, retry, visibility fail-closed; `evidence/P7/` | BE-4 / FA | Feeder | §3.8 |
| **P8** | Lookback and benchmark | **Not started** | P5 accepted; P3 generator/normaliser; P8.0 pinned | Matcher/ranker, lookback service, benchmark, FE tab; `evidence/P8/` | BE-2 / TE / FE | Yes (co-critical) | §3.9 |
| **P9** | Deadlines, decision record, rule-status gating | **Not started** | P4 + P5 + P7 accepted; question-set state known | Deadline service, decision service, write-back, FE slices; `evidence/P9/` | BE-3 / BE-4 / FE | Yes (co-critical) | §3.10 |
| **P10** | Product surfaces, admin, sample, reconciler | **Not started** | Admin slice: P2 accepted; rest: P6, P8, P9 | Admin, sample, case header, reconciler, polish; `evidence/P10/` | FE / BE-1 / BE-3 | Yes | §3.11 |
| **P11** | Should tier | **Not started** | P9 accepted; Core stable; M-1 decisions fixed | Each shipped Should item passes its ACs, or is cut by record | BE-3 / BE-1 / FE | No | §3.12 |
| **P12** | Marketplace track and App A submission | **Not started** | M-1; installable P6+P7 slice; partner status known | Outside-org install; listing/privacy pages; submission ticket URL; `evidence/P12/` | OWN / RD / SP | Parallel | §3.13 |
| **P13** | Release-candidate QA, security, evidence pack | **Not started** | P10 accepted; P11 accepted or cut | Whole-product A and B, evidence pack; `evidence/P13/` | ORC / SP / TE | Yes | §3.14 (gap) |
| **P14** | Judge-ready build, demo and submission | **Not started** | P13 accepted; P12 submitted | Judge-ready build, demo, owner submission | RD / OWN | Yes | §3.14 (gap) |

**Note (AGENTS §14.5):** implementation phase sections below are derived from `Implementation plan.md` §10. The file is **Approved v0.1** (D-003, 24 Nov 2026) and its task tables end at P12; P13/P14 are named in the index but have no task sections in the file. D-008 (owner ruling, 24 Nov 2026) approves a **draft** P13/P14 task list in §3.14; it is not a replacement for the missing canonical sections (§3.14).

---

## 2. Active phase — PREP-0 Bootstrap and contract readiness

**Entry condition:** owner approval of the bootstrap and `TODO.md` creation (23 Nov 2026).
**Exit condition:** verified repository/capability state recorded; blocking inputs resolved or explicitly escalated; implementation phase index and available task checklists defined from `Implementation plan.md`.
**Owner:** Orchestrator.

| Task ID | Task | Requirement IDs / enabling | Dependencies | Status | Evidence | Blockers |
|---|---|---|---|---|---|---|
| **PREP-0.1** | Read `AGENTS.md` in full and all canonical files at session start; report missing files | AGENTS §6.1–6.2; enables C-01–C-12, N-06 | None | **Completed** | `AGENTS.md` (475 lines); eight present canonical docs read to last line: `Idea.md` (112), `Hackathon.md` (458), `Winner Benchmarks.md` (233), `Tools and technologies.md` (177), `Architecture.md` (1174), `Scope.md` (516), `Workflow and UI demo.md` (1101), `Implementation plan.md` (682). Missing files recorded in §5.4 | — |
| **PREP-0.2** | Run bootstrap and capability checks (Git, Node/npm/Forge, hooks, ECC inventory) | AGENTS §0.1, §6.5, §19.1, Appendix A.3; enables N-03, N-06, C-12 | None | **Completed** | 23 Nov output: `master...origin/master`; `node -v` → `v26.13.1`; `npm -v` → `11.20.0`; `forge --version` → `15.1.0` with Node 22.x/24.x warning; `CLAUDE.md` absent; `package.json` absent; pre-commit hook absent. ECC 2.2.3 / doctor OK from the recorded 23 Nov install | — |
| **PREP-0.3** | Reconstruct actual progress from repository and evidence; write recovery note | AGENTS §6.4, §14.4; enables all | PREP-0.1, PREP-0.2 | **Completed** | Verified state in §6 and the session report; mismatch recorded (TODO absent, plan absent at first read, Node warning) | — |
| **PREP-0.4** | Create and maintain this ledger outside `docs/Project/` | AGENTS §14.1–14.6, §2.7; enables all | PREP-0.3 | **Completed** | Commit `740ccf2`; this file | — |
| **PREP-0.5** | Owner decision on Scope conflicts CF-1 to CF-7 | C-01–C-12; AGENTS §2.6, §7.3–7.4 | `Scope.md` approval; owner | **Completed** | D-008 records all seven rulings verbatim with date; dispositions in §5.1 | Canonical wording updates remain pending in `docs/Project/`; no edit made there. |
| **PREP-0.6** | Owner decision on Scope open items OI-1 to OI-10 | C-01–C-12, C-05/C-06/C-01 (OI-1), C-07 (OI-8); AGENTS §5.5 | Owner; supplied rule inputs | **Completed** | D-008 records all ten rulings verbatim with date; dispositions in §5.2 | Rule data and outside evidence still absent; OI-4 values are Proposed, not rule data; OI-2 remains Unverified. |
| **PREP-0.7** | Supply, approve and track `Implementation plan.md`; create implementation phase sections from its task tables | AGENTS §2.1, §11.1, §14.5 | Owner supplied the file | **Completed** | `docs/Project/Implementation plan.md` (682 lines) read to last line; owner approval D-003 (24 Nov 2026); plan tracked in Git; phase index and P0–P12 checklists in §3; P13/P14 gap in §3.14 | — |
| **PREP-0.8** | Supply approved locked inputs: `IMPLEMENTATION_PLAN.md` §2.11, `docs/02-spec.md`, `docs/03-domain-rules.md`, `rules/*.json` | I-7; C-05, C-06, C-01; OI-1; AGENTS §2.2, §7.2 | Owner | **Blocked** | `Scope.md` §0, §5.2 OI-1; `Architecture.md` §1.1 U-1 | Blocked by: owner. Regulatory content may not be invented (I-7). |
| **PREP-0.9** | Verify the A-11 platform assumptions before use (storage, queue/events, LLM, Jira visibility/UI, JSM, Marketplace, six scopes) | C-07, C-08, S-03, N-04; OI-8; N-03(a); AGENTS §17.5 | Official documentation access | **Completed** | `docs/platform-facts.md` v1.0: 4 parallel read-only agents, official URLs and 24 Nov 2026 access dates, orchestrator spot-checks, §7 discrepancy log, §8 scope mapping; 33 facts Verified and 6 Unresolved with named fallbacks | — |
| **PREP-0.10** | Resolve local runtime mismatch: select a Forge-supported Node line | Tools §4; N-06; AGENTS §12.1 | Owner decision D-005 | **Completed** | `nvm install 24` → 24.22.3; `nvm use 24.22.3`; `nvm list` → `* 24.22.3 (default)`; fresh-shell `node -v` → `v24.22.3`; `forge --version` → `15.1.0` with no Node warning; D-005 | — |
| **PREP-0.11** | Add `CLAUDE.md` containing only `@AGENTS.md` | Tools §6; enables all builder tasks | Owner decision D-004 | **Completed** | `CLAUDE.md` created with one line `@AGENTS.md`; D-004 | — |
| **PREP-0.12** | Define the first implementation task and the critical path once PREP-0.5–0.8 are cleared | C-01–C-12; AGENTS §11.1–11.4 | PREP-0.5–PREP-0.8 | **Blocked** | Approved plan §4 names `P0 → P1 → P2 → P5 → {P8 ∥ P9} → P10 → P13 → P14` as critical path (D-003) | D-008 cleared most CF/OI/WF decisions; still Blocked by QA/RA rule data (`OI-1`), missing locked files, Forge token/site (CG-3/4), outside organisation and verifier contexts. |
| **PREP-0.13** | Draft OI-4 operating defaults and WF-14 property/JQL projection for owner approval | OI-4, WF-14; C-01, C-03, C-05, C-07, C-11; N-03, N-04 | D-008 | **Completed** | `docs/proposals/oi-4-operating-defaults.md`; `docs/proposals/wf-14-case-index-projection.md` | Both approved by D-009; files updated to v1.0. |
| **PREP-0.14** | Record D-009 blanket approval, resolve WF-14-C1/C2 and push checkpoint | CF-1, WF-14, OI-4; AGENTS §7.4, §15.6 | D-008, PREP-0.13 | **Completed** | `docs/08-decisions.md` D-009; this ledger v1.1; `docs/platform-facts.md` v1.3; commits `9214e28` + D-009 checkpoint | No remaining decision blocker; access inputs still Blocked. |

**Task status changes:** update a row when the status changes, not in batches (AGENTS §14.6). Mark `Completed` only after the ACs pass and the evidence exists (§14.4).

---

## 3. Implementation phase sections (derived from `Implementation plan.md`)

### 3.0 Plan status and reading rule

- `docs/Project/Implementation plan.md` was supplied by the owner, read in full to line 682, and **approved as v0.1 on 24 Nov 2026** (D-003). It is tracked in Git; its contents were not edited. Every task below still starts **Not Started** because no implementation or acceptance evidence exists.
- No implementation has begun. `docs/Project/` was not modified. Tracking the plan in Git is a repository change, not an edit to the read-only canonical file.
- Task IDs, requirement references, dependencies and owners are taken from the plan's §10 tables. The `Evidence` column states the required proof; it is not a claim that proof exists.
- The plan references a §12 decision register (`DR-1`…`DR-18`) and P13/P14 phase sections; neither is present in the supplied file. This is logged in §5.5 and §3.14.

### 3.1 P0 — Bootstrap, capability proof, decision packet

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P0.A1 | AGENTS A.3, §19 | — | ORC + OWN | **Not Started** | Command output with dates; repository reconciled | Plan approval |
| P0.A2 | AGENTS §9.3, §13, B-2 | A1 | ORC | **Not Started** | Worktree and second-context proof, or owner decision | Plan approval |
| P0.A3 | Tools §7, Hackathon §14, CG-3/CG-4 | A1 | OWN | **Not Started** | Forge/token/site/user setup without secrets | Forge API token, email, provisioned site and outside organisation not supplied (D-008; `docs/platform-facts.md` §12) |
| P0.A4 | AGENTS §2.3, PC-6 | A1 | ORC | **Not Started** | File-name mapping in decision log | Plan approval |
| P0.B1 | Arch §18.2, OI-8 | A1 | DR | **In review** | `docs/platform-facts.md` §2–6, §7 (Verified URL/date or Unresolved fallback) | Formal P0 acceptance awaits A1–A3; preparatory research complete under PREP-0.9 |
| P0.B2 | Arch §13.2, N-03(a) | A1 | DR | **In review** | `docs/platform-facts.md` §8 scope identifier table | Formal P0 acceptance awaits A1–A3; `forge lint` not yet run |
| P0.B3 | Workflow §0 | A1 | DR | **In review** | `docs/platform-facts.md` §5–6 (CSV/importer/panel facts) | D-008 ruled WF-1/5/7; WF-2 manual-pin fallback was not separately ruled; `jira:issueContext` read-only permission verification still needed |
| P0.B4 | Hackathon §11 | A1 | DR | **In review** | `docs/platform-facts.md` §6 (Marketplace update-path facts) | D-008 E-4 release rule recorded; official PF-MP-1 platform status remains **Unresolved**; formal P0 acceptance awaits A1–A3 |
| P0.C1 | AGENTS §7.4 | B1–B4 (partial OK) | PRQ + ORC | **Not Started** | Decision packet delivered | Plan approval |
| P0.C2 | AGENTS §7.4 | C1 | ORC | **Completed** | D-008 records the owner's 24 Nov ruling batch verbatim with date; CF/OI/WF/PLAN/DR dispositions recorded in §5.1–5.5 | Rule-data files and access inputs still absent, but the decision-record task itself is complete |
| P0.D1 | OI-1, U-1 | A1 | OWN | **Not Started** | Locked rule files present or OI-1 Unresolved | Plan approval; owner files |
| P0.D2 | OI-2, CF-3 | D1 | OWN | **Not Started** | Dated practitioner-review outcome | Plan approval; practitioner |
| P0.D3 | OI-2, R-8, R-9 | — | OWN | **Not Started** | Dated trademark/partner record | Plan approval; owner |
| P0.D4 | I-7, DR role | D1 | DR | **Not Started** | Cited draft extract, Proposed only | Plan approval; official sources |

### 3.2 P1 — Repository, toolchain, installable Forge shell

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P1.A1 | AGENTS §12.1, N-06, I-10 | P0 | BE-1 | **Completed** | `evidence/P1/check-2026-11-24T04-21-26-255Z.txt`; clean-dir `npm ci` exit 0; D-006 version/licence log | Formal P0 entry still open; work was owner-authorised early |
| P1.A2 | N-06, C-12 | A1 | BE-1 | **Completed** | `npm run check` PASS: deps, imports, strict types, lint, format, 2 tests; SHA-stamped evidence in `evidence/P1/` | `forge lint` skipped honestly: no manifest yet |
| P1.A3 | N-06, N-03(h), C-12.5 | A1 | SP + BE-1 | **Completed** | Injected violations each exit 1: runtime dep, `core/`→`@forge/api`, `.tsx` side-effect import, test/oracle under `src/`, non-exact pin; independent read-only review fixed 2 Major + 6 Minor findings | — |
| P1.A4 | AGENTS §6.5, §7.2 | A1, A2 | BE-1 | **Completed** | Hook installed at `.git\hooks\pre-commit`; blocked staged `rules/` file and staged deletion of `docs/Project/Scope.md` (temp index probe); shim content verified | Scratch-branch commit method replaced by non-destructive probes; real-commit firing is the checkpoint verification |
| P1.A5 | Tools §6, AGENTS §19, N-06 | A1 | ORC | **Completed** | `docs/harness-matrix.md` v1.0 with method/date; official config keys checked; read-only agents installed (`npm run setup` PASS, `opencode debug agents`); harness denies loaded (`opencode debug config`); D-007; `evidence/P1/setup-probe-2026-11-24T04-36-33Z.txt`; `evidence/P1/check-2026-11-24T04-38-12-186Z.txt` | New agent files not yet exercised in a gate; phase acceptance still Blocked (§13.5) |
| P1.B1 | N-03(a), N-08 | A1, DR-2 | FA | **Completed** | Parity passes; negative injections fail. `scripts/lib/manifest-model.mjs`, `manifests/baseline.json` (independent artifact), `scripts/render-manifests.mjs`, `scripts/check-manifests.mjs`, `tests/manifest.test.ts` (18 tests); `npm run check` PASS `evidence/P1/check-2026-11-24T07-13-14-833Z.txt` (20 tests total). Hook lock probe exit 1 on staged `manifests/baseline.json`. Task review 24 Nov resolved below | Both real app IDs populated 24 Nov (P1.B4 Completed); `forge lint` unrun (P1.B3); PF-MAN-3 icon ambiguity |
| P1.B2 | Arch §3.2, G-8 | A1, B1 | FA + BE-1 | **Completed** | Root `manifest.yml` byte-identical to the selected template (RV-15 tie test); resolver identity from context; panel/admin/context shells with loading and error states; no-op trigger and consumers; 3 passing empty-migration tests; official Jira event identifiers after D-VB-01; App A v2.2.0 and App B v2.1.0 deployed to **development** and installed on `one-atlas-ttud`. Evidence index `evidence/P1/README.md`; final `npm run check` PASS `check-2026-11-24T11-52-20-648Z.txt` (37 tests, `forge lint` no issues). Both ARIs in `evidence/P1/app-ids-2026-11-24.md`; apps observed present as `DEV` installs by blind Verification A | PF-JIRA-9 Viewer check; live empty-migration run not observed (PF-SQL-2); shell-only product is expected for P1 but blocks Core acceptance |
| P1.B3 | N-03(g), I-13 | B2 | FA | **Completed** | `forge lint` → "No issues found" inside every deploy and `npm run check`; `forge eligibility` → eligible for Runs on Atlassian `evidence/P1/eligibility-app-a-2026-11-24T10-14-44-987Z.txt`. PF-MAN-3 resolved; interval enum and trigger events corrected by official docs (A-11); D-011 records versions/licences but is **not** an owner approval (GV-1) | Eligibility is not an award (I-13); re-check before any badge claim |
| P1.B4 | Arch §17.2, DR-14 | B1 | OWN | **Completed** | Both apps created by the owner via `forge create`; both full ARIs recorded in `manifests/app-config.json` and `evidence/P1/app-ids-2026-11-24.md`; `npm run render:manifests` + `npm run check` PASS `evidence/P1/check-2026-11-24T09-29-02-170Z.txt` (20 tests). Deploy/install later completed under P1.B2 | Rename App A from `developer-spaces` in the Developer Console is cosmetic and optional |

### 3.3 P2 — Platform foundation services

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P2.D2 | Arch §12 | P1 | FA | **Completed** | `src/contracts/{jira,authorisation,logging,envelope}.ts` pin IF-6/7/14/15; `tests/contracts.test.ts` transcribes the five writes, five budget classes, three error classes, four roles, twelve actions, the §13.3 matrix cell by cell, registry equality and the envelope codes. `npm run check` PASS, 63 tests | Contracts frozen; signature change needs a single-writer announcement |
| P2.A1 | N-04(a,e), N-07, B-9 | D2 | BE-1 | **Completed** | `src/handlers/migration.ts` defines 14 frozen forward-only operations covering every Core table incl. `scan_lease`/`usage_counter`; one `CREATE TABLE IF NOT EXISTS` each, no FK/upsert/multi-statement (PF-DB-3/4/5). `tests/core-migration.test.ts` transcribes §5.3 key columns and UNIQUE keys cell by cell, checks no record-text columns, proves enqueue-once/run-once and idempotency by name over two runs. Mutation spot-check: renaming `lease_until` failed the column test, restored green. Adapter wired to `runCoreMigration`; `npm run check` PASS, 72 tests | Live site DDL execution remains **Unresolved** (PF-SQL-2 — no observed scheduled invocation); code-level idempotency is proven, live run is not |
| P2.A2 | Arch §12, §18.2 | A1, P0.B1 | BE-1 + TE | **Completed (local)** | `src/services/sql.ts` pins the SqlPort to the verified driver shape (`prepare().bindParams().execute()`) and builds only parameterised, single-statement queries over the 14 frozen tables; key specs transcribed from §5.3. `src/services/repositories.ts` gives exactly one owner per table with read-after-write idempotency (no upsert — PF-DB-3), adopted-winner race handling, affectedRows for conditional updates, and a canary guard before binding. `tests/support/sql-fake.ts` enforces PK/UNIQUE, `IS NULL`, affectedRows, parameter binding and no-cascade from PF-DB-1/2/4/5; its table list is cross-checked against the migration DDL. A real bug in the fake's UPDATE parameter offset was caught by the test and fixed. `src/adapters/forge-sql.ts` wraps the real driver. `npm run check` PASS, 122 tests | **Live validation against the demo-site DB is Unresolved (PF-SQL-2)** — no observed migration run or SQL query on `one-atlas-ttud`; the A2 acceptance clause "fake validated against the real database" is therefore not claimed |
| P2.B1 | N-01(b,d), N-03(c), C-07.10, G-3 | D2 | BE-2 | **Completed** | `src/services/jira-client.ts` + `tests/jira-client.test.ts`: one injected-transport client with explicit identity, five budget classes, status classification from Arch §14.4, bounded retries honouring Retry-After ≤ 900 s (PF-Q-2), fail-closed budget gate, typed errors with code-only messages (no body echo). `createJiraWriter` exposes exactly the five approved writes; no generic/delete method exists, so a sixth write is unreachable. Clock and sleep are required injections (no real clock/sleep in the pure core). `npm run check` PASS, 103 tests | Runtime Jira transport adapter and live Jira permissions (PF-JIRA-9) not verified |
| P2.B2 | N-04(a), N-09, I-6 | D2 | BE-2 + SP | **Completed** | `src/contracts/canary.ts` + `tests/canary.test.ts` (four probes, serialised scan, field/value guards) and `src/services/logger.ts` + `tests/logger.test.ts`: every log call passes the canary guard before the injected sink; all three levels guarded. Audit and Jira error paths also reject canary probes (I-6) | Canary is a synthetic test harness; it cannot detect real pasted record text (Arch §5.4 states this limitation) |
| P2.C1 | Arch §6.2, C-10.4, N-04(b) | D2, A1 | BE-3 | **Completed** | `src/services/settings.ts` + `tests/settings.test.ts` (unsafe combinations rejected; first-run empty roles accepted per Arch §13.1; code-only audit). `src/services/hash-key.ts` + `tests/hash-key.test.ts`: one 256-bit key per installation via injected secret store, create-if-absent with lost-race adoption and fail-closed KEY_UNAVAILABLE, identity-bound HMAC-SHA-256 (equal text in two records hashes differently), no plaintext in digest. `npm run check` PASS, 103 tests | Real KVS secret-store adapter not wired (PF-DB-8 Verified); U-3 custody fallback not needed on this platform fact |
| P2.C2 | G-5, N-07 | A1 | BE-3 | **Completed** | `src/services/audit.ts` + `tests/audit.test.ts`: one append-only `audit()` with an INSERT-only repository interface (no update/delete path exists), code-only details JSON, canary and forbidden-field guards before write, typed failure propagation, built-in UUID id | Live SQL insert into `audit_event` not executed (PF-SQL-2 Unresolved); no FK enforcement by design (PF-DB-4) |
| P2.D1 | G-4, Arch §13.3 | D2, A1, B1, C1, C2 | BE-4 | **Completed (local)** | `src/handlers/authorisation.ts` now has `contextFromPlatform` (discards any supplied role claim), `assertRegistryMatchesMatrix`, and `createGate` — a handler can run only after the decision allows it. `tests/authorisation.test.ts` exercises the full 12 action × 4 role × 2 browse cross-product, registry equality (missing and extra handler rejected), constructor refusal on a mismatched registry, and handler-not-run-on-deny. Code-only audit denials and dependency-failure deny retained. **Single-writer contract change announced:** `GateContext.roles` removed so a spoofed role is unrepresentable (I-4); roles come only from the injected server-side resolver. `npm run check` PASS, 128 tests | Real platform invocation context, group/allow-list role resolver and as-user browse check are not wired to Forge runtime yet (integration checkpoints in the plan remain Unresolved) |

### 3.4 P3 — Pure core A: evidence core and scenario generator

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P3.A1 | Arch §6.3, I-1 | P1 | BE-1 | **Completed (local)** | `src/core/normalise.ts` pins IF-1 at `normalise-v1`: deterministic ADF flatten (hardBreak, block boundaries, volatile-node private-use placeholders, unknown-node placeholder), NFC, whitespace collapse, trim; case/punctuation/order preserved; unsupported version throws `UNSUPPORTED_VERSION`. `tests/normalise.test.ts` + `tests/support/golden-adf.ts` (11 tests) with authored expected text | Frozen-version tag pending (P3.A4); live Jira ADF shapes not observed |
| P3.A2 | C-01.1, G-2 | A1 | BE-1 | **Completed (local)** | `src/core/validate.ts` pins IF-2: one validator for model, rule and human proposals; injected limits (`OI4_QUOTE_LIMITS` 1–1000 from OI-4), placeholder rejection, first-occurrence span, accepted `slice` cut from live text; typed rejects. `tests/validate.test.ts` green | No pass bar claimed; caps enforced at scan level in P6 |
| P3.A3 | C-01.2 | A2 | TE | **Completed (local)** | fast-check properties in `tests/validate.test.ts`, seed `20261124`, 200 runs each: every already-normalised substring validates; one-character/case/omitted/reordered/placeholder changes rejected. Two false properties in the authored tests were corrected before implementation (duplicate-word degeneracy and whitespace-only slices), not weakened after a failure | — |
| P3.A4 | Arch §16.1, I-1 | A1 | TE | **Completed (local)** | `tests/support/golden-adf.ts` covers mention, emoji, media, inline card, status, date, table, list, code block, Unicode, unknown node and 1,200-char text, with expected text authored from Arch §6.3. Golden digest not yet recorded and no version-freeze tag created; kept honest rather than claimed | **Corpus digest and freeze tag remain Not Started** — needed before any evidence under `normalise-v1` is frozen |
| P3.B1 | C-01.4, Arch §7.3, PC-4 | A2 | BE-2 | **Completed (local)** | `src/core/screener.ts` pins IF-3 with a hand-written strict lexicon loader: missing/invalid/empty lexicon → DEGRADED (`LEXICON_MISSING`/`LEXICON_INVALID`), never NO_SIGNAL; length-preserving case-folding offsets; every span cut from live text and passed through IF-2; overlapping spans reduced earliest-longest. `tests/fixtures/lexicon-test-v1.json` and 15 tests | Real lexicon content remains Blocked (OI-1/U-1, locked `rules/*.json`); test fixture only |
| P3.B2 | C-01.13, C-12 | B1 | TE | **Completed (local)** | `src/core/screener-metrics.ts` computes TP/FP/TN/FN and precision/recall from authored labels with no pass bar (OI-5); `tests/fixtures/screener-corpus.ts` uses Workflow §10 H1–H5/A1/A2 text; `evidence/P3/screener-metrics.txt` reports overall precision 1, recall 0.75 (H5 miss reported honestly), SC-1 recall 1, SC-2 recall 0.5, SC-3/SC-4 precision n/a; corpus digest recorded | Measured on 7 synthetic segments only; larger held-out benchmark is P9 |
| P3.C1 | C-08.4, Tools §4 | P1 | BE-3 | **Completed (local)** | `src/core/csv.ts`: no CSV library; every field quoted, internal quotes doubled, one `Comment` column per comment as `date;accountId;body`, rows padded and never reordered, CRLF, field-count guard. `tests/csv.test.ts` 8 tests incl. byte-identical repeat, Unicode, embedded newline | — |
| P3.C2 | C-08.2, C-08.6, I-12 | C1 | BE-3 + TE | **Completed (local)** | `src/core/generator.ts`: xorshift32 seeded from `(seed, anchorDateISO, authorAccountId)`, no `Math.random`; frozen Workflow §10 templates for H1–H5 (CSV) and A1/A2 (sample), ground-truth labels and expected verbatim quotes, separate `BENCHMARK_SEED`; `assertSyntheticFixtures` rejects any deviation from fictional templates or contact data. 8 tests incl. byte-identical output and FX-1 19-day offset | WF-6 inputs were proposed by the workflow and used as a kind-B engineering choice, not an owner ruling; larger benchmark corpus is P9 |

### 3.5 P4 — Pure core B: deadline engine, rules loader, oracle

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P4.A0 | Arch §10.2, I-7 | P1, DR-9 | FA + DR | **Completed (local)** | `src/contracts/deadlines.ts` freezes the generic clock/rule contract; versioned synthetic fixtures only; no regulatory content invented | Real rule data still Blocked |
| P4.A1 | C-05.3, C-05.9 | A0 | BE-1 | **Completed (local)** | `src/core/rules-loader.ts` strict loader; 10 tests; malformed/unreviewed/all-non-working sets fail closed | Real rule data still Blocked |
| P4.A2 | C-05.1, C-05.2, C-05.4 | A1 | BE-1 | **Completed (local)** | `src/core/deadlines.ts` pure engine; near-midnight, weekend, holiday, DUE_TODAY/OVERDUE and fail-closed tests; `check:imports` green | — |
| P4.A3 | Arch §10.1, C-04.4 | A0 | BE-1 | **Completed (local)** | `src/core/timezone.ts`; `tests/timezone.test.ts` 3 tests; injected zone only | Real time-zone rule still Blocked |
| P4.B1 | C-05.6, Arch §10.6 | A0 | TE-O | **Completed (local)** | `oracle/deadline-oracle.ts` written in a separate context; no engine runtime import; 11 golden cases in `tests/oracle-agreement.test.ts` | Different model family unavailable (§13.1) |
| P4.B2 | C-05.5, C-05.7, FX-1 | A0; D1/D2 for real values | DR + TE | **Completed (synthetic local)** | Synthetic arithmetic goldens including FX-1; `evidence/P4/oracle-agreement.txt` | Real values Blocked on OI-1/OI-2; no legal reading claimed |
| P4.B3 | C-05.6 | A2, B1 | TE-O | **Completed (local)** | 10,000 differential runs + metamorphic properties, seed `20261206`; full trace equality; `evidence/P4/oracle-agreement.txt` | Arithmetic agreement only (Arch §10.6) |
| P4.C1 | C-05.11, G-1 | A2 | SP | **Completed (local)** | `src/core/wording.ts`; `tests/wording.test.ts` 9 tests; `check:imports` PASS | — |

### 3.6 P5 — Evidence and Trail services

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P5.0 | Arch §12 | P2.D2 | FA | **Completed (local)** | `src/contracts/evidence.ts` pins IF-8/IF-9 vocabularies and state codes; `tests/evidence.test.ts` / `tests/trail.test.ts` pin enumerations | — |
| P5.A1 | C-04.1, N-04 | P5.0 | BE-1 | **Completed (local)** | `src/services/evidence.ts`: pointers, offsets, keyed hashes and codes only; verbatim validator before SQL; canary test proves no text in SQL or storage | Live demo-site SQL still not observed |
| P5.A2 | C-04.8–10, Arch §6.4 | A1 | BE-1 | **Completed (local)** | Five states, ambiguous 403/404, capped relocation, key rotation and retired-version paths; 18 evidence tests | Live Jira read/coverage gate not exercised |
| P5.A3 | C-04.1, Arch §6.4 | A1 | BE-1 | **Completed (local)** | `classifyEvidenceStrength()` uses only Jira record claims and an explicit changelog check; tests cover comment and summary/description paths | Changelog call is an edge responsibility, not yet wired |
| P5.B1 | C-04.2, C-04.5, C-04.7, C-04.11 | P5.0 | BE-2 | **Completed (local)** | `src/services/trail.ts` append-only service; insert-if-absent case; RECORD/ENTERED; role-gated transitions; supersession; future-date rejection; 8 trail tests | Concurrent live SQL not observed |
| P5.B2 | C-04.4, C-04.6 | B1, P4.A3 | BE-2 | **Completed (local)** | `candidateDates()` lists both bases, earliest first, no preselection; Jira timestamp converted only with an injected zone | Time-zone rule still Blocked |
| P5.C1 | Arch §16.1 | P5.0 | TE | **Not Started** | Evidence lifecycle FK reports: unchanged, edited elsewhere, moved, removed, deleted, denied, key missing, rotation | P5.0; SC-5 corpus |
| P5.C2 | G-7 | P5.0 | TE | **Not Started** | Idempotency/replay FK reports: duplicate capture, concurrent case creation, replay and reorder | P5.0 |
| P5.D1 | G-4 | A2, B1 | BE-2 | **Not Started** | Role matrix updated for trail/evidence resolvers | A2, B1 |
| P5.D2 | C-04.1–3, C-09.2–3 | D1 contract | FE | **Not Started** | Visible on demo site | D1 contract |

### 3.7 P6 — Signal Finder and capture

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P6.0 | Arch §7 | P5.0 | FA | **Not Started** | IF-10 and reason codes frozen | P5.0 |
| P6.A1 | C-01.10, C-01.8, N-01(e) | P6.0, P2 | BE-1 | **Not Started** | Trigger purity/no-call test | P6.0, P2 |
| P6.A2 | C-01.1, 4–7, N-01(a) | A1 message contract, B1 interface | BE-1 | **Not Started** | Scan FK report | A1, B1 interface |
| P6.A3 | C-01, Arch §7.8 | A2 | BE-1 | **Not Started** | Case/signal FK | A2; WF-9 |
| P6.B1 | C-01.3, C-01.9, Arch §7.4–7.5 | P6.0 | BE-2 | **Not Started** | FK; zero model I/O stored/logged | P6.0 |
| P6.B2 | C-01.3, SC-6, G-9 | B1 | TE | **Not Started** | Adversarial AI FK reports | B1 |
| P6.B3 | PC-7, C-12.1 | B1, A2 | TE + OWN | **Not Started** | `evidence/P6/ai-path.md` | DR-18 approval; cost |
| P6.C1 | C-02.1–7, C-01.11–12 | A2, P2.D1 | BE-1 | **Not Started** | FK + matrix | A2, P2.D1 |
| P6.D1 | C-09.1–2, C-01.5 | C1 contract | FE | **Not Started** | All scan states visible | C1 contract |
| P6.E1 | C-01.7, G-7, N-01 | A2, A3 | TE | **Not Started** | Replay/crash FK reports | A2, A3 |

### 3.8 P7 — Write-back outbox

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P7.A0 | C-07.1, PC-2 | DR-3, P0.B1 | FA + OWN | **Not Started** | Schema/aliases frozen; IF-13 pinned | DR-3; P0.B1 |
| P7.0 | Arch §11.3 | P2.D2 | FA | **Not Started** | IF-12 and statuses frozen | P2.D2 |
| P7.A1 | C-07.4, 6, 8 | P7.0 | BE-4 | **Not Started** | Outbox FK | P7.0 |
| P7.A2 | C-07.5, C-07.11, CF-6 | A1 | BE-4 | **Not Started** | Visibility fail-closed FK | A1; CF-6 |
| P7.A3 | C-07.1–2 | A0, A1 | BE-4 | **Not Started** | Canary: no text | A0, A1 |
| P7.A4 | C-07.3, G-1 | A1 | BE-4 | **Not Started** | UT + wording scan | A1 |
| P7.A5 | C-07.7, C-07.9 | A1 | BE-4 | **Not Started** | Retry/repair FK | A1 |
| P7.B1 | C-07.4–10 | A1–A5 | TE | **Not Started** | Full FK report | A1–A5 |

### 3.9 P8 — Lookback and benchmark

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P8.0 | Arch §8 | P5.0 | FA | **Not Started** | IF-11 and reason codes frozen | P5.0 |
| P8.A1 | C-03.4–5, C-03.13 | P8.0 | BE-2 | **Not Started** | Decision-table UT | P8.0 |
| P8.A2 | C-03.1–3, 10–11, N-01 | A1 interface | BE-2 | **Not Started** | Budgeted as-user FK | A1 interface |
| P8.A3 | C-03.6–9, 12 | A2, P5 | BE-2 | **Not Started** | Candidate-flow FK | A2, P5 |
| P8.A4 | C-03, G-4 | A2, A3 | BE-2 | **Not Started** | Matrix updated | A2, A3 |
| P8.B1 | C-03.12, C-12.1 | P3.C2 | TE | **Not Started** | Reproducible labelled splits | P3.C2 |
| P8.B2 | C-03.12, OI-5 | A1, B1 | TE + BE-2 | **Not Started** | Held-out benchmark tables | A1, B1; OI-5 |
| P8.B3 | C-03.1–2, 6–7, 10–11, 13 | A2–A4 | TE | **Not Started** | FK reports | A2–A4 |
| P8.C1 | C-09.2–3, Workflow §7.5 | A4 contract | FE | **Not Started** | Visible on demo site | A4 contract |

### 3.10 P9 — Deadlines, decision record, rule-status gating

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P9.A1 | C-05.7–8, 10, C-11.2–5 | P4, P5 | BE-3 | **Not Started** | FK; FX-1 reproduced | P4, P5; rule data |
| P9.A2 | C-06.3, WF-15, I-5 | P4.A0 | BE-3 | **Not Started** | UT + string scan | P4.A0; OI-1 |
| P9.A3 | C-06.1–2, 4–6, 8–12 | A1, A2, P2.D1 | BE-3 | **Not Started** | FK + role matrix | A1, A2, P2.D1; DR-10 |
| P9.A4 | C-06.7 | A3, P7 | BE-3 | **Not Started** | Reminder FK | A3, P7; DR-11 |
| P9.A5 | C-07.3, 8 | A3, P7 | BE-3 + BE-4 | **Not Started** | FK; real-site JQL | A3, P7 |
| P9.B1 | C-06.1, 5, 8, 12 | A3 | TE | **Not Started** | FK reports | A3 |
| P9.B2 | G-1, C-05.11, C-06.3 | A1–A3 | SP | **Not Started** | Wording scan green | A1–A3 |
| P9.C1 | C-05.8, C-06, Workflow §7.6–7.7 | A1–A3 contracts | FE | **Not Started** | Visible on demo site | A1–A3 contracts |
| P9.D1 | C-07.2, E2E 7 | A5, C1 | ORC | **Not Started** | Manual journey log | A5, C1 |

### 3.11 P10 — Product surfaces, admin, sample, reconciler, polish

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P10.A1 | C-10.1–5, 7, WF-2, WF-11 | P2 | FE + BE-3 | **Not Started** | FK; caps/ceiling scan | P2 |
| P10.A2 | C-10.8, N-09 | P6, P7 | FE + BE-3 | **Not Started** | Visible bounded queries | P6, P7 |
| P10.A3 | C-08.1–9, WF-5, WF-6 | P3.C2, P6, DR-13 | BE-3 + FE | **Not Started** | UT determinism; E2E steps 3/9 | P3.C2, P6, DR-13 |
| P10.A4 | C-10.9 | A1, DR-15 | BE-3 | **Not Started** | Built only if approved; otherwise absent record | DR-15 |
| P10.B1 | C-09.1–6, WF-9, WF-10 | P6, P8, P9 | FE | **Not Started** | Visible states | P6, P8, P9 |
| P10.B2 | N-01(c), Arch §15.2 | P6, P7, P9 | BE-1 | **Not Started** | Run-twice bounded FK | P6, P7, P9 |
| P10.B3 | N-04(d), U-5 | B2, P0.B1 | BE-1 | **Not Started** | Erasure FK | B2, P0.B1; U-5 |
| P10.C1 | N-05, G-8 | A1, B1 | FE | **Not Started** | Accessibility/dark-mode checklist | A1, B1; OI-6 |
| P10.C2 | C-09.7, WF-1 | DR-2 | FE | **Not Started** | Built surface or decision record | DR-2 |
| P10.D1 | E2E | all above | ORC | **Not Started** | Judge steps 1–9 smoke log | all above |

### 3.12 P11 — Should tier

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P11.A1 | S-01.1–6 | P9 (C-06.10) | BE-3 + FE | **Not Started** | FK; E2E step 7 | P9 |
| P11.B1 | S-04.1–5, CF-7 | P4, P9 | BE-1 + FE | **Not Started** | UT, FK upgrade, GT/OR per version | P4, P9 |
| P11.B2 | S-05.1–5 | B1, P4, OI-1 | BE-1 + TE-O | **Not Started** | GT, OR, FK | B1, P4; OI-1 |
| P11.C1 | S-02 | M-1, DR-2 | BE-4 + FE | **Not Started** | FK, E2E | M-1; DR-2 |
| P11.C2 | S-03 | M-1, DR-2, P0.B1 | BE-4 | **Not Started** | FK, E2E on Rovo site | M-1; DR-2; P0.B1 |

### 3.13 P12 — Marketplace track and App A submission

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P12.A1 | Hackathon §11.1, §11.4 | P0.D3 | OWN | **Not Started** | Partner/Developer Space status record | P0.D3; owner |
| P12.A2 | Hackathon §11.2, R-9 | P0.D3 | OWN + RD | **Not Started** | Final name logged | P0.D3 |
| P12.A3 | N-04(f), N-08, Tools §2 | A2 | RD | **Not Started** | Reviewed public pages | A2 |
| P12.A4 | Hackathon §11.1 | M-1, P1.B3 | SP + RD | **Not Started** | Consistent privacy/eligibility answers | M-1, P1.B3 |
| P12.A5 | N-08, CF-2, I-13 | A3 | RD | **Not Started** | Listing text matches app | A3; CF-2 |
| P12.A6 | Hackathon §8, §11.1 | A1–A5, M-1 | OWN + RD | **Not Started** | Ticket URL; outside-org log | A1–A5, M-1; owner presses submit |
| P12.A7 | CF-5 | P0.B4 | ORC | **Not Started** | Update-path decision record | P0.B4 |

### 3.14 P13 and P14 — phase-section gap

The supplied `Implementation plan.md` names P13 and P14 in §3 milestones, §4 critical path and §9 phase index, but §10 ends at P12 (file line 682). There are **no canonical task tables** for P13 or P14. In D-008 the owner approved a **draft** task list here, explicitly not a replacement for the missing canonical sections. `GAP-P13` and `GAP-P14` stay Blocked until an owner-supplied canonical section exists.

| ID | Needed from owner | Status | Evidence required | Blockers |
|---|---|---|---|---|
| **GAP-P13** | Canonical P13 phase section: outcome, entry, tasks, VA scope, VB focus, exit/evidence | **Blocked** | Owner-supplied `Implementation plan.md` §10 section | Missing from the approved v0.1 file; draft below is not a substitute |
| **GAP-P14** | Canonical P14 phase section: outcome, entry, tasks, VA scope, VB focus, exit/evidence | **Blocked** | Owner-supplied `Implementation plan.md` §10 section | Missing from the approved v0.1 file; draft below is not a substitute |

**Draft P13 — release-candidate QA, security and evidence pack (D-008 PLAN-2; Draft, Not Started)**

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P13.D1 | CF-5, N-08, AGENTS §18.3 | P10, P11 | ORC | **Not Started** | Manifest/scope parity snapshot; freeze date recorded | P10/P11 not accepted |
| P13.D2 | C-12, N-06 | D1 | BE + SP | **Not Started** | `npm run check` clean; `forge lint` and `forge eligibility` outputs | Forge site/token |
| P13.D3 | D-008 OI-9 | D1 | RD | **Not Started** | App A/B same-commit parity; App IDs recorded | Forge access |
| P13.D4 | N-04, C-12.5 | D1 | SP + TE | **Not Started** | Canary, privacy, banned-wording and evidence-pack results | Rule data and tests |
| P13.D5 | AGENTS §13.2–13.5, D-008 DR-17 | D2–D4 | VA + VB + ORC | **Not Started** | A/B reports, current-commit evidence, orchestrator confirmation | Two verifier contexts |
| P13.D6 | AGENTS §18.3 | D2–D5 | OWN + RD | **Not Started** | Outside-org test and testing-guide steps 1–9 | Outside organisation |

**Draft P14 — judge-ready build, demo and submission (D-008 PLAN-2; Draft, Not Started)**

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P14.D1 | CF-2, I-13, AGENTS §18.2 | P13.D6 | RD | **Not Started** | Listing/description with required decision-support wording | P13 not accepted |
| P14.D2 | Hackathon §11, D-008 CF-5 | P14.D1 | RD | **Not Started** | Video under five minutes; no third-party marks or unlicensed music | P14.D1 |
| P14.D3 | D-008 OI-9, CG-6 | P14.D1 | RD + OWN | **Not Started** | App B judge link and App A listing/review-ticket link | Owner; Marketplace state |
| P14.D4 | AGENTS §18.3 | P14.D3 | OWN | **Not Started** | Billing alert on App B; App B frozen after outside-org test | Owner |
| P14.D5 | §10.2, §18.4 | P14.D1–D4 | OWN | **Not Started** | Owner presses submit/publish/share | Owner only |

---

## 4. Completed phases

None. No implementation phase has been accepted: Verification A, Verification B and orchestrator confirmation have not run (AGENTS §13). The governance commits are not phases and are recorded only as verified baselines.

| Phase | Commit SHA | Verification A evidence | Verification B evidence | Accepted by |
|---|---|---|---|---|
| — | — | — | — | — |

---

## 5. Blockers and Unresolved

### 5.1 Owner decisions on Scope conflicts (D-008, Approved 24 Nov 2026)

| ID | Status | Ruling and effect | Still pending |
|---|---|---|---|
| **CF-1** | **Approved** | `jira:issueContext` preferred primary entry point, subject to read-only permission verification; no `jira:issueGlance`; gadget/Rovo deferred; `jira:entityPropertySet` for searchable metadata; three custom fields deferred unless a native-field need is shown. | Canonical wording update; permission verification; manifest reconciliation before 1 Dec. |
| **CF-2** | **Approved** | FDA deadlines are Core; EU is preview. | Listing/video wording review. |
| **CF-3 / WF-13** | **Approved** | Separate AI screening from rule-set status. Only APPROVED rule sets produce regulatory deadlines; PREVIEW/UNREVIEWED produce none. Evidence-only investigation is preserved. | Rule-set status evidence (OI-2). |
| **CF-4** | **Approved** | MVP option (a): pointers, timestamps, keyed hashes, live re-display, MODIFIED/UNAVAILABLE indicators. No immutable-retention claim. | Intended-use wording. |
| **CF-5** | **Approved** | First manifest freeze 1 Dec 2026; dashboard gadget and Rovo excluded from first submission. | Freeze gate and parity snapshot. |
| **CF-6** | **Approved** | Accept Browse visibility with explicit disclosure; entity properties hold non-sensitive metadata only; sensitive decision data stays in Forge SQL; comments fail closed. | Disclosure and schema wording. |
| **CF-7** | **Approved** | Every calculation and decision records rule-set ID, version, digest, jurisdiction and effective date. | Storage/schema implementation. |

### 5.2 Open items (D-008 disposition)

| ID | Status | Ruling and effect | Still pending |
|---|---|---|---|
| **OI-1 / WF-15** | **Approved instruction; input Blocked** | Do not invent regulatory rule data. Require qualified QA/RA approval for day-count, time zone, awareness definitions, decision questions, answer vocabulary and signal lexicon. | `docs/03-domain-rules.md`, `rules/*.json`, QA/RA evidence. |
| **OI-2** | **Unresolved** | Practitioner review, trademark clearance and partner verification remain Unverified; use FDA-only evidence mode until rule review is complete. | Dated evidence for all three. |
| **OI-3** | **Approved** | Case may have undetermined awareness date; provisional decisions allowed under unreviewed rules; no deadline calculation and no final regulatory closure under unreviewed rules. | UI labels and rule-status gate. |
| **OI-4** | **Approved operating defaults** | Values in `docs/proposals/oi-4-operating-defaults.md` v1.0: debounce 5 s; one auto LLM call per unique content version; 100 requests/installation/day; 8,000/1,000 input/output tokens; 5 manual scans/user/10 min; 2 relationship hops; 500/2,000 initial/extended records; 25 displayed candidates + remainder; quote 1–1,000 chars; reminders 7/3/1 days and daily overdue. Approved constraints: do not discard low-strength matches; reject every non-verbatim quote; LLM failure must never become `NO_SIGNAL_FOUND`. | Not rule data or an SLA. Benchmarking still required before any SLA claim; no `rules/*.json` edit. |
| **OI-5** | **Approved** | Honest precision/recall reporting only; no invented hard pass percentages; report sample sizes and actual results; HIGH stronger than MEDIUM. | Test design and evidence. |
| **OI-6** | **Approved** | WCAG 2.2 AA with actual accessibility testing. | Test evidence. |
| **OI-7** | **Approved** | No unsupported numeric performance SLA; instrument and benchmark first. | Benchmark data. |
| **OI-8** | **Approved policy; proof Blocked** | Use verified or explicitly documented fallbacks; no runtime claim without tests; missing Arch §18.2 fallback definitions to reconcile. | Runtime probes for upsert, index lag, CSV import events; reconcile §18.2. |
| **OI-9** | **Approved** | Two-app strategy: App A Marketplace submission; App B unlicensed judge-install build; both from a recorded Git commit. CG-6 confirms listing/review-ticket link is acceptable for the bonus. | Owner submission; App IDs. |
| **OI-10** | **Not Approved** | PA-1 to PA-5 stay unapproved until actual descriptions and implementation implications are supplied. | Owner-supplied descriptions. |

### 5.3 Workflow findings (D-008 disposition)

| ID | Status | Ruling and effect |
|---|---|---|
| **WF-1** | **Approved** | `jira:issueContext` preferred; `jira:issueGlance` excluded; subject to read-only permission verification. |
| **WF-2** | **Partial** | Module choice approved; manual-pin fallback was not separately ruled. Keep the documented behaviour until verified; do not claim an extra app write. |
| **WF-3** | **Approved** | No occurrence field; event occurrence and company awareness stay separate. |
| **WF-4** | **Approved** | Disclose that restricted comments are not scanned; never claim complete organisational coverage. |
| **WF-5** | **Approved** | Option (b): copyable CSV in a Code block; no fake download. |
| **WF-6** | **Approved** | Deterministic sample uses seed, anchor date and generator version; real admin identity only in audit metadata. |
| **WF-7** | **Approved** | Manual scanning fallback for imported issues; no event-driven dependency. |
| **WF-8** | **Approved** | Never auto-merge cases; each case decided independently. |
| **WF-9** | **Approved** | New evidence becomes PROPOSED; a qualified person creates a new decision version. |
| **WF-10** | **Approved** | First substantive case action triggers IN_REVIEW; viewing, routing and manual scanning do not. |
| **WF-11** | **Approved** | Configurable namespaced routing label; never overwrite existing labels. |
| **WF-12** | **Approved** | Add manual case opening to acceptance criteria. |
| **WF-13** | **Approved via CF-3/OI-2** | Headline deadline numbers require an APPROVED rule set. |
| **WF-14** | **Approved in principle (D-009)** | `docs/proposals/wf-14-case-index-projection.md` v1.0 is the implementation contract. Key = canonical `knewwhen.case`; module = `jira:entityPropertySet`. SQL remains authoritative; entity property is a reduced search projection. | Canonical wording update for the module is pending; QA/RA vocabulary still required before deadline fields are trusted. |
| **WF-15** | **Blocked** | Decision questions remain unavailable until OI-1 rule data is supplied; OI-3 behaviour is now Approved. |
| **WF-16** | **Approved** | Record searcher, timestamp and scope; offer “Search again as me”; mark incomplete searches explicitly. |

### 5.4 Capability and document gaps (Updated 24 Nov 2026 after D-008)

- `Implementation plan.md` is present, **Approved v0.1** (D-003) and tracked in Git; its contents were not edited. PLAN-1 and PLAN-6 are resolved.
- `CLAUDE.md` exists with one line `@AGENTS.md` (D-004), resolving the Tools §6 gap.
- Local Node is `v24.22.3` by default via nvm (D-005); Forge 15.1.0 runs without the Node-version warning. PREP-0.10 is resolved.
- The following canonical inputs remain absent: `IMPLEMENTATION_PLAN.md` §2.11, `docs/02-spec.md`, `docs/03-domain-rules.md`, `docs/05-stack-and-constraints.md`, `rules/*.json` (the `rules/` directory exists but has no JSON files). Regulatory content may not be invented (I-7).
- The P1.A1–A4 toolchain exists: `package.json`, `package-lock.json`, strict TypeScript/Vitest/fast-check/ESLint/Prettier config, `npm run check`, `npm run setup` and a tested pre-commit hook. The earlier statement that these could not exist is superseded by the verified checkpoints.
- No Forge app scaffold yet: `manifest.yml`, `src/adapters/forge/`, `migrations/` and `rules/*.json` are absent. `forge lint` is honestly skipped until a manifest exists. P1.B1/B2 remain Not Started.
- `.opencode/` is intentionally ignored (D-002) and is regenerated from tracked source by `npm run setup`. Root `opencode.json` and `.claude/settings.json` carry V2 deny rules; D-007 records their method and limits.
- ECC hook registration was verified (`doctor: OK`, 549 operations, `outside-root=0`); the Git pre-commit hook has since fired through Git's shell (`PRE-COMMIT: PASS`, exit 0). Harness deny rules were not tested by a real locked-file edit; HM-1–HM-4 remain visible in `docs/harness-matrix.md`.
- Verification A (clean-site install from an outside organisation) and Verification B with two independent contexts are not arranged; phase acceptance is **Blocked** (AGENTS §8.3, §13.5, Appendix B-2). D-008 requires two contexts and says acceptance stays conditional if unavailable.
- Owner decisions recorded: **D-001**–**D-007** as before, plus **D-008** (24 Nov ruling batch). `docs/08-decisions.md` is the dated record; `docs/Project/` was not edited.
- A-11 platform facts are recorded in `docs/platform-facts.md` v1.4: 33 Verified, 7 Unresolved with named fallbacks (PF-JIRA-9 added for issueContext permission), plus CG-1…CG-12 from the owner-supplied Codegeist resources URL and official Atlassian token steps. The Codegeist page was re-fetched by `webfetch` and by a direct `200` fetch, both without a browser; the earlier `403`/browser `200` discrepancy is recorded. Discrepancies D-PF-1…D-PF-7 are logged; D-PF-3 resolved. D-008/D-009 rule E-1, E-4, WF-1/5/7, WF-14 and OI-4 handling, but runtime proof and issueContext permission remain open.
- Codegeist “API key” is an **Atlassian API token** for `forge login`, not a Devpost key (CG-3). No token, email, site URL, outside organisation or verifier context was supplied. No credential is stored in the repository.

### 5.5 Implementation-plan gaps (Verified 23 Nov 2026)

| ID | Finding | Effect | Proposed handling |
|---|---|---|---|
| **PLAN-1 — Resolved 24 Nov** | `Implementation plan.md` was Draft v0.1 at first read (lines 3–6). | Blocked implementation from starting. | Owner approved v0.1 and required tracking (D-003); resolved. |
| **PLAN-2 — Draft supplied** | §10 ends at P12; P13/P14 have no canonical task tables although named in §3, §4 and §9. | No faithful canonical P13/P14 checklist exists. | D-008 approves a clearly marked **draft** task list in §3.14. `GAP-P13`/`GAP-P14` stay Blocked until canonical sections are supplied. |
| **PLAN-3 — Ruling recorded; input Blocked** | §2.4 refers to §12 decision register `DR-1`…`DR-18`, but no §12 section exists in the supplied file. | Decision defaults and costs cannot be read from the canonical file. | D-008 says record only explicitly supplied rulings; DR-17 and DR-18 are recorded. DR-1…DR-16 are **not invented**; canonical §12 remains missing. |
| **PLAN-4 — Resolved by D-008** | PC-3 proposes interface-level Verification A for pure phases P3/P4; AGENTS §13.2 says VA runs against the running product. | Literal rule would block pure phases. | DR-17 approved: interface-level verification for pure phases; integrated functionality still requires running-product verification. |
| **PLAN-5 — Resolved by D-008** | PC-7 requires a live hosted-model call for AI-path evidence; AGENTS §10.2 requires owner approval for any live Forge LLM call. | P6/P13 evidence has a cost gate. | DR-18 approved: one controlled live Forge LLM call with synthetic data only; record usage and cost; automated tests must not invoke the live model. Access and deployment still Blocked. |
| **PLAN-6 — Resolved 24 Nov** | The supplied plan file was untracked. | A fresh clone could not derive §3 from Git. | Owner required tracking (D-003); the file is added to Git without content edits; resolved. |

### 5.6 Plan findings carried from `Implementation plan.md` §2.4

**PC-1** listing submission before Core; freeze the manifest at M-1. · **PC-2** entity-property aliases and multi-clock schema undefined; fix in P7.A0. · **PC-3** pure-phase Verification A needs DR-17. · **PC-4** lexicon location vs locked `rules/*.json`; use schema and fixtures. · **PC-5** missing `IMPLEMENTATION_PLAN.md` obligations T-03/T-04/T-05 mapped to P1.A5/P1.A1. · **PC-6** uploaded/canonical file-name mapping needed. · **PC-7** live LLM evidence needs DR-18.

### 5.7 Task-review findings on P1.A1–A4 (Resolved 24 Nov 2026)

Independent read-only review by a separate context, briefed on `AGENTS.md` and the 19 changed files only. It did not re-run the check; its PASS input was the orchestrator's claim, which is not treated as independent verification (AGENTS §20.2). All findings were fixed by the builder and each fix re-probed.

| ID | Severity | Finding | Fix and proof |
|---|---|---|---|
| **RV-1** | Major | `.tsx`/`.mts`/`.cts` escaped both the static import check and ESLint. | `check-imports.mjs` now matches `\.[cm]?tsx?$`; ESLint patterns cover `{ts,tsx,mts,cts}`. Probe `src/core/Probe.tsx` with `import '@forge/ui'` exited 1 in both. |
| **RV-2** | Major | Hook ignored staged deletions and renamed locked files (`--diff-filter=ACMR`). | Now `ACDMR --no-renames`; probe with a staged deletion of `docs/Project/Scope.md` in a temporary index exited 1. |
| **RV-3** | Minor | Side-effect `@forge/*` imports missed by the regex. | Regex extended to bare `import '…'` and backticks; same probe as RV-1 caught it. |
| **RV-4** | Minor | Tests under `src/adapters/` escaped the ban. | Test/oracle checks moved above the adapters exemption; probe exited 1. |
| **RV-5** | Minor | Only `src/oracle/` was checked while the message overclaimed. | Any path segment matching `/oracle/i` under `src/` now fails; probe exited 1 and the PASS message was narrowed. |
| **RV-6** | Minor | Pin check accepted `latest`, `1.2.x` and ranges. | Exact semver regex; probe with `eslint: "latest"` exited 1. |
| **RV-7** | Minor | `engines.node` admitted Node 23 and early Node 24. | Set to `^22.23.4 \|\| ^24.22.1`; lockfile regenerated with `npm install --package-lock-only`. |
| **RV-8** | Minor | `.gitignore` omitted `.env`, `.env.*`, `*.local`. | Added with `!.env.example` exception. |

Reviewer found **no** defect in evidence writing, privacy wording, banned phrases or scope creep. No Blocker or Major remains open.

### 5.6 P1.B1 task-review dispositions (24 Nov 2026)

Independent read-only review of the manifest tooling (`code-reviewer`, session `ses_df3a0ab75ffeyVK6dFy09MJpjI`). No Blocker, invariant breach, secret, record text or new dependency. All findings were fixed by the builder with regression tests; `npm run check` re-run **PASS** (`evidence/P1/check-2026-11-24T07-13-14-833Z.txt`, 20 tests). No independent re-review of the fixes was requested; the residual risks below are recorded, not hidden.

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| **RV-9** | Major | Approval marker was self-referential: editing the code constants and re-rendering passed with the same approval id. | `manifests/baseline.json` is now an independent committed artifact; `baselineFindings(candidate, approved)` compares the model to it, and `render-manifests.mjs` no longer generates it. Tests read the artifact and assert requirement literals. Residual: both artifact and model are hook-locked, not owner-controlled outside Git — see U-B1-1. |
| **RV-10** | Major | Pre-commit hook did not lock "the manifest scopes" (AGENTS §7.2). | `scripts/hooks/pre-commit.mjs` now locks `scripts/lib/manifest-model.{mjs,d.mts}`, `manifests/baseline.json`, `manifests/app-config.json` and `manifests/app-{a,b}.yml`. Temporary-index probe staging `manifests/baseline.json` with no `KW_APPROVAL_TAG` exited 1; real index untouched. This is a P1.A4 follow-up owned by BE-1, recorded here explicitly, not silently applied. |
| **RV-11** | Minor | Parity deleted `licensing` from both apps, so App B licensing passed. | `normaliseForParity` strips licensing from App A only; new test rejects licensing on App B. |
| **RV-12** | Minor | Positive snapshot test built its input from the constants under test. | Test now reads `manifests/baseline.json` and asserts against independent requirement literals. |
| **RV-13** | Minor | `jira:issuePanel` `icon` marked Required=Yes in docs, ambiguous with its generic-icon fallback. | **Resolved 24 Nov 2026:** the official Atlassian icon URL was copied verbatim from the owner's own `forge create` scaffold; real `forge lint` and both deploys passed. PF-MAN-3 updated to Verified. No invented or third-party URL. |
| **RV-14** | Minor | `PF-RUN-1` (a platform fact) sat in the approval-id array. | Split into `APPROVAL_IDS` (owner decisions only) and `EVIDENCE_IDS`; both are separate baseline fields with separate tests. |
| **RV-15** | Minor | `check.mjs` skip text wrongly said P1.B1 owned the root manifest. | **Resolved 24 Nov 2026:** B1 owns `manifests/app-{a,b}.yml`; B2 owns `manifest.yml`. `scripts/render-root-manifest.mjs` copies one approved template byte-for-byte; `check-manifests.mjs` and `tests/manifest.test.ts` both enforce the tie, and `ROOT_MANIFEST_TARGET` is printed on every check. |
| **RV-16** | Minor | Builder emitted `licensing: { subscription: false }`, not the official field. | Corrected to `licensing: { enabled: true }` per **PF-MAN-1**; whether App A needs the block is still an owner/listing determination. |
| **RV-17** | **Major** | **D-VB-01 (independent Verification B):** three trigger event identifiers were not emitted by Atlassian (`created:comment`, `updated:comment`, `created:issue-link`); `forge lint` did not detect it. | **Resolved 24 Nov 2026:** model, both templates and root manifest now use the five official identifiers from PF-Q-3/PF-Q-4; two independent literals guard them (`tests/manifest.test.ts`, `scripts/check-manifests.mjs`); two new tests failed for the intended reason before the fix; B's re-review returned **PASS**, no new Blocker/Major; both apps redeployed to development. PF-V-1/PF-V-2; D-VB-01 in `docs/08-decisions.md`. |
| **GV-1** | **Major (process)** | Orchestrator self-audit: `D-011`, a self-authored technical note, was used as `KW_APPROVAL_TAG` for the locked-file commit and added to `APPROVAL_IDS`/`baseline.json`, whose contract is "owner decisions only". | **Corrected 24 Nov 2026:** D-011 removed from both lists and from the test literal; corrective commit uses genuine owner decision D-008 as its tag; gap recorded in `docs/08-decisions.md`. **Residual Minor:** `scripts/hooks/pre-commit.mjs:39` accepts any `/^D-\d+$/` string, so a future agent could repeat the pattern; owner to decide whether the guard must verify a decision is actually owner-approved. |
| **RV-18** | Minor | B's re-review noted `scripts/lib/manifest-model.mjs:7` still names `manifests/snapshot.json`, but the artifact is `baseline.json`. | Recorded, not changed in this fix (§5.6 smallest sound change); no runtime or guard effect. |

**U-B1-1 (Unresolved):** the baseline guard is a local tripwire: an agent with an owner approval tag can change both the model and `baseline.json`. It is not a substitute for owner control before M-1. Cleared by the 1 Dec manifest freeze review, not by another code check.

### 5.8 P4/P5 implementation gaps (24 Nov 2026)

| ID | Status | Finding | Proposed handling |
|---|---|---|---|
| **PS-1** | **Unresolved** | `Architecture.md` §6.1 names `issue_key_at_capture`, `comment_id`, `captured_at` and `scan_id` on `evidence_item`, but migration `004-evidence_item` does not define them. | The implemented service uses only columns that exist. Do not invent a migration change; record the gap for the architect/owner and reconcile the canonical design and schema in one change set. |
| **PS-2** | **Unresolved** | The deadline oracle confirms arithmetic agreement only; QA/RA-approved day-count conventions, holidays, time-zone rules and rule-set status remain absent (OI-1/OI-2). | Keep headline deadlines withheld under UNREVIEWED/PREVIEW; never claim legal reading. |
| **PS-3** | **Unresolved** | `npm run check` is green locally, but no live demo-site SQL/DDL, evidence capture, revalidation or role-gated resolver has been observed. | Keep P4/P5 unaccepted until integration evidence and Verification A/B exist on the current commit. |

---

## 6. Handoff block (AGENTS §6.6)

**Verified repository state:** branch `master` · pushed checkpoint `356b1b9` (`feat(p4-p5): add deadline core, oracle and evidence services`) · earlier demo-site installs remain App A v2.2.0 / App B v2.1.0 on `one-atlas-ttud`. The deployed apps are still the shell: this checkpoint adds local services and tests only; no redeploy was performed. Node `v24.22.3`, npm `11.19.1`, Forge CLI `15.1.0`.
**Last checks run:** `npm run check` in the commit's pre-commit gate → **PASS**, 30 test files, **260 tests**, strict types, lint, manifest parity, import boundary and Prettier; `forge lint` → **No issues found**. Saved evidence `evidence/P1/check-2026-11-24T14-49-00-445Z.txt` (HEAD `b866655`, uncommitted work) and `evidence/P4/oracle-agreement.txt` (10,000 differential runs, seed `20261206`, 15 tests). The independent oracle was written in a separate context and found a genuine all-non-working-weekday non-termination defect; it was fixed test-first at load and engine boundaries. Verification A/B for P4/P5 have not run, so no phase is Accepted.
**What was read:** `AGENTS.md` in full and all ten canonical files earlier, each to its last line. For this checkpoint: `docs/project/Implementation plan.md` P4/P5 task tables, `docs/08-decisions.md` D-013 and tail, `TODO.md` P4/P5 and handoff, the new P4/P5 source and test files, migration `004-evidence_item`, `src/contracts/authorisation.ts`, and the saved check/oracle evidence. No `docs/Project/` file was edited. No token, record text, quote or model I/O was supplied, seen or stored.
**Active task / branch:** P4 is **Awaiting verification** (all local tasks green; real rule data Blocked). P5 is **Active**: P5.0/A1–A3/B1–B2 are Completed locally; P5.C1/C2 FK reports, P5.D1 resolvers and P5.D2 FE slice remain. P1 remains Active, P2 and P3 Awaiting verification; no phase Accepted under §13. PREP-0 remains Active because QA/RA and canonical inputs are absent.
**Half-done work:** P5 services are not wired to resolvers or UI, and no live Jira/SQL integration was observed. P5.C1/C2 need property reports; P5.D1 must add resolver actions to the gate matrix; P5.D2 needs the FE trail/candidate block. Root `manifest.yml` remains on App A. The empty SQL migration is deployed and scheduled daily but its live run was not observed (PF-SQL-2). GV-1's hook residual (format-only `KW_APPROVAL_TAG`) is recorded, not changed. `PS-1` records the missing `evidence_item` design columns without silently editing the migration.
**Next ready task:** implement P5.C1/C2 property reports, then P5.D1 resolvers through the existing gate and P5.D2 UI slice; then proceed to P6 Signal Finder and P7 write-back toward the judge journey. No production deploy, listing, publish or share without owner approval (§10.2).
**Blockers:** QA/RA-approved rule data and locked canonical inputs (`docs/02-spec.md`, `docs/03-domain-rules.md`, `docs/05-stack-and-constraints.md`, `rules/*.json`, plan §12/P13/P14); clean site, outside organisation and a second model family; issueContext read-only permission (PF-JIRA-9); live migration and P4/P5 integration observation (PF-SQL-2, PS-3); hook approval-tag semantics (GV-1 Minor residual); PF-MP-1; D-PF-1 JSM write scope; U-B1-1; PS-1 evidence schema gap; PS-2 legal reading.
**Owner approvals (verbatim, dated):** **D-012 (24 Nov 2026): "I approved."** — Approval 1 of 4, permission to run the mutating judge journey as an outsider with synthetic data. It does not supply a clean site, outside organisation, second verifier or non-shell build. Site/org and independence branch points were resolved by recorded orchestrator choices under D-012, not by owner approval. **D-013 and D-014 are orchestrator technical records, not owner rulings.**
**Remaining open questions for the owner:** supply QA/RA rule data (`OI-1`), outside evidence (`OI-2`), PA-1…PA-5, DR-2 and plan §12/P13/P14, clean Jira/JSM site, outside organisation and two verifier contexts (or §13.5 exception). Decide GV-1's hook tag semantics, PF-MAN-1 and PS-1 schema reconciliation. The owner alone submits, publishes or shares.
**Mismatch found:** `TODO.md` still showed P4/P5 as `Not Started` while the repository contained green implementations; the ledger was corrected from repository evidence on this checkpoint. The oracle's saved evidence also described the pre-fix engine and earlier P5 failures; an orchestrator update was appended with the current `npm run check` result rather than erasing the subagent's original record. No `docs/Project/` file was changed.

---
**End of `TODO.md`.** Update on every status change; never record a claim here without evidence (AGENTS §14.4, §20.2).
