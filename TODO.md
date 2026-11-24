# KnewWhen — TODO (execution ledger)

**Version:** 0.7 · **Date:** 24 Nov 2026 · **Owner:** Orchestrator (single writer, AGENTS §9.2)
**Authority:** built from the canonical documents in `docs/Project/` (read-only, AGENTS §2.7). This file records progress; it is **not** proof and **not** a source of scope (AGENTS §14.1).
**Status words:** Not Started · Ready · In Progress · In review · Blocked · Completed (tasks, AGENTS §14.3). Phase status: Not started · Active · Awaiting verification · Accepted.
**Verified baseline:** branch `master` · commit `b0b850c885ef5d7bf3734c4dad14dcf469c75726` · tracks `origin/master` · clean worktree at the start of the P1.A1–A4 update. The toolchain checkpoint is the next commit (see `git log -1`).

---

## 1. Phase index

| ID | Name | Status | Entry condition | Exit condition | Owner | Critical? | Link |
|---|---|---|---|---|---|---|---|
| **PREP-0** | Bootstrap and contract readiness *(preparatory ledger phase; not an implementation phase)* | **Active** | Owner approved bootstrap and creation of this ledger | Repository state and capability gaps recorded; owner decisions on CF/OI and the missing plan/rule inputs either made or explicitly carried as Blocked; implementation index defined | Orchestrator | — | §2 |
| **P0** | Bootstrap, capability proof, decision packet | **Not started** | Plan approved | Capability record, `docs/platform-facts.md`, decision packet, external-status record, `evidence/P0/` complete | ORC | Yes | §3.1 |
| **P1** | Repository, toolchain, installable Forge shell | **Active** *(partial: A1–A4 only; formal entry conditions still open)* | P0.A1, A2, A3, B2 | `npm run check` green; hook tested; shell deployed and installed; parity passes; `evidence/P1/` | BE-1 / FA | Yes | §3.2 |
| **P2** | Platform foundation services | **Not started** | P1 shell deployed; P0.B1 facts; P2.D2 contracts pinned | Migrations, gate, Jira client, logger, settings/hash/audit; `evidence/P2/` | BE-1…BE-4 | Yes | §3.3 |
| **P3** | Pure core A: evidence core and scenario generator | **Not started** | P1 toolchain; P3 contract tasks | Normaliser, validator, screener, corpus, generator; `evidence/P3/` | BE-1…BE-3 / TE | Feeder | §3.4 |
| **P4** | Pure core B: deadline engine, rules loader, oracle | **Not started** | P1 toolchain; P4.A0 contract | Engine, independent oracle, ≥10,000-case differential run, golden cases; `evidence/P4/` | BE-1 / TE-O | Feeder | §3.5 |
| **P5** | Evidence and Trail services | **Not started** | P2 contracts; P3 IF-1/IF-2 accepted; P5.0 pinned | Evidence lifecycle, trail state machine, FE trail slice; `evidence/P5/` | BE-1 / BE-2 / FE | Yes | §3.6 |
| **P6** | Signal Finder and capture | **Not started** | P5 IF-8/IF-9; P3 and P2 accepted; P6.0 pinned | Trigger, scan consumer, AI fake/tests, record path, FE tab; `evidence/P6/` | BE-1 / BE-2 / TE | Near | §3.7 |
| **P7** | Write-back outbox | **Not started** | P2 IF-6/IF-7; P7.A0 schema; P7.0 pinned | Outbox, property, comment, retry, visibility fail-closed; `evidence/P7/` | BE-4 / FA | Feeder | §3.8 |
| **P8** | Lookback and benchmark | **Not started** | P5 accepted; P3 generator/normaliser; P8.0 pinned | Matcher/ranker, lookback service, benchmark, FE tab; `evidence/P8/` | BE-2 / TE / FE | Yes (co-critical) | §3.9 |
| **P9** | Deadlines, decision record, rule-status gating | **Not started** | P4 + P5 + P7 accepted; question-set state known | Deadline service, decision service, write-back, FE slices; `evidence/P9/` | BE-3 / BE-4 / FE | Yes (co-critical) | §3.10 |
| **P10** | Product surfaces, admin, sample, reconciler | **Not started** | Admin slice: P2 accepted; rest: P6, P8, P9 | Admin, sample, case header, reconciler, polish; `evidence/P10/` | FE / BE-1 / BE-3 | Yes | §3.11 |
| **P11** | Should tier | **Not started** | P9 accepted; Core stable; M-1 decisions fixed | Each shipped Should item passes its ACs, or is cut by record | BE-3 / BE-1 / FE | No | §3.12 |
| **P12** | Marketplace track and App A submission | **Not started** | M-1; installable P6+P7 slice; partner status known | Outside-org install; listing/privacy pages; submission ticket URL; `evidence/P12/` | OWN / RD / SP | Parallel | §3.13 |
| **P13** | Release-candidate QA, security, evidence pack | **Not started** | P10 accepted; P11 accepted or cut | Whole-product A and B, evidence pack; `evidence/P13/` | ORC / SP / TE | Yes | §3.14 (gap) |
| **P14** | Judge-ready build, demo and submission | **Not started** | P13 accepted; P12 submitted | Judge-ready build, demo, owner submission | RD / OWN | Yes | §3.14 (gap) |

