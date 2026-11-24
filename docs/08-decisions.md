# Decision log — KnewWhen

**Purpose:** record owner decisions required by `AGENTS.md` §7.4 and §19.3, and the capability inventory required by §19.1.
**Authority:** only the KnewWhen owner approves. Agents propose; approval is never inferred from silence or from a tool's output.
**Location:** `docs/08-decisions.md`, outside the read-only `docs/Project/` directory (`AGENTS.md` §2.7, §2.2).
**Status words:** as defined in `AGENTS.md` §3. Every approval quotes the owner's reply and gives its date.

---

## D-001 — ECC 2.2.3, project-local OpenCode install (Approved)

- **Date:** 23 Nov 2026
- **Status:** Approved — owner reply quoted below; recorded here under `AGENTS.md` §7.4 and §19.3.
- **What:** ECC 2.2.3 installed as local tooling into `KnewWhen\.opencode\` for the **OpenCode** harness only, with the harness-specific `opencode` profile (commands, platform configs, workflow quality; **no** hook runtime at this step), one install method only.
- **Why needed:** the owner requested ECC from `https://aarunverse.com/ecc/?from=dm`. ECC is not in the approved stack (`Tools and technologies.md` §2–3), so a §7.4 proposal is mandatory before any install. The link is an affiliate/marketing page, not an install source; only the official GitHub/npm channel was used.
- **Licence / cost class:** MIT licence, free open-source core. ECC Pro (paid) and the GitHub App were **not** proposed and were not installed. Possible unquantified cost: extra model tokens from additional skills/commands.
- **Impact:** 309 file operations, all under `KnewWhen\.opencode\`; no global config, no `docs/Project/`, no `AGENTS.md`. OpenCode is a **Beta** adapter with a capability-limited subset; Windows native has open defects in continuous-learning v2 and memory-vault writes (#2489, #2626). Skill/behaviour overlap exists with existing KnewWhen roles; under §19.5 KnewWhen's `AGENTS.md` wins wherever ECC conflicts.
- **Alternatives considered:** reject ECC (no new capability); Claude Code target (not this session); user-global scope (wider blast radius); `full` profile (hook runtime and highest overlap). All rejected in favour of the approved scoped install.
- **Official sources:** <https://github.com/affaan-m/ECC> · <https://www.npmjs.com/package/ecc-universal/v/2.2.3> · <https://ecc.tools>. Marketing-page counts (71 agents / 314 skills) differ from the official README (72 / 328); per §3.3 the marketing figures are **Unverified** and were not used.
- **Owner reply (23 Nov 2026, harness question):** "Approve scoped install"; "OpenCode (this session)"; "Project-local, minimal".
- **Exact versions and method (Verified 23 Nov 2026):** release tag `v2.2.3`, commit `c05b2d6614f62f6db0047669aa4eefb223d478f9`, `VERSION=2.2.3`, npm package `ecc-universal@2.2.3`, Node `v26.13.1`, npm `11.20.0`. Installed with `npm install --ignore-scripts --no-audit --no-fund`, `npm run build:opencode`, then `node scripts/install-apply.js --profile opencode --target opencode` with `OPENCODE_CONFIG_DIR` pointing at `KnewWhen\.opencode`.
- **Verification:** dry run exited 0 with 309 operations and zero destinations outside `KnewWhen\.opencode\`; apply exited 0; `node scripts/ecc.js doctor --target opencode` → `Status: OK`, `Issues: none`, `errors=0`; installed `opencode.json` parsed with an empty `plugin` array (hooks off); 48 `SKILL.md` files, 100 command files, 25 agent prompts on disk.

## D-002 — ECC OpenCode hook runtime (Approved)

- **Date:** 23 Nov 2026
- **Status:** Approved — owner reply quoted below; recorded here under `AGENTS.md` §7.4, §10.2 and §19.3.
- **What:** add ECC's `hooks-runtime` module to the existing project-local OpenCode install and enable the hook runtime. OpenCode discovers the plugin independently of `opencode.json` registration; enabling writes the real plugin instead of the disabled stub.
- **Why needed:** the previous report listed hook enablement as requiring separate approval because it changes the automated enforcement posture (`AGENTS.md` §10.2). The owner gave that approval explicitly.
- **Licence / cost class:** same MIT-licensed ECC 2.2.3 core; no paid tier, no new dependency beyond the already-installed tooling. Cost class: free OSS; token impact of automatic hooks unquantified.
- **Impact:** 549 file operations, all under `KnewWhen\.opencode\` (verified zero outside-root destinations); hooks and hook scripts are now present and the plugin is registered as `./plugins` in `.opencode/opencode.json`. Third-party hook scripts may now run automatically on OpenCode events. No shared/global config and nothing under `docs/Project/` was touched. §19.5 precedence is unchanged: KnewWhen's `AGENTS.md` wins on any conflict.
- **Owner reply (23 Nov 2026):** "Add it to .gitignore and create it and then go ahead proper update for the 3rd one also". This is interpreted as approval of all three items in the preceding report: ignore `.opencode/`, create this decision log, and enable the hook runtime (item 3).
- **Exact command (Verified 23 Nov 2026):**
  `OPENCODE_CONFIG_DIR="C:\Users\LOUJAN B\Knewwhen\.opencode" node scripts/install-apply.js --profile opencode --modules hooks-runtime --enable-hooks --target opencode`
- **Verification:** dry run exited 0 with 549 operations and `outside-root=0`; apply exited 0; install-state records `hookConsent: "enabled"` and selected modules `commands-core, hooks-runtime, platform-configs, skill-unified-memory, workflow-quality`; `hooks/hooks.json` and `hooks/codex-hooks.json` parse as JSON; `.opencode/plugins/index.ts` exports the real `ECCHooksPlugin` (not the disabled stub); `opencode.json` plugin array is `./plugins`; `node scripts/ecc.js doctor --target opencode` → `Status: OK`, `Issues: none`, `errors=0`.
- **Uninstall path (recorded, not executed):** remove the ignored `.opencode/` directory. No tracked project file depends on it. Any future hook disable/re-enable is a new §10.2 decision.
- **Risks:** OpenCode ECC support is Beta; Windows-native defects remain open; hook scripts are third-party automation; behaviour overlap with existing skills; no functional hook firing was tested in this session, only installation, registration and ECC's own doctor check.

## D-003 — Implementation plan v0.1 approved and tracked (Approved)

- **Date:** 24 Nov 2026
- **Status:** Approved — owner reply quoted below; recorded here under `AGENTS.md` §7.4.
- **What:** approve `docs/Project/Implementation plan.md` Draft v0.1 as the execution blueprint and track that file in Git.
- **Owner reply (24 Nov 2026):** "implementation plan must be tracked and i approve the v0.1".
- **Impact:** phase index P0–P14 and task tables P0–P12 are now an Approved plan, not merely Proposed input. Implementation has not started. The file remains inside read-only `docs/Project/`; this decision records approval and tracking, not an edit to its contents.
- **Still open:** the supplied plan's §12 decision register and its P13/P14 phase sections are absent; PLAN-2 and PLAN-3 in `TODO.md` remain Blocked. CF-1…CF-7 and OI-1…OI-10 remain owner decisions.
- **Verification:** the file was read in full to line 682 on 23 Nov 2026; `git status` before this decision showed `?? docs/Project/Implementation plan.md`; the approval commit adds it to the repository without modifying the file.

## D-004 — CLAUDE.md refers to AGENTS.md (Approved)

- **Date:** 24 Nov 2026
- **Status:** Approved — owner reply quoted below; recorded here under `AGENTS.md` §7.4 and the preamble requirement to verify `CLAUDE.md`.
- **What:** create `CLAUDE.md` at repository root containing exactly one line: `@AGENTS.md`.
- **Why needed:** the repository had no `CLAUDE.md`; Claude Code reads `CLAUDE.md`, while KnewWhen's operating rules live in `AGENTS.md` (Tools §6).
- **Owner reply (24 Nov 2026):** "create the CLAUDE.md file with one line that refer to AGENTS.md".
- **Impact:** Claude Code can load the same constitution without duplicating or forking it. No other instruction text was added.
- **Verification:** `Get-Content CLAUDE.md` → `@AGENTS.md`; `git status` will show the new tracked file in the approval commit.

## D-005 — Local Node 24.x selected (Approved)

- **Date:** 24 Nov 2026
- **Status:** Approved — owner reply quoted below; recorded here under `AGENTS.md` §0.1 and Tools §4.
- **What:** replace the unsupported local Node v26.13.1 with the locked Node 24.x line via nvm.
- **Why needed:** `Tools and technologies.md` §4 allows Node 22.23.4+ or 24.22.1+; Forge CLI 15.1.0 warned that it supports Node 22.x or 24.x. The local runtime was v26.13.1.
- **Owner reply (24 Nov 2026):** "choose node 24.x change it currently i am using 26.x using nvm i think so. Update it to whatever that supports".
- **Exact commands (Verified 24 Nov 2026):** `nvm install 24` → `Installed 1 version: 24.22.3`; `nvm use 24.22.3` → `Now using Node.js v24.22.3 by default.`; `nvm alias default 24.22.3` returned `cannot use "default" (reserved name)` and was not retried because `nvm use` already set the default.
- **Verification:** `nvm list` → `* 24.22.3  (default)` with `26.13.1` still installed as a fallback; fresh-shell `node -v` → `v24.22.3`; fresh-shell `forge --version` → `15.1.0` with no Node-version warning in the output.
- **Impact:** PREP-0.10 resolved. `npm -v` under the new runtime → `11.19.1`.

## Capability inventory (Verified 23 Nov 2026, `AGENTS.md` §19.1)

| Item | Result | Method |
|---|---|---|
| ECC before setup | Not installed | `Get-Command ecc`, `agentshield`; plugin and marketplace registries; no ECC references in user config |
| Harness for this session | OpenCode | harness environment |
| `claude`, `opencode`, `forge`, `git`, `node`, `npm`, `npx` | Present | `Get-Command` |
| Project-local `.claude/`, `.opencode/`, `CLAUDE.md`, `scripts/hooks/` before setup | Absent | `Test-Path` |
| User `~\.claude\`, `~\.config\opencode\opencode.json` | Present, no ECC/hook references | directory listing + `Select-String` |
| Project files created by ECC | `.opencode/` only; now ignored by `.gitignore` | `git status`, `git check-ignore -v` |
| `docs/Project/` | Untouched (read-only) | `git status`, directory listing |
| ECC hooks after D-002 | Installed, registered, doctor OK | see D-002 verification |

## Capability changes (Verified 24 Nov 2026)

| Item | Result | Method |
|---|---|---|
| Local Node runtime | `v24.22.3`, default via nvm; `v26.13.1` retained as fallback | `nvm install 24`, `nvm use 24.22.3`, `nvm list`, `node -v` |
| Forge CLI under Node 24 | `15.1.0`; no Node-version warning in output | `forge --version` |
| `CLAUDE.md` | Present at repository root; one line `@AGENTS.md` | `Get-Content CLAUDE.md`, D-004 |
| `Implementation plan.md` | Approved v0.1 and to be tracked in Git; content unchanged | D-003, `git status`, this decision log |
| `npm run check` | Still absent; no Forge scaffold exists | `Test-Path package.json`, `git status`; solution belongs to plan P1 |

---

## D-006 — Repository toolchain and check harness (Approved)

- **Date:** 24 Nov 2026
- **Status:** Approved — owner reply quoted below. The enabler (plan P1.A1–A4) was approved at an earlier point in this conversation; its exact wording was not preserved in this log. This entry records the later instruction that authorised starting it.
- **What:** create the repository layout, `package.json`, strict `tsconfig.json`, ESLint flat config with an import-boundary rule, Prettier, Vitest, fast-check, `npm run check`, `npm run setup`, the dependency and import static checks, and a plain Git pre-commit hook. One `PRODUCT_NAME` constant is included so a rename is cheap (plan R-9).
- **Why needed:** the repository had no `package.json`, no check command and no commit guard; plan P1.A1–A4 is on the critical path and requires no Forge access, no new product decision and no regulatory content.
- **Owner reply (24 Nov 2026):** "go ahead and proceed" — given after the expert decision report named P1.A1–A4 as the approved, dependency-free enabler being started.
- **Licence / cost class:** free open-source, dev-only. Exact versions and licences **Verified 24 Nov 2026** from each installed `node_modules/<pkg>/package.json`:

| Package | Version | Licence | Reason for pin |
|---|---|---|---|
| `typescript` | 6.0.3 | Apache-2.0 | `typescript-eslint` 8.74 declares peer `typescript >=4.8.4 <6.1.0`; TS 7.0.2 would violate it. |
| `typescript-eslint` | 8.74.0 | MIT | Current release compatible with ESLint 10 and TS 6. |
| `eslint` | 10.15.0 | MIT | Approved dev tool (Tools §5). |
| `prettier` | 3.10.1 | MIT | Approved dev tool (Tools §5). |
| `vitest` | 5.1.1 | MIT | Approved dev tool (Tools §5); seed lives at `test.sequence.seed`. |
| `fast-check` | 4.11.0 | MIT | Approved dev tool (Tools §5). |
| `@types/node` | 24.19.2 | MIT | Matches the locked Node 24.x runtime, not the local fallback 26.x. |

- **Impact:** runtime `dependencies` is empty (I-10); all 132 installed packages are dev-only. No `docs/Project/` file, locked rule file, scope, module or product behaviour was changed. Evidence is written to `evidence/P1/`.
- **Alternatives considered:** TypeScript 7.0.2 (latest) rejected for the peer-range conflict; `@types/node` 26.6.6 rejected as a runtime mismatch; newest-blindly policy rejected as unsafe. No new dependency outside Tools §5 was introduced.
- **Verification (Verified 24 Nov 2026):** `npm install --no-audit --no-fund` → `added 132 packages`; a clean-directory `npm ci --no-audit --no-fund` using only `package.json` and `package-lock.json` → `added 132 packages`, exit 0; `npm run check` → **PASS** with 2 test files, 2 tests, strict typecheck, lint and format clean; evidence at `evidence/P1/check-2026-11-24T04-21-26-255Z.txt`. Negative probes each exited **1**: an injected runtime dependency, an injected `src/core/` import of `@forge/api` (caught by both the static check and ESLint), a `.tsx` side-effect import of `@forge/ui`, a test file and an oracle-named file under `src/`, a non-exact version pin, a staged file under `rules/`, and a staged deletion of `docs/Project/Scope.md` (temporary index, no canonical file touched). `npm run setup` → hook installed at `.git\hooks\pre-commit` and its shim content verified. An independent read-only review found 2 Major and 6 Minor gaps; all were fixed and re-probed (TODO §5.7).
- **Not verified:** `forge lint` was skipped because no `manifest.yml` exists (P1.B1 owns it); no Forge deploy, install or phase acceptance is claimed; no independent verifier has yet reviewed this change.

---

## D-007 — Harness guards and read-only agent mirrors (Verified technical implementation)

- **Date:** 24 Nov 2026
- **Status:** **Verified** for installation and configuration loading. No owner approval was needed: this is a technical choice inside the approved toolchain and governance workflow (`AGENTS.md` §5.3 kind B), not a new dependency, scope, permission grant, module or product decision. It tightens existing guards; it does not disable or weaken one (`AGENTS.md` §10.2).
- **What:** add root `opencode.json` (OpenCode V2 `permissions`), `.claude/settings.json` (Claude Code `permissions.deny`), tracked read-only `reviewer` and `judge` definitions for both harnesses, and extend `npm run setup` so the OpenCode definitions are copied into the ignored `.opencode/agents/` directory. `docs/harness-matrix.md` v1.0 records the method, date and gaps.
- **Why needed:** plan P1.A5 and `AGENTS.md` §19.1–19.2 require an evidence-backed harness inventory; §7.2 requires a locked-file guard; §8.3 requires genuinely independent verifier contexts. The Git hook remains the enforced backstop, so harness configuration is defence in depth, not the boundary.
- **Licence / cost class:** none. No package was added; these are project configuration and Markdown files. No record text, quote, model I/O or secret is stored in them.
- **Impact:** file-tool edits under `docs/Project/`, `rules/`, and the three named locked docs are denied in the configured harnesses; `reviewer`/`judge` are installed as subagents with edit, shell and nested-subagent access denied. No `docs/Project/` content, rule data, scope, tier, module or runtime behaviour changed.
- **Official sources (accessed 24 Nov 2026):** <https://opencode.ai/docs/config/> · <https://opencode.ai/docs/permissions/> · <https://opencode.ai/docs/agents/> · <https://docs.claude.com/en/docs/claude-code/settings> · <https://docs.claude.com/en/docs/claude-code/permissions> · <https://docs.claude.com/en/docs/claude-code/sub-agents>.
- **Verification (Verified 24 Nov 2026):** both JSON files parse; `npm run setup` → PASS for the hook and both OpenCode agents; temporarily removing the `edit` deny from the reviewer source made setup exit **1**, after which the source was restored and setup passed again (`evidence/P1/setup-probe-2026-11-24T04-36-33Z.txt`); `opencode debug config` shows the root V2 document loaded; `opencode debug agents` lists `reviewer` and `judge` as subagents with the expected deny rules; `npm run check` → **PASS** with evidence `evidence/P1/check-2026-11-24T04-38-12-186Z.txt`. The installed Git hook had already fired through Git's shell with `PRE-COMMIT: PASS`, exit 0.
- **Discrepancies recorded, not smoothed over:** HM-1 — ECC 2.2.3 writes V1-style config keys in ignored `.opencode/opencode.json`; OpenCode v2.3.2 normalises them and the new tracked config uses V2 only. HM-2 — `.opencode/` is ignored, so tracked source plus setup copying is required. HM-3 — a separate reviewer context worked, but not yet through the final agent files or a second model family. HM-4 — harness denies were not tested by attempting a real locked-file edit; shell edits can bypass file-tool rules.
- **Not verified:** real harness enforcement of a locked-file edit; exercise of the final agents in a task or phase gate; worktree creation; a second independent model family or fresh gate context. Phase acceptance and Verification A/B remain **Blocked** under AGENTS §8.3 and §13.5.

---

## D-008 — Owner ruling batch, 24 November 2026 (Approved)

- **Date:** 24 Nov 2026
- **Status:** **Approved.** The owner's exact reply is reproduced below. It supersedes any conflicting Proposed baseline, including E-2 and the conservative assumption in E-4.
- **Source:** owner message titled “# Owner Ruling Batch — 24 November 2026” in this session. Section numbers are stable; each ID below is binding where it differs from an earlier Proposed call.
- **Method:** decisions are recorded here and in `TODO.md`. No file under `docs/Project/` was edited. Where a canonical file would need a wording change, the update is listed as pending rather than made silently (AGENTS §2.7, §7.6).
- **Scope impact:** approves the module choice, manifest freeze, rule-status model, evidence-retention limit, operational defaults as **Proposed engineering values**, two-app strategy, interface-level verification for pure phases, one controlled live LLM call, P13/P14 draft task list, and owner-controlled release/access rules. It does **not** supply missing regulatory rule data, Forge credentials, a clean site, an outside organisation or verifier contexts.

### Owner reply (verbatim)

> # Owner Ruling Batch — 24 November 2026
>
> ## 1. Approved engineering decisions
>
> **CF-1 / E-2 / WF-1 / WF-2**
> - Use `jira:issueContext` as the preferred primary entry point, subject to read-only permission verification.
> - Do not use deprecated `jira:issueGlance`.
> - Defer dashboard gadget and Rovo.
> - Use `jira:entityPropertySet` for searchable metadata.
> - Defer the three custom fields unless a specific native-field requirement is demonstrated.
>
> **CF-2:** FDA deadlines; EU in preview.
>
> **CF-3 / WF-13:**
> - Separate AI screening enablement from regulatory rule-set status.
> - Only APPROVED rule sets may produce regulatory deadline calculations.
> - PREVIEW and UNREVIEWED rules must not generate operational deadlines.
> - Preserve evidence-only investigation.
>
> **CF-4:** Approve option (a) for MVP: pointers, timestamps, keyed hashes, live re-display and MODIFIED/UNAVAILABLE indicators. Do not claim immutable evidence retention.
>
> **CF-5:** Freeze first manifest on 1 December 2026. Exclude dashboard gadget and Rovo from the first submission.
>
> **CF-6:** Accept Jira Browse permission visibility with explicit disclosure. Jira entity properties contain only non-sensitive metadata. Sensitive decision data stays in Forge SQL. Comments must fail closed.
>
> **CF-7:** Record rule-set ID, version, digest, jurisdiction and effective date for every calculation and decision.
>
> **E-1:** Keep JSM write-back held. Proceed with Jira-only write-back.
>
> **E-3 / WF-5:** Use option (b), copyable CSV in a code block. Do not implement a fake download.
>
> **E-4 / PF-MP-1:** Freeze the release candidate for review. Allow only documented critical fixes through controlled releases; do not assume code-only changes are officially prohibited.
>
> **WF-4:** Disclose that restricted comments are not scanned. Never claim complete organisational coverage.
>
> **WF-6:** Use seed, anchor date and generator version for deterministic sample data. Keep real admin identity exclusively in audit metadata.
>
> **WF-8:** Never automatically merge cases. Handle each case independently.
>
> **WF-9:** New evidence becomes PROPOSED. A qualified person must create a new decision version.
>
> **WF-10:** First substantive case action triggers IN_REVIEW. Viewing, routing and manual scanning do not.
>
> **WF-11:** Add configurable namespaced routing label. Never overwrite existing labels.
>
> **WF-12:** Add manual case opening to acceptance criteria.
>
> **WF-16:** Record searcher, timestamp and search scope. Provide Search again as me. Mark incomplete searches explicitly.
>
> **OI-6:** Target WCAG 2.2 AA, with actual accessibility testing.
>
> **OI-7:** No unsupported numeric performance SLA. Instrument and benchmark before establishing one.
>
> **WF-3:** Accept baseline. Keep event occurrence and company awareness separate.
>
> **WF-7:** Accept manual scanning fallback for imported issues.
>
> ## 2. Regulatory and missing-input decisions
>
> **OI-1 / WF-15:** Do not invent regulatory rule data. Require qualified QA/RA approval for day-count conventions, timezones, awareness definitions, decision questions, answer vocabulary and signal lexicon.
>
> **OI-2:** Practitioner review, trademark clearance and partner verification remain UNVERIFIED until evidence is supplied. Use FDA-only evidence mode until rule review is completed.
>
> **OI-3:**
> - Allow recording a case with an undetermined awareness date.
> - Allow provisional decisions under unreviewed rules.
> - Do not calculate deadlines or permit final regulatory closure under unreviewed rules.
>
> **OI-4:** Prepare proposed operating defaults:
>
> - Debounce: 5 seconds.
> - One automatic LLM call per unique content version.
> - LLM budget: 100 requests per installation per day.
> - Input/output budget: 8,000 / 1,000 tokens.
> - Manual scans: 5 per user per 10 minutes.
> - Lookback: 2 relationship hops.
> - Initial/extended lookback: 500 / 2,000 records.
> - Display: maximum 25 candidates, with remaining count.
> - Evidence quote: 1–1,000 characters.
> - Reminders: 7, 3 and 1 days before deadline; once daily overdue.
>
> These are proposed engineering defaults, subject to benchmarking and approval.
>
> Do not automatically discard low-strength matches. Exact quote validation must reject every non-verbatim quote. LLM failure must never become NO_SIGNAL_FOUND.
>
> **OI-5:** Honest precision/recall reporting only. No invented hard pass percentages. Report sample sizes and actual results. HIGH must represent stronger evidence than MEDIUM.
>
> **OI-8:** Use verified or explicitly documented fallbacks. Do not claim runtime proof without actual tests. The missing Architecture §18.2 fallback definitions remain to be reconciled.
>
> **OI-9:** Accept the two-app strategy. App A is the Marketplace submission. App B is the unlicensed judge-install build. Both must originate from a recorded Git commit.
>
> ## 3. Additional technical approvals
>
> **WF-14:** Draft the `knewwhen.case-index` property schema and JQL aliases for approval. Forge SQL remains authoritative; Jira entity properties are only a searchable projection.
>
> **PLAN-2:** Approve a proposed P13/P14 task list in TODO.md, clearly marked as a draft, not as a replacement for the missing canonical implementation plan.
>
> **PLAN-3:** Record explicitly supplied owner rulings. Do not invent DR-1 through DR-18.
>
> **PLAN-4 / DR-17:** Approve interface-level verification for pure phases. Integrated functionality requires running-product verification.
>
> **PLAN-5 / DR-18:** Approve one controlled live Forge LLM call using synthetic data only. Record usage and cost. Automated tests must not invoke the live model.
>
> **OI-10 / PA-1 to PA-5:** Keep unapproved until the actual descriptions and implementation implications are supplied.
>
> ## 4. Access and verification
>
> Forge credentials, developer site, clean installation site and outside organisation are not yet supplied. Keep dependent verification tasks BLOCKED.
>
> Require two independent verifier contexts. If unavailable, document the exception and leave acceptance conditional.
>
> Defer Rovo MCP.
>
> Preserve the rule that only the owner submits, publishes or shares the application.
>
> ## 5. Documentation and implementation
>
> - Record approved decisions with dates in docs/08-decisions.md.
> - Update TODO.md with exact requirement IDs.
> - Do not edit anything under docs/Project/.
> - Keep missing inputs and unverified requirements visible.
> - Reconcile the manifest with the approved scope before freezing it.
> - Implement tests before implementation acceptance.
> - Run npm run check.
> - Maintain traceability between requirements, tests, decisions and commits.
>
> Do not silently convert proposed values into approved regulatory rules or claim verification that has not occurred.

### Effect on earlier baseline calls

| ID | Effect of D-008 |
|---|---|
| **E-1** | **Ratified.** JSM write-back stays held; Jira-only write-back proceeds. |
| **E-2** | **Superseded.** `jira:issueContext` is now the preferred primary entry point, subject to read-only permission verification. `jira:issueGlance` stays excluded. The original panel-only + manual-pin baseline is retained only as history; no claim is made that WF-2 pinning was separately approved. |
| **E-3** | **Ratified.** Copyable CSV in a Code block; no fake download. |
| **E-4** | **Modified by owner ruling.** Freeze the release candidate, but allow documented critical fixes through controlled releases; do not assert that code-only changes are officially prohibited. PF-MP-1 remains **Unresolved** as a platform fact. |
| **CF/OI/WF/PLAN/DR** | Approved, partially approved or kept unapproved exactly as recorded in `TODO.md` §5.1–5.5; no broader permission or scope is inferred. |

### Pending canonical wording updates (not performed)

- `Scope.md`: CF-1…CF-7 and OI-1…OI-10 disposition records; OI-4 values remain Proposed, not rule data.
- `Workflow and UI demo.md`: WF-1…WF-16 disposition records, especially the `jira:issueContext` preference and WF-6 generator inputs.
- `Architecture.md`: module baseline, manifest/scope freeze, property projection vs SQL authority, and the E-4 critical-fix release path.
- `Implementation plan.md`: P13/P14 sections and §12 `DR` register remain absent; D-008 records only the owner-supplied DR-17 and DR-18 rulings.
- These are **pending**, not edits. `docs/Project/` remains untouched.

### Not verified by D-008

No Forge token, developer site, clean install site, outside organisation, verifier contexts, QA/RA rule data, trademark evidence or partner verification was supplied. No runtime proof was claimed. The Codegeist resources page was opened in the connected browser on 24 Nov 2026 (`HTTP 200`); an earlier plain fetch returned `403`, but a later `webfetch` re-check succeeded, recorded in `docs/platform-facts.md` §12.

### Draft deliverables produced under D-008 (24 Nov 2026)

- **OI-4:** `docs/proposals/oi-4-operating-defaults.md` v0.1 records every supplied numeric default as **Proposed**, plus the already-Approved behavioural constraints. No value was written to `rules/*.json`; no benchmark or SLA is claimed.
- **WF-14:** `docs/proposals/wf-14-case-index-projection.md` v0.1 recorded the proposed property, aliases, JQL examples, SQL-authoritative rule and tests. It was **not approved at D-008**; D-009 below approved it and resolved both conflicts.
- **New conflicts held open:** WF-14-C1 — owner's `knewwhen.case-index` vs canonical `knewwhen.case` (`Architecture.md` §11.3, `Scope.md` C-07). WF-14-C2 — owner's `jira:entityPropertySet` vs canonical `jira:entityProperty` (`Architecture.md` §3.6/§13.2, `Scope.md` C-07). Both need an owner ruling before manifest work; neither was silently changed.
- **Platform gap added:** PF-JIRA-9 records that official `jira:issueContext` documentation does not state a Viewers/read-only permission rule. D-008's preference is therefore conditional on a clean-site permission check.

---

## D-009 — Blanket approval of outstanding rulings (Approved)

- **Date:** 24 Nov 2026
- **Status:** **Approved.** The owner's exact reply is reproduced below.
- **Scope of interpretation:** the orchestrator treats “every decision” as approval of the four outstanding decisions listed in the preceding final report: push of local commit `9214e28`; WF-14-C1; WF-14-C2; and the OI-4 draft values. Each is resolved below using the **recommended option** that was presented to the owner. If the owner meant something narrower, the record must be corrected before dependent work proceeds.
- **Not included:** supplying Forge credentials, a site URL, test users, an outside organisation or verifier contexts is not a decision and remains Blocked. Supplying QA/RA rule data and canonical plan sections also remains Blocked.

### Owner reply (verbatim)

> i approved every decision and what are the forge access details you need can you tell me clearly, i also need you to what site url you yourself fetch instead of uinsg browser use web fetch or web search and then tell me the clear steps for codegeist url for about the api key

### Approved resolutions

| ID | Decision now Approved | Effect |
|---|---|---|
| **PUSH-1** | Push local commit `9214e2830edf476ea2d2b8ca639b30042776aff8` and this D-009 checkpoint to `origin/master`. | Integration-branch push is authorised. |
| **WF-14-C1** | Retain the canonical property key **`knewwhen.case`**. The `knewwhen.case-index` name in D-008 is superseded. | No canonical key rename. Pending wording update only if needed; `docs/Project/` untouched here. |
| **WF-14-C2** | Use **`jira:entityPropertySet`** for the searchable projection. This is an explicit owner-approved module change from the canonical `jira:entityProperty` baseline. | Record as Type C approval under AGENTS §7.4. Manifest, scope snapshot and parity tests must be updated when P1.B1/B2 are implemented. |
| **OI-4** | The ten OI-4 numeric defaults are **Approved operating defaults**. | They may be implemented as configuration/settings when the relevant service exists. They are **not** regulatory rule data, are not written to `rules/*.json`, and are not a performance SLA. Benchmarking still required before any SLA claim. |
| **WF-14 draft** | The property/alias schema in `docs/proposals/wf-14-case-index-projection.md` is approved in principle, subject to the two resolutions above and to QA/RA approval of enum vocabulary. | Can be used as the implementation contract. No record text or personal data in the property. |

### Pending after D-009

- Update `Architecture.md`/`Scope.md` wording for the approved `jira:entityPropertySet` module at the next owner-authorized canonical update; do not edit them here.
- Keep `knewwhen.case` in all manifests, tests, JQL and docs.
- Complete the Forge access checklist before any deploy, install or Verification A.
- Confirm the `jira:issueContext` read-only permission on a clean site (PF-JIRA-9) before the 1 Dec manifest freeze.

---

## D-010 — Demo site access and P1.B1 entry interpretation (24 Nov 2026)

- **Access facts: Verified.** The owner supplied the provisioned site `one-atlas-ttud` / `https://one-atlas-ttud.atlassian.net`, active, expiry **2027-02-22** (after judging). `forge whoami` confirms the CLI is authenticated as the owner's account. Details and sources are in `docs/platform-facts.md` §13 (PF-CLI-1…4, PF-JIRA-10/11, PF-RUN-1). No token value was supplied or stored.
- **Finding, not a decision:** the CLI is `15.1.0`; `16.0.0` is advertised. No upgrade applied — a toolchain change needs an owner ruling under AGENTS §7.4. Minor finding only; current version works.
- **DR-2 interpretation: Inferred, reversible.** The canonical plan §12 decision register (DR-1…DR-18) is still absent, but D-008 and D-009 contain explicit owner rulings covering DR-2's entire content: baseline modules, the approved `jira:entityPropertySet` change, the `jira:issueContext` preference, no glance/gadget/Rovo/custom fields, and the six N-03 scopes. The orchestrator therefore treats P1.B1's entry condition as met **for reversible local tooling only**. This is an interpretation, not a new decision; the owner may correct it. It does not authorise a deploy, a manifest freeze or a phase acceptance.
- **Not included:** real App A/App B IDs (P1.B4 is an owner task); the `jira:issueContext` Viewer permission check (PF-JIRA-9); a second site or organisation; verifier contexts.

---

## D-011 — P1.B2 shell dependencies and manifest corrections (Verified technical implementation, 24 Nov 2026)

- **Class:** technical choices inside the approved architecture (AGENTS §5.3 kind B). No new module, scope, role, screen, setting, dependency class or tier; D-008 and D-009 still govern. Proposer and implementer: orchestrator in the backend/Forge role. Recorded because §7.4 requires an exact version and licence log for every tool and package used.
- **Runtime packages (pinned exactly; method `npm view <pkg> version license --json`, npmjs registry, 24 Nov 2026):**

| Package | Version | Licence | Why it is needed |
|---|---|---|---|
| `@forge/resolver` | `2.0.2` | SEE LICENSE IN LICENSE.txt | Resolver shell; identity read from platform context only. |
| `@forge/bridge` | `7.4.0` | SEE LICENSE IN LICENSE.txt | UI `invoke('knewwhenShell', …)`. |
| `@forge/react` | `12.6.0` | SEE LICENSE IN LICENSE.txt | UI Kit components used by the panel/admin/context shell. |
| `@forge/sql` | `4.0.11` | SEE LICENSE IN LICENSE.txt | Official `migrationRunner` for the plan's "first empty migration". |
| `react` | `18.3.1` | MIT | Required peer of `@forge/react` and the UI Kit bundle. |

- **Install note:** npm reported peer warnings from Atlaskit packages pinned to React 16/17; they are transitive UI Kit peers, not installed runtime replacements. Root `react` stayed at the approved `18.3.1`. No package outside I-10's official `@forge/*` + built-in Node class was added at runtime.
- **Manifest corrections forced by real tooling:** the `jira:issuePanel` icon is the official Atlassian asset URL copied verbatim from the owner's `forge create` scaffold (resolves PF-MAN-3); `scheduledTrigger.interval` changed from the invented `24h` to the official enum value `day` (source fetched 24 Nov 2026). Both are recorded in `docs/platform-facts.md` §14/§16.
- **Bundler correction:** `tsconfig.json` uses `module: ESNext` and `moduleResolution: Bundler`. `NodeNext` with `.js` specifiers passed `tsc` but failed the real Forge bundle (`Can't resolve './adapters/forge-resolver.js'`); extensionless imports fixed it and the deploy then succeeded.
- **Local CLI telemetry:** `forge settings set usage-analytics false` was applied after Sentry telemetry caused `getaddrinfo ENOTFOUND o55978.ingest.sentry.io` during install. This is a reversible local CLI preference, not an app check, hook, permission or scope, and no repository file records a credential.
- **Explicitly not included:** no production deploy, Marketplace listing, publish or share; no new site, organisation or verifier context; no phase acceptance. Deploy and install evidence is in `evidence/P1/` and indexed in `evidence/P1/README.md`.
- **Correction GV-1 (orchestrator self-audit, 24 Nov 2026):** D-011 was wrongly used as `KW_APPROVAL_TAG` for the locked-file commit and added to `APPROVAL_IDS`/`manifests/baseline.json`, whose own contract is "Owner decisions only". D-011 is **not** an owner ruling. It was removed from both lists; the corrective commit uses genuine owner decision D-008 as its tag. Residual (Minor): `scripts/hooks/pre-commit.mjs:39` checks only the tag's `/^D-\d+$/` format, and the `D-` numbering no longer exclusively denotes owner rulings. Both are recorded for the owner; neither was used to justify a scope change.

---

## D-012 — Approval 1 of 4: Verification A arrangement (owner, 24 Nov 2026)

- **Class:** owner approval under AGENTS §7.4 and §10.2. Recorded verbatim; the orchestrator must not expand its meaning.
- **Owner's exact wording:** "I approved." (24 Nov 2026), in reply to the orchestrator's *Approval 1 of 4 — Verification A arrangement*, which asked for a ruling on (1) site + organisation, (2) mutating permission for the judge journey, and (3) verifier independence.
- **What this grants (Proposed→Approved):** authority to perform a clean install and drive the mutating judge journey steps 1–9 using synthetic data only (I-12), and to mutate synthetic sample issues on a designated site. This clears the *permission* gate for the verifier.
- **What this does NOT grant:** a clean site, an outside organisation, a second verifier on a different model family, a §13.5 exception, production deploy, listing, publish or share, or any scope/tier change. Approval is permission, **not** provision of the resources or a non-shell build.
- **Two branch points remain Unresolved because the wording "I approved" does not select between the alternatives offered:**
  1. **Site + organisation:** clean site **and** outside organisation, *or* `one-atlas-ttud` with a fresh synthetic project while "outside-org install" stays **Unresolved**.
  2. **Independence (§8.3/§13.5):** provide a second verifier context on a different model family, *or* an explicit §13.5 exception accepting Verification A as **Blocked**.
- **Structural dependency recorded, not smoothed over:** Verification A also remains **Blocked** on PF-V-3 because the deployed build is a shell with no sample loader, case surface or decision surface. Even with permission, a non-shell Core build must exist before the full journey can pass. P1 cannot be Accepted on this approval alone (§13.5).
- **Orchestrator decisions on the two branch points (24 Nov 2026, under the owner's "work until the end" mandate, AGENTS §5.3 kind B — recorded as the orchestrator's, NOT as owner approval):**
  1. **Site/org:** use the existing authorised demo site `one-atlas-ttud` with a fresh synthetic project. No second site or outside organisation exists in this environment; "outside-org install" stays **Unresolved**. This chooses the only available branch; it invents no resource.
  2. **Independence:** use a separate verifier context (as for A and B in P1). A different model family is not available in this harness; that remains a recorded limitation under §13.1, not an owner decision.
- **Consequence:** Verification A still cannot pass while the build is a shell. The orchestrator is therefore proceeding with P2 foundation services (which need no regulatory data) before any re-run of A. No irreversible action taken on the ambiguous parts.

---

## VER-B-P1 — trigger event identifiers corrected (technical correction, 24 Nov 2026)

- **Finding D-VB-01 (Major, Verification B initial report):** `TRIGGER_EVENTS` declared `avi:jira:created:comment`, `avi:jira:updated:comment` and `avi:jira:created:issue-link`, none of which Atlassian emits. The repo's own Verified facts PF-Q-3/PF-Q-4 and the canonical Workflow doc give `avi:jira:commented:issue` (creation **and** edit), `avi:jira:deleted:comment` and `avi:jira:created:issuelink`. Saved `forge lint` output did not detect this, so a linter pass is not evidence of event correctness (A-11).
- **Fix:** the five official identifiers were written into `scripts/lib/manifest-model.mjs`; both templates and root `manifest.yml` were re-rendered; two independent literals now guard them (`tests/manifest.test.ts`, `scripts/check-manifests.mjs`). The two new tests were confirmed failing for the intended reason before the implementation change. This restores already-Verifiable facts; it adds no module, scope or tier and needs no owner decision.
- **Re-review:** Verification B's second pass returned **PASS** on closure, no new Blocker or Major, with static `file:line` evidence in model, both templates and root manifest. Orchestrator re-ran `npm run check` (PASS, 37 tests) and redeployed both apps to **development**: App A v2.2.0, App B v2.1.0, both eligible for Runs on Atlassian (program check, not an award — I-13). Evidence is indexed in `evidence/P1/README.md`.
- **Not Verified by B itself:** B has no shell in its context; command output remains Inferred from saved files there. Independence of context was available; a different model family remains unavailable and is recorded as a limitation.

---

## Expert baseline calls E-1 to E-4 (Proposed — no new scope taken)

**Historical status: Proposed, not Approved at the time.** The owner later ruled on all four in D-008 (24 Nov 2026): E-1 and E-3 **Ratified**, E-2 **Superseded** by the `jira:issueContext` preference, and E-4 **Modified** by the controlled critical-fix exception. The table below is retained for traceability; D-008 governs. Proposer: orchestrator in the expert-engineer role, 24 Nov 2026.

| ID | Question answered | Expert call and reason | What would need owner approval |
|---|---|---|---|
| **E-1** | May KnewWhen write an internal comment in a JSM request? | **Keep JSM write-back held.** The official API needs a JSM write scope that Architecture §13.2 does not request. Adding it before the manifest freeze is a permission change, not an implementation detail. Jira-only write-back proceeds. | Approve `write:servicedesk-request` or the granular equivalent, logged as Type C. |
| **E-2** | Which module carries the nudge, given glance deprecation and edit-permission gating of `jira:issuePanel`? | **Baseline `jira:issuePanel` only + the manual "Show for all work items" admin step.** Pinning from app code would be a sixth Jira write outside the C-07.10 allow-list. No new module. | Approve `jira:issueContext` before the manifest freeze. |
| **E-3** | How does the admin get the evidence CSV out of UI Kit? | **Show the CSV in a Code block for copy** (workflow option b). No native download mechanism was found; no Custom UI. It stays truthful and leaves the numbers computed on the judge's site. | Approve a verified download mechanism or the fixed pre-generated file before the guide is frozen. |
| **E-4** | May code-only fixes be deployed while a Marketplace listing is under review? | **Assume no.** Freeze code at submission; publish a patched version after approval. No official statement grants the permission. | An official Atlassian answer (external contact needs §10.2 approval), or an explicit owner risk decision. |

**Futuristic readiness, not futuristic scope.** No speculative feature was added: that would be Kind C scope creep and would consume the Core-only runway. Instead the seams that make later additions cheap were built or planned — the `PRODUCT_NAME` constant (R-9), rules-as-versioned-data (I-7), the import-boundary and dependency guards, and the planned manifest renderer with parity and scope-snapshot checks. The four calls above stay reversible until the manifest freeze.
