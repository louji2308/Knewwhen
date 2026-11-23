# KnewWhen — TODO (execution ledger)

**Version:** 0.1 · **Date:** 23 Nov 2026 · **Owner:** Orchestrator (single writer, AGENTS §9.2)
**Authority:** built from the canonical documents in `docs/Project/` (read-only, AGENTS §2.7). This file records progress; it is **not** proof and **not** a source of scope (AGENTS §14.1).
**Status words:** Not Started · Ready · In Progress · In review · Blocked · Completed (tasks, AGENTS §14.3). Phase status: Not started · Active · Awaiting verification · Accepted.
**Verified state at creation:** branch `master` · commit `0b16c8a5b9aff578fee3032a6cbebc709ddb8420` · tracks `origin/master` · worktree clean before this file was added.

---

## 1. Phase index

| ID | Name | Status | Entry condition | Exit condition | Owner | Link |
|---|---|---|---|---|---|---|
| **P0** | Bootstrap and contract readiness *(preparatory execution phase; not an `Implementation plan.md` phase)* | **Active** | Owner approved bootstrap and creation of this ledger | Repository state and capability gaps recorded; owner decisions on CF/OI and the missing plan/rule inputs either made or explicitly carried as Blocked; first implementation phase defined | Orchestrator | §2 below |
| — | Implementation phases (Core / Should) | **Not started** | `Implementation plan.md` exists and its phases, entry and exit conditions are known | Each phase section created with all its tasks `Not Started` (AGENTS §14.5), then executed and accepted (§13) | Orchestrator | Pending: `Implementation plan.md` is **not yet available** |

**Note (AGENTS §14.5):** no implementation phase sections are created here because `Implementation plan.md` (canonical file 9) does not exist yet (Scope OI-1; Appendix B-3). When it is supplied, its phases will be added to the index and given their own titled sections with every task initially `Not Started`. Historical sections are never overwritten.

---

## 2. Active phase — P0 Bootstrap and contract readiness

**Entry condition:** owner approval of the bootstrap and `TODO.md` creation (23 Nov 2026).
**Exit condition:** verified repository/capability state recorded; all blocking inputs either resolved or explicitly escalated; implementation phase index defined from `Implementation plan.md`.
**Owner:** Orchestrator.