**Note (AGENTS §14.5):** implementation phase sections below are derived from `Implementation plan.md` §10. The file is **Approved v0.1** (D-003, 24 Nov 2026) and its task tables end at P12; P13/P14 are named in the index but have no task sections in the file, so no task list is invented for them (§3.14).

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
| **PREP-0.5** | Owner decision on Scope conflicts CF-1 to CF-7 | C-01–C-12; AGENTS §2.6, §7.3–7.4 | `Scope.md` approval; owner | **Blocked** | `docs/Project/Scope.md` §5.1, Draft v0.1 | Blocked by: owner decision. Contract defaults cannot drive work until approved. |
| **PREP-0.6** | Owner decision on Scope open items OI-1 to OI-10 | C-01–C-12, C-05/C-06/C-01 (OI-1), C-07 (OI-8); AGENTS §5.5 | Owner; supplied rule inputs | **Blocked** | `docs/Project/Scope.md` §5.2 | Blocked by: owner decision and missing `docs/03-domain-rules.md`, `rules/*.json`. |
| **PREP-0.7** | Supply, approve and track `Implementation plan.md`; create implementation phase sections from its task tables | AGENTS §2.1, §11.1, §14.5 | Owner supplied the file | **Completed** | `docs/Project/Implementation plan.md` (682 lines) read to last line; owner approval D-003 (24 Nov 2026); plan tracked in Git; phase index and P0–P12 checklists in §3; P13/P14 gap in §3.14 | — |
| **PREP-0.8** | Supply approved locked inputs: `IMPLEMENTATION_PLAN.md` §2.11, `docs/02-spec.md`, `docs/03-domain-rules.md`, `rules/*.json` | I-7; C-05, C-06, C-01; OI-1; AGENTS §2.2, §7.2 | Owner | **Blocked** | `Scope.md` §0, §5.2 OI-1; `Architecture.md` §1.1 U-1 | Blocked by: owner. Regulatory content may not be invented (I-7). |
| **PREP-0.9** | Verify the A-11 platform assumptions before use (storage, queue/events, LLM, Jira visibility/UI, JSM, Marketplace, six scopes) | C-07, C-08, S-03, N-04; OI-8; N-03(a); AGENTS §17.5 | Official documentation access | **Completed** | `docs/platform-facts.md` v1.0: 4 parallel read-only agents, official URLs and 24 Nov 2026 access dates, orchestrator spot-checks, §7 discrepancy log, §8 scope mapping; 33 facts Verified and 6 Unresolved with named fallbacks | — |
| **PREP-0.10** | Resolve local runtime mismatch: select a Forge-supported Node line | Tools §4; N-06; AGENTS §12.1 | Owner decision D-005 | **Completed** | `nvm install 24` → 24.22.3; `nvm use 24.22.3`; `nvm list` → `* 24.22.3 (default)`; fresh-shell `node -v` → `v24.22.3`; `forge --version` → `15.1.0` with no Node warning; D-005 | — |
| **PREP-0.11** | Add `CLAUDE.md` containing only `@AGENTS.md` | Tools §6; enables all builder tasks | Owner decision D-004 | **Completed** | `CLAUDE.md` created with one line `@AGENTS.md`; D-004 | — |
| **PREP-0.12** | Define the first implementation task and the critical path once PREP-0.5–0.8 are cleared | C-01–C-12; AGENTS §11.1–11.4 | PREP-0.5–PREP-0.8 | **Blocked** | Approved plan §4 names `P0 → P1 → P2 → P5 → {P8 ∥ P9} → P10 → P13 → P14` as critical path (D-003) | Blocked by: CF/OI decisions and missing locked inputs. |

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
| P0.A3 | Tools §7, Hackathon §14 | A1 | OWN | **Not Started** | Forge/token/site/user setup without secrets | Plan approval; owner access |
| P0.A4 | AGENTS §2.3, PC-6 | A1 | ORC | **Not Started** | File-name mapping in decision log | Plan approval |
| P0.B1 | Arch §18.2, OI-8 | A1 | DR | **In review** | `docs/platform-facts.md` §2–6, §7 (Verified URL/date or Unresolved fallback) | Formal P0 acceptance awaits A1–A3; preparatory research complete under PREP-0.9 |
| P0.B2 | Arch §13.2, N-03(a) | A1 | DR | **In review** | `docs/platform-facts.md` §8 scope identifier table | Formal P0 acceptance awaits A1–A3; `forge lint` not yet run |
| P0.B3 | Workflow §0 | A1 | DR | **In review** | `docs/platform-facts.md` §5–6 (CSV/importer/panel facts) | Formal P0 acceptance awaits A1–A3; WF-1/2/5/7 rulings pending |
| P0.B4 | Hackathon §11 | A1 | DR | **In review** | `docs/platform-facts.md` §6 (Marketplace update-path facts) | Formal P0 acceptance awaits A1–A3; PF-MP-1 Unresolved |
| P0.C1 | AGENTS §7.4 | B1–B4 (partial OK) | PRQ + ORC | **Not Started** | Decision packet delivered | Plan approval |
| P0.C2 | AGENTS §7.4 | C1 | ORC | **Not Started** | Dated replies in `docs/08-decisions.md` | Plan approval; owner replies |
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
| P1.B1 | N-03(a), N-08 | A1, DR-2 | FA | **Not Started** | Parity passes; negative injection fails | A1; DR-2 |
| P1.B2 | Arch §3.2, G-8 | A1, B1 | FA + BE-1 | **Not Started** | Install log; app under Apps | A1, B1; Forge access |
| P1.B3 | N-03(g), I-13 | B2 | FA | **Not Started** | `forge lint` and `forge eligibility` output | B2 |
| P1.B4 | Arch §17.2, DR-14 | B1 | OWN | **Not Started** | App A/B IDs recorded | B1; owner |

