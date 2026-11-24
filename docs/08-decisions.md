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