| Task ID | Task | Requirement IDs / enabling | Dependencies | Status | Evidence | Blockers |
|---|---|---|---|---|---|---|
| **P0.1** | Read `AGENTS.md` in full and all ten canonical files at session start; report missing files | AGENTS §6.1–6.2; enables C-01–C-12, N-06 | None | **Completed** | Session read log: `AGENTS.md` (475 lines); `Idea.md` (112), `Hackathon.md` (458), `Winner Benchmarks.md` (233), `Tools and technologies.md` (177), `Architecture.md` (1174), `Scope.md` (516), `Workflow and UI demo.md` (1101), all read to last line. Missing: `Implementation plan.md`, `TODO.md` (before this file) | — |
| **P0.2** | Run bootstrap and capability checks (Git, Node/npm/Forge, hooks, ECC inventory) | AGENTS §0.1, §6.5, §19.1, Appendix A.3; enables N-03, N-06, C-12 | None | **Completed** | Shell output 23 Nov 2026: `master...origin/master`; `0b16c8a5b9aff…`; `node -v` → `v26.13.1`; `npm -v` → `11.20.0`; `forge --version` → `15.1.0` (warning: supports Node 22.x/24.x); `CLAUDE.md` absent; `package.json` absent; pre-commit hook absent. ECC 2.2.3 / doctor OK from the recorded 23 Nov install (not re-run this session) | — |
| **P0.3** | Reconstruct actual progress from repository and evidence; write recovery note | AGENTS §6.4, §14.4; enables all | P0.1, P0.2 | **Completed** | Verified state in §5 and in the session report; mismatch recorded (TODO absent, plan absent, Node warning) | — |
| **P0.4** | Create and maintain this ledger outside `docs/Project/` | AGENTS §14.1–14.6, §2.7; enables all | P0.3 | **Completed** | This file | — |
| **P0.5** | Owner decision on Scope conflicts CF-1 to CF-7 | C-01–C-12; AGENTS §2.6, §7.3–7.4 | `Scope.md` approval; owner | **Blocked** | `docs/Project/Scope.md` §5.1, status Draft v0.1 | Blocked by: owner decision. Contract defaults cannot drive work until approved. Continue unaffected design/read-only work only. |
| **P0.6** | Owner decision on Scope open items OI-1 to OI-10 | C-01–C-12, C-05/C-06/C-01 (OI-1), C-07 (OI-8); AGENTS §5.5 | Owner; supplied rule inputs | **Blocked** | `docs/Project/Scope.md` §5.2 | Blocked by: owner decision and missing `docs/03-domain-rules.md`, `rules/*.json`. |
| **P0.7** | Supply and confirm `Implementation plan.md`; create implementation phase sections | AGENTS §2.1, §11.1, §14.5 | Owner | **Blocked** | File absent; Phase index above records the gap | Blocked by: owner. No implementation phase can be honestly defined without it. |
| **P0.8** | Supply approved locked inputs: `IMPLEMENTATION_PLAN.md` §2.11, `docs/02-spec.md`, `docs/03-domain-rules.md`, `rules/*.json` | I-7; C-05, C-06, C-01; OI-1; AGENTS §2.2, §7.2 | Owner | **Blocked** | `Scope.md` §0, §5.2 OI-1; `Architecture.md` §1.1 U-1 | Blocked by: owner. Regulatory content may not be invented (I-7). |
| **P0.9** | Verify the A-11 platform assumptions before use (entity-property JQL, JSM internal comments, group lookup, personal-data mechanics, queue delay/retries, event IDs, LLM moderation) | C-07, C-08, S-03, N-04; OI-8; AGENTS §17.5 | Official documentation access | **Ready** | `Architecture.md` §18.2; `Workflow and UI demo.md` §1 | — |
| **P0.10** | Resolve local runtime mismatch: Node v26.13.1 installed; locked tools allow 22.23.4+ or 24.22.1+, Forge 15.1.0 warns it supports 22.x/24.x | Tools §4; N-06; AGENTS §12.1 | Owner / environment change | **Blocked** | Shell output P0.2 | Blocked by: owner decision — use Node 24.x locally, or accept the unsupported-version warning. |
| **P0.11** | Decide whether to add `CLAUDE.md` containing only `@AGENTS.md` (Claude Code reads `CLAUDE.md`, not `AGENTS.md`) | Tools §6; enables all builder tasks | Owner approval (original change set was `AGENTS.md`-only) | **Blocked** | `CLAUDE.md` absent; AGENTS preamble says verify when it exists | Blocked by: owner. Do not create without approval. |
| **P0.12** | Define the first implementation task and the critical path once P0.5–P0.8 are cleared | C-01–C-12; AGENTS §11.1–11.4 | P0.5, P0.6, P0.7, P0.8 | **Blocked** | `Scope.md` §4 core outcome; `Architecture.md` §3.3 | Blocked by: P0.5–P0.8. |

**Task status changes:** update a row when the status changes, not in batches (AGENTS §14.6). Do not mark `Completed` until the task's ACs pass and the evidence exists (§14.4).

---

## 3. Completed phases

None. No implementation phase has been accepted: Verification A, Verification B and orchestrator confirmation have not run (AGENTS §13). The governance commit `0b16c8a` is not a phase and is recorded here only as the verified baseline.

| Phase | Commit SHA | Verification A evidence | Verification B evidence | Accepted by |
|---|---|---|---|---|
| — | — | — | — | — |

---

## 4. Blockers and Unresolved

### 4.1 Owner decisions pending — Scope conflicts (`Scope.md` §5.1)

| ID | Effect on the build |
|---|---|
| **CF-1** | Modules/"fields": entity properties vs custom fields; glance, gadget and Rovo need approval. |
| **CF-2** | EU wording: Core is FDA-only; listing/video text must say "FDA deadlines; EU in preview". |
| **CF-3** | "Evidence-only": two switches (AI off/on; rule-set reviewed/preview/unreviewed); default unreviewed = no deadline numbers. |
| **CF-4** | Exact quotes vs no stored text: "(a) pointer + hash + live re-display" is the default; snapshot storage is Type C. |
| **CF-5** | Manifest freeze date; S-02/S-03 modules cannot be added late to App B. |
| **CF-6** | Write-back visibility cannot be role-limited outside the app; property is JQL-visible. |
| **CF-7** | Core records one rule-set version; multiple selectable versions are Should (S-04). |

### 4.2 Open items pending (`Scope.md` §5.2)

**OI-1** missing regulatory rule data · **OI-2** outside deadlines (practitioner review, trademark, partner verification) · **OI-3** decision without awareness date / under unreviewed rules · **OI-4** numeric limits (debounce, caps, lookback, thresholds) · **OI-5** precision/recall pass bars · **OI-6** accessibility level · **OI-7** numeric performance target · **OI-8** platform assumptions to verify · **OI-9** two-app plan H-11 · **OI-10** proposed additions PA-1 to PA-5.