### 3.3 P2 — Platform foundation services

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P2.D2 | Arch §12 | P1 | FA | **Not Started** | Frozen IF-6/7/14/15 and envelope | P1 |
| P2.A1 | N-04(a,e), N-07, B-9 | D2 | BE-1 | **Not Started** | Column check; migration runs twice | D2 |
| P2.A2 | Arch §12, §18.2 | A1, P0.B1 | BE-1 + TE | **Not Started** | Fake validated against verified SQL facts | A1; P0.B1 |
| P2.B1 | N-01(b,d), N-03(c), C-07.10, G-3 | D2 | BE-2 | **Not Started** | FK tests; sixth write unreachable | D2 |
| P2.B2 | N-04(a), N-09, I-6 | D2 | BE-2 + SP | **Not Started** | Canary fails build on leak | D2 |
| P2.C1 | Arch §6.2, C-10.4, N-04(b) | D2, A1 | BE-3 | **Not Started** | Race test; missing key blocks capture | D2, A1; U-3 |
| P2.C2 | G-5, N-07 | A1 | BE-3 | **Not Started** | Append-only FK test | A1 |
| P2.D1 | G-4, Arch §13.3 | D2, A1, B1, C1, C2 | BE-4 | **Not Started** | Handler × role × browse matrix; deny on failure | D2, A1, B1, C1, C2 |

