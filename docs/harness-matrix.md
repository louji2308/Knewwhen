# KnewWhen — harness support matrix (plan P1.A5 / T-03)

**Version:** 1.0 · **Date:** 24 Nov 2026 · **Owner:** Orchestrator
**Authority:** `AGENTS.md` §0.1, §19.1–19.2; `Tools and technologies.md` §6; approved `Implementation plan.md` P1.A5.
**Purpose:** record which agent-harness capabilities actually work here, how each was checked, and what remains unproven. This is evidence, not a product decision. Status words follow `AGENTS.md` §3.

---

## 1. Verified environment

| Item | Result | Method and date |
|---|---|---|
| Claude Code | `2.1.330 (Claude Code)` | `claude --version`, 24 Nov 2026 |
| OpenCode | `opencode v2.3.2` | `opencode --version`, 24 Nov 2026 |
| Forge CLI | `15.1.0`, no Node-version warning | `forge --version`, 24 Nov 2026 (D-005) |
| Node / npm | `v24.22.3` / `11.19.1` | `node -v`, `npm -v`, 24 Nov 2026 |
| Git worktrees | `git worktree list` → one worktree, `C:/Users/LOUJAN B/Knewwhen 51f6602 [master]` | command, 24 Nov 2026. **Creation not exercised** → Unverified. |
| Git hooks path | `.git/hooks`, `core.hooksPath` unset | `git rev-parse --git-path hooks`, `git config core.hooksPath`, 24 Nov 2026 |
| ECC | 2.2.3, project-local OpenCode profile + hooks runtime, doctor OK | D-001, D-002, 23 Nov 2026 |
| Pre-commit hook | installed and fired; `PRE-COMMIT: PASS`, exit 0 | installed shim invoked through Git's `sh.exe`, 24 Nov 2026; commit `51f6602` succeeded with it installed |
| Independent reviewer context | separate child session returned findings, 2 Major + 6 Minor, all fixed | `TODO.md` §5.7, 24 Nov 2026 |

## 2. Capability matrix

| Capability | Claude Code | OpenCode | Evidence / status |
|---|---|---|---|
| Shared instruction file | `CLAUDE.md` contains only `@AGENTS.md` | reads `AGENTS.md` directly | D-004, `Get-Content`; **Verified** |
| Read-only reviewer and judge agents | `.claude/agents/reviewer.md`, `.claude/agents/judge.md`; tools allowlist `Read, Grep, Glob, WebFetch, WebSearch`, no edit tools | tracked source `agents/opencode/*.md`, copied to `.opencode/agents/` by `npm run setup`; `mode: subagent`, permissions deny `edit`, `shell`, `subagent` | `npm run setup` → PASS for both; removing the `edit` deny made setup exit 1 and the restored source passed again (`evidence/P1/setup-probe-2026-11-24T04-36-33Z.txt`); `opencode debug agents` lists both as subagents with the deny rules; **Verified installed**. Neither new file has been exercised in a gate → **Unverified behaviour**. |
| Locked-file edit guard in the harness | `.claude/settings.json` `permissions.deny` for `docs/Project/**`, `rules/**`, and the three named locked docs | root `opencode.json` V2 `permissions` denies `edit` on the same paths | Official key shapes confirmed from the docs in §4; both files parse as JSON; `opencode debug config` shows the root document loaded and `opencode debug agents` shows the denies appended to every agent; **Verified configuration loaded**. A real harness edit attempt has not been made → **Unverified enforcement**. The Git hook is the proven backstop. |
| Git pre-commit backstop | works regardless of editor (plain Git hook) | same | D-006; staged `rules/` file and staged deletion of `docs/Project/Scope.md` both blocked; **Verified** |
| Worktrees | available by Git version; not exercised for a KnewWhen task | `worktree` config key and harness tool exist; not exercised | **Unverified** creation and merge; §9.3 fallback is single-writer mode |
| MCP | no project `.mcp.json` | harness-level `browse` MCP present; Atlassian Rovo not configured | `.mcp.json` absent (24 Nov); Rovo needs owner OAuth on the demo site only (Tools §6); **Blocked** on owner |
| Screenshots / browser | not exercised | browse tools available in this harness | Tools §6 calls this optional; owner screenshots are the fallback; **Unverified** |

## 3. Discrepancies and gaps (logged, not smoothed over)

| ID | Finding | Effect | Handling |
|---|---|---|---|
| **HM-1** | ECC 2.2.3 writes V1-style config keys (`agent`, `tools`, `permission`) in `.opencode/opencode.json`; current official OpenCode docs prescribe V2 keys (`agents`, `permissions`). | Could mislead an agent editing generated config. | `opencode debug config` on v2.3.2 showed `permission` normalised to V2 `permissions`; **Reconciled**. New tracked config uses V2 only. Generated file was not edited. |
| **HM-2** | `.opencode/` is ignored by Git, so agent files placed there would not survive a fresh clone. | Mirrors would be local-only. | Tracked source in `agents/opencode/`; `npm run setup` copies it. **Resolved and Verified**. ECC reinstall may overwrite `agents/`; re-run setup afterwards. |
| **HM-3** | A reviewer ran in a separate context, but it was not the newly written `reviewer` agent file, and no Claude Code gate session has run. | Independence is proven in principle, not for the final definitions. | Phase acceptance stays **Blocked** until the actual agents and a second model family or fresh session are exercised (AGENTS §8.3, §13.5). |
| **HM-4** | Harness permission denies cover Claude file tools and OpenCode edit tools; neither was tested by attempting a real locked-file edit. Shell-based edits can bypass file-tool rules. | Harness guard is defence in depth, not the boundary. | Git hook is the enforced backstop and is tested; no claim of harness-level enforcement beyond "configuration loaded". |

## 4. Official sources (accessed 24 Nov 2026)

- OpenCode agents: <https://opencode.ai/docs/agents/>
- OpenCode configuration: <https://opencode.ai/docs/config/>
- OpenCode permissions: <https://opencode.ai/docs/permissions/>
- Claude Code subagents: <https://docs.claude.com/en/docs/claude-code/sub-agents>
- Claude Code settings: <https://docs.claude.com/en/docs/claude-code/settings>
- Claude Code permissions: <https://docs.claude.com/en/docs/claude-code/permissions>

No canonical file under `docs/Project/` was changed. No new dependency, scope, module or product behaviour was introduced.