### 4.3 Workflow findings needing decisions (`Workflow and UI demo.md` §0, all Proposed)

**WF-1** glance deprecated → `jira:issueContext` is Type C · **WF-2** panel hidden unless pinned · **WF-3** no event-occurrence field · **WF-4** restricted comments not scanned · **WF-5** CSV download mechanism unverified · **WF-6** sample identities/dates · **WF-7** importer may emit no events · **WF-8** earlier record can have its own case · **WF-9** new evidence on a decided case · **WF-10** FLAGGED → IN_REVIEW trigger undefined · **WF-11** routing-label setting missing from C-10 · **WF-12** manual case opening has no AC · **WF-13** headline number depends on 24 Nov review · **WF-14** JQL keys/aliases undefined · **WF-15** decision questions missing (OI-1) · **WF-16** lookback completeness depends on searcher.

### 4.4 Capability and environment gaps (Verified 23 Nov 2026)

- `Implementation plan.md`, `docs/02-spec.md`, `docs/03-domain-rules.md`, `rules/*.json` and `IMPLEMENTATION_PLAN.md` §2.11 are absent.
- No Forge app scaffold: `manifest.yml`, `package.json`, `migrations/`, `rules/` do not exist. `npm run check` cannot be run.
- No pre-commit hook installed; `CLAUDE.md` absent; `.opencode/` is intentionally ignored (owner decision D-002) and will not be present in a fresh clone.
- Node v26.13.1 installed; Forge 15.1.0 warns it supports Node 22.x/24.x.
- ECC hook registration was verified (`doctor: OK`, 549 operations, `outside-root=0`), but no functional hook firing was triggered or observed in this session.
- Verification A (clean-site install from an outside organisation) and Verification B plus an independent second context are not arranged; phase acceptance is **Blocked** (AGENTS §8.3, §13.5, Appendix B-2).
- Owner decisions recorded earlier: **D-001** scoped ECC install; **D-002** local OpenCode ECC with hooks enabled and `.opencode/` ignored (`docs/08-decisions.md`).

---

## 5. Handoff block (AGENTS §6.6)

**Verified repository state:** branch `master` · SHA `0b16c8a5b9aff578fee3032a6cbebc709ddb8420` · `origin/master` · clean before `TODO.md` was written · single worktree `C:/Users/LOUJAN B/Knewwhen`.
**Last checks run:** `git status --short --branch` → `## master...origin/master`; `git worktree list` → one worktree; `git log -1` → SHA above; `node -v` → `v26.13.1`; `npm -v` → `11.20.0`; `forge --version` → `15.1.0` with Node warning; `Test-Path CLAUDE.md` → False; `Test-Path package.json` → False; pre-commit hook → False. No test/lint/typecheck/build command exists yet, so none was run and none is claimed.
**What was read:** `AGENTS.md` in full (via the harness-supplied constitution, 475 lines) and, in full, `docs/Project/Idea.md`, `Hackathon.md`, `Winner Benchmarks.md`, `Tools and technologies.md`, `Architecture.md`, `Scope.md`, `Workflow and UI demo.md`. `docs/Project/` was not modified.
**Active task / branch:** P0 on `master`; no implementation branch exists.
**Half-done work:** none — implementation has not started. `TODO.md` is newly created and uncommitted.
**Next ready task:** P0.9 (A-11 platform verification). **No implementation task is Ready** until P0.5–P0.8 are cleared.
**Blockers:** CF-1–CF-7, OI-1–OI-10, WF-1–WF-16, missing plan and rule inputs, Node runtime mismatch, `CLAUDE.md` decision, absent clean site and independent verifiers.
**Open questions for the owner:** approve `Scope.md` or rule on CF-1–CF-7 and OI-1–OI-10; supply `Implementation plan.md` and the locked rule-data files; choose Node 24.x vs accept the Forge warning; decide on `CLAUDE.md`; confirm whether to commit and push `TODO.md`.
**Mismatch found:** `TODO.md` was absent before this file although AGENTS §14 requires it; the repository has no scaffold or checks; the local Node version is outside the locked range; documentation is present but all of it is Draft and the two canonical implementation files are missing.

---
**End of `TODO.md`.** Update on every status change; never record a claim here without evidence (AGENTS §14.4, §20.2).