### 3.4 P3 — Pure core A: evidence core and scenario generator

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P3.A1 | Arch §6.3, I-1 | P1 | BE-1 | **Not Started** | Golden corpus green; IF-1 pinned | P1 |
| P3.A2 | C-01.1, G-2 | A1 | BE-1 | **Not Started** | Property tests green; IF-2 pinned | A1 |
| P3.A3 | C-01.2 | A2 | TE | **Not Started** | Seeds and counts logged | A2 |
| P3.A4 | Arch §16.1, I-1 | A1 | TE | **Not Started** | Corpus digest and version-freeze tag | A1 |
| P3.B1 | C-01.4, Arch §7.3, PC-4 | A2 | BE-2 | **Not Started** | UT green; empty lexicon → DEGRADED; IF-3 pinned | A2; OI-1 |
| P3.B2 | C-01.13, C-12 | B1 | TE | **Not Started** | Metrics table in `evidence/` | B1 |
| P3.C1 | C-08.4, Tools §4 | P1 | BE-3 | **Not Started** | Byte-identical CSV for same seed | P1 |
| P3.C2 | C-08.2, C-08.6, I-12 | C1 | BE-3 + TE | **Not Started** | Fixtures pass I-12 check | C1; WF-6 |

### 3.5 P4 — Pure core B: deadline engine, rules loader, oracle

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P4.A0 | Arch §10.2, I-7 | P1, DR-9 | FA + DR | **Not Started** | Rule-data contract frozen; IF-4/5/16 pinned | P1; owner review |
| P4.A1 | C-05.3, C-05.9 | A0 | BE-1 | **Not Started** | Loader UT; fails closed | A0 |
| P4.A2 | C-05.1, C-05.2, C-05.4 | A1 | BE-1 | **Not Started** | No clock/I/O in static check | A1 |
| P4.A3 | Arch §10.1, C-04.4 | A0 | BE-1 | **Not Started** | Near-midnight zone tests | A0; time-zone rule |
| P4.B1 | C-05.6, Arch §10.6 | A0 | TE-O | **Not Started** | Separate context/history; no engine imports | A0; independence |
| P4.B2 | C-05.5, C-05.7, FX-1 | A0; D1/D2 for real values | DR + TE | **Not Started** | Golden results; real set Blocked until data | A0; OI-1/OI-2 |
| P4.B3 | C-05.6 | A2, B1 | TE-O | **Not Started** | Seed/count ≥10,000; metamorphic results | A2, B1 |
| P4.C1 | C-05.11, G-1 | A2 | SP | **Not Started** | Wording and import-boundary scan green | A2 |

### 3.6 P5 — Evidence and Trail services

| ID | Req / ref | Depends | Owner | Status | Evidence required | Blockers |
|---|---|---|---|---|---|---|
| P5.0 | Arch §12 | P2.D2 | FA | **Not Started** | IF-8/IF-9 and state vocabulary frozen | P2.D2 |
| P5.A1 | C-04.1, N-04 | P5.0 | BE-1 | **Not Started** | FK; canary no text in SQL | P5.0; hash key |
| P5.A2 | C-04.8–10, Arch §6.4 | A1 | BE-1 | **Not Started** | Five states and ambiguous 403/404 FK | A1 |
| P5.A3 | C-04.1, Arch §6.4 | A1 | BE-1 | **Not Started** | Strength-labelling FK | A1 |
| P5.B1 | C-04.2, C-04.5, C-04.7, C-04.11 | P5.0 | BE-2 | **Not Started** | Append-only FK | P5.0; WF-10 |
| P5.B2 | C-04.4, C-04.6 | B1, P4.A3 | BE-2 | **Not Started** | No preselection UT | B1, P4.A3 |
| P5.C1 | Arch §16.1 | P5.0 | TE | **Not Started** | Evidence lifecycle FK reports | P5.0; SC-5 |
| P5.C2 | G-7 | P5.0 | TE | **Not Started** | Idempotency/replay FK reports | P5.0 |
| P5.D1 | G-4 | A2, B1 | BE-2 | **Not Started** | Role matrix updated | A2, B1 |
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

The supplied `Implementation plan.md` names P13 and P14 in §3 milestones, §4 critical path and §9 phase index, but §10 ends at P12 (file line 682). There are **no task tables** for P13 or P14 in the supplied file. Per AGENTS §5.4 and §14.5, no tasks are invented here.

| ID | Needed from owner | Status | Evidence required | Blockers |
|---|---|---|---|---|
| **GAP-P13** | P13 phase section: outcome, entry, tasks, VA scope, VB focus, exit/evidence | **Blocked** | Owner-supplied canonical section or approved task list | Missing from `Implementation plan.md` §10 |
| **GAP-P14** | P14 phase section: outcome, entry, tasks, VA scope, VB focus, exit/evidence | **Blocked** | Owner-supplied canonical section or approved task list | Missing from `Implementation plan.md` §10 |

---

## 4. Completed phases

None. No implementation phase has been accepted: Verification A, Verification B and orchestrator confirmation have not run (AGENTS §13). The governance commits are not phases and are recorded only as verified baselines.

| Phase | Commit SHA | Verification A evidence | Verification B evidence | Accepted by |
|---|---|---|---|---|
| — | — | — | — | — |

---

## 5. Blockers and Unresolved

### 5.1 Owner decisions pending — Scope conflicts (`Scope.md` §5.1)

| ID | Effect on the build |
|---|---|
| **CF-1** | Modules/"fields": entity properties vs custom fields; glance, gadget and Rovo need approval. |
| **CF-2** | EU wording: Core is FDA-only; listing/video text must say "FDA deadlines; EU in preview". |
| **CF-3** | "Evidence-only": two switches (AI off/on; rule-set reviewed/preview/unreviewed); default unreviewed = no deadline numbers. |
| **CF-4** | Exact quotes vs no stored text: "(a) pointer + hash + live re-display" is the default; snapshot storage is Type C. |
| **CF-5** | Manifest freeze date; S-02/S-03 modules cannot be added late to App B. |
| **CF-6** | Write-back visibility cannot be role-limited outside the app; property is JQL-visible. |
| **CF-7** | Core records one rule-set version; multiple selectable versions are Should (S-04). |

### 5.2 Open items pending (`Scope.md` §5.2)

**OI-1** missing regulatory rule data · **OI-2** outside deadlines (practitioner review, trademark, partner verification) · **OI-3** decision without awareness date / under unreviewed rules · **OI-4** numeric limits (debounce, caps, lookback, thresholds) · **OI-5** precision/recall pass bars · **OI-6** accessibility level · **OI-7** numeric performance target · **OI-8** platform assumptions to verify · **OI-9** two-app plan H-11 · **OI-10** proposed additions PA-1 to PA-5.

### 5.3 Workflow findings needing decisions (`Workflow and UI demo.md` §0, all Proposed)

**WF-1** glance deprecated → `jira:issueContext` is Type C · **WF-2** panel hidden unless pinned · **WF-3** no event-occurrence field · **WF-4** restricted comments not scanned · **WF-5** CSV download mechanism unverified · **WF-6** sample identities/dates · **WF-7** importer may emit no events · **WF-8** earlier record can have its own case · **WF-9** new evidence on a decided case · **WF-10** FLAGGED → IN_REVIEW trigger undefined · **WF-11** routing-label setting missing from C-10 · **WF-12** manual case opening has no AC · **WF-13** headline number depends on 24 Nov review · **WF-14** JQL keys/aliases undefined · **WF-15** decision questions missing (OI-1) · **WF-16** lookback completeness depends on searcher.

### 5.4 Capability and document gaps (Updated 24 Nov 2026)

- `Implementation plan.md` is present, **Approved v0.1** (D-003) and tracked in Git; its contents were not edited. PLAN-1 and PLAN-6 are resolved.
- `CLAUDE.md` now exists with one line `@AGENTS.md` (D-004), resolving the Tools §6 gap.
- Local Node is `v24.22.3` by default via nvm (D-005); Forge 15.1.0 runs without the Node-version warning. PREP-0.10 is resolved.
- The following canonical inputs remain absent: `IMPLEMENTATION_PLAN.md` §2.11, `docs/02-spec.md`, `docs/03-domain-rules.md`, `docs/05-stack-and-constraints.md`, `rules/*.json`.
- No Forge app scaffold: `manifest.yml`, `package.json`, `migrations/`, `rules/` do not exist. `npm run check` cannot be run. The solution is plan **P1.A1–A4**: create `package.json`, strict TypeScript/Vitest/fast-check config, `npm run check`, and a tested pre-commit hook.
- No pre-commit hook installed. `.opencode/` is intentionally ignored (owner decision D-002) and will not be present in a fresh clone.
- ECC hook registration was verified (`doctor: OK`, 549 operations, `outside-root=0`), but no functional hook firing was triggered or observed.
- Verification A (clean-site install from an outside organisation) and Verification B plus an independent second context are not arranged; phase acceptance is **Blocked** (AGENTS §8.3, §13.5, Appendix B-2). The solution is plan **P0.A2/A3**: prove a second independent context and obtain Forge access, two developer sites/test users and an outside organisation; if independence cannot be proven, the owner decides under §13.5 and the phase stays unaccepted until then.
- Owner decisions recorded: **D-001** scoped ECC install; **D-002** local OpenCode ECC with hooks enabled and `.opencode/` ignored; **D-003** plan v0.1 approved and tracked; **D-004** `CLAUDE.md`; **D-005** Node 24.x (`docs/08-decisions.md`).
- A-11 platform facts are now recorded in `docs/platform-facts.md` v1.0 (24 Nov 2026): 33 Verified, 6 Unresolved with named Arch §18.2 fallbacks. Discrepancies D-PF-1…D-PF-7 are logged there; D-PF-3 was reconciled and Resolved. New owner decisions needed: JSM write scope (D-PF-1), WF-1/WF-2 panel choice, WF-5 export mechanism, PF-MP-1 in-review updates. Runtime proof still needed for upsert, index lag and CSV import events. No platform/scope file was edited.

### 5.5 Implementation-plan gaps (Verified 23 Nov 2026)

| ID | Finding | Effect | Proposed handling |
|---|---|---|---|
| **PLAN-1 — Resolved 24 Nov** | `Implementation plan.md` was Draft v0.1 at first read (lines 3–6). | Blocked implementation from starting. | Owner approved v0.1 and required tracking (D-003); resolved. |
| **PLAN-2** | §10 ends at P12; P13/P14 have no task tables although named in §3, §4 and §9. | Cannot create faithful P13/P14 checklists (AGENTS §14.5). | Owner supplies the missing §10 sections or approves a task list; see §3.14. |
| **PLAN-3** | §2.4 refers to §12 decision register `DR-1`…`DR-18`, but no §12 section exists in the supplied file. | Decision defaults and costs cannot be read from the canonical file. | Owner supplies §12, or the orchestrator records each DR in `docs/08-decisions.md` after owner replies. |
| **PLAN-4** | PC-3 proposes interface-level Verification A for pure phases P3/P4; AGENTS §13.2 says VA runs against the running product. | Literal rule would block pure phases. | Owner confirms DR-17 before P3/P4 acceptance. |
| **PLAN-5** | PC-7 requires a live hosted-model call for AI-path evidence; AGENTS §10.2 requires owner approval for any live Forge LLM call. | P6/P13 evidence has a cost gate. | Owner approves or rejects DR-18; tests never call the model. |
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

---

## 6. Handoff block (AGENTS §6.6)

**Verified repository state:** branch `master` · last verified toolchain/harness checkpoint `3324c7c` (local, not pushed) · tracks `origin/master` at `b0b850c` · clean worktree after that commit. Official harness docs were read and `docs/harness-matrix.md` records the result.
**Last checks run:** clean-directory `npm ci` → 132 packages, exit 0; `npm run check` → **PASS** with evidence `evidence/P1/check-2026-11-24T04-38-12-186Z.txt` (strict types, lint, format, 2 tests); eight injected-violation probes each exited 1; installed hook fired via Git's shell → `PRE-COMMIT: PASS`, exit 0; `npm run setup` → hook + both OpenCode agents installed; removing an agent's `edit` deny made setup exit 1 and the restored source passed again (`evidence/P1/setup-probe-2026-11-24T04-36-33Z.txt`); `opencode debug agents/config` → agents and deny rules loaded; independent review found 0 Blocker/Major and 2 Minor, both fixed; `git diff --check` clean apart from LF→CRLF notices; secret scan of new files → no matches. `forge lint` skipped honestly (no `manifest.yml`). No deploy, install or phase acceptance is claimed.
**What was read:** `AGENTS.md` in full and all nine canonical files now present, each to its last line, earlier in the conversation. For this task: `Hackathon.md` §5–§9, `Implementation plan.md` §10 P0/P1/P2, `Tools and technologies.md` in full, `Scope.md` §5.1–5.2, `Workflow and UI demo.md` §0, and `docs/08-decisions.md`. The independent reviewer read `AGENTS.md` in full plus the 19 changed files. No canonical file content was edited.
**Active task / branch:** P1 harness/toolchain work on `master`; no implementation branch. P1.A1–A5 are **Completed**; P1 is **Active** but not Accepted (formal entry conditions P0.A1–A3 remain open). P0.B1–B4 remain In review.
**Half-done work:** none in P1.A1–A5. P1.B1–B4 are Not Started. Four expert calls E-1–E-4 are recorded as **Proposed** baselines, not approvals; no new scope, module or rule content was added.
**Next ready task:** no P1.B task is Ready: P1.B1 needs DR-2 and the missing plan §12; P1.B2 needs Forge access and manifest decisions. Owner actions P0.A2/A3 and D1–D4 remain ready for the owner. No feature phase is Ready.
**Blockers:** PLAN-2–PLAN-5, CF-1–CF-7, OI-1–OI-10, WF-1–WF-16, missing locked inputs, no Forge scaffold/deploy, no clean site and no independent verifiers; plus PF-MP-1 (in-review code updates) and D-PF-1 (JSM write scope). PLAN-1 and PLAN-6 are Resolved; D-PF-3 Reconciled; RV-1–RV-8 Resolved.
**Open questions for the owner:** rule on CF-1–CF-7 and OI-1–OI-10; supply the plan's §12 register and P13/P14 sections and the locked rule-data files; ratify or reverse E-1–E-4 (each reversal is Type C); decide D-PF-1, WF-1/WF-2, WF-5 and PF-MP-1; provide Forge access, an outside organisation and two independent verifier contexts (or decide under AGENTS §13.5); approve pushing the local toolchain/harness checkpoints to `origin/master` (§10.2, §15.6). Already approved D-003–D-006; D-007 is a Verified technical implementation, not an approval item.
**Mismatch found:** P1.A1–A4 were authorised and executed early although P1's formal entry conditions (P0.A1–A3) are not met; the ledger says so rather than claiming P1 acceptance. The reviewer found two Major boundary gaps and six Minor hardening gaps, all fixed and re-probed. The plan still references P13/P14 and §12 sections absent from the supplied file; platform research found D-PF-1, D-PF-2 and reconciled D-PF-3. None was silently smoothed over.

---
**End of `TODO.md`.** Update on every status change; never record a claim here without evidence (AGENTS §14.4, §20.2).
