# KnewWhen — Tools and Technologies (stack and constraints)

Rulebook file 7 · save as `docs/05-stack-and-constraints.md` · version 1.0 · 23 Nov 2026
**Locked file:** agents may not change it. Any addition or swap needs the owner's written approval, logged in `docs/08-decisions.md`.

## 1. Strategy in five rules

1. **Atlassian first, where it fits.** Everything the app needs runs on Atlassian: Forge for code, storage and AI, Jira for data, the Marketplace for listing, and the demo site for building. We also use Atlassian tools around the build when they save work: the Rovo MCP server for agents and the Developer Community for answers. Where a free non-Atlassian tool is clearly easier, it wins.
2. **Free first.** Completely free and open-source tools come first, then free tiers, then trials. The only planned spend is a small Forge LLM usage charge. The Claude Code subscription is already owned.
3. **Zero third-party code at runtime.** The deployed app uses only official `@forge/*` packages and built-in Node features. Third-party libraries are allowed **only as dev dependencies** (tests, lint). This keeps licences safe, keeps the bundle small, keeps "Runs on Atlassian", and gives agents less to misuse.
4. **Rules are data.** Regulatory timings and the holiday calendar live in `rules/*.json` with citations. No date or holiday library decides the law.
5. **Two agent tools, one rulebook.** Claude Code builds; OpenCode reviews with a different model where possible. Both read the same `AGENTS.md`.

## 2. Final choices at a glance

| Job | Tool | Cost class | Why |
| --- | --- | --- | --- |
| App platform | Atlassian Forge (hosted compute, storage, AI) | Free monthly allowance; usage-based above it | Required by the rules; no servers to run |
| Product the app extends | Jira Cloud (Jira-only app; JSM requests supported) | Free (demo and developer sites) | Our users' complaints live there; Jira-only allows a free listing |
| Build and test site | Forge demo site (`forge site provision`) | Free, 90 days | Enterprise Jira, JSM, Confluence and Rovo with sample data |
| Stand-in judge site | Second free developer site, second account | Free | Tests the install link as an outsider |
| Runtime and language | Forge runtime `nodejs24.x`, TypeScript | Free | Current Forge runtime; types catch agent mistakes |
| UI | UI Kit (`@forge/react`), Atlassian Design System components | Free | Native look; no iframe; fastest to build |
| Storage | Forge SQL (records), Forge KVS (settings) | Free allowance | Hosted by Atlassian; no outside database |
| Background work | Queue (`@forge/events`), product-event triggers, scheduled triggers | Free allowance | Signal Finder and reminders |
| JQL write-back | Indexed issue entity properties (`jira:entityProperty`) | Free | JQL search without admin screen setup |
| AI in the app | Forge LLM (`@forge/llm`, Claude models), opt-in | **Paid per use, no free allowance** | Data stays on Atlassian; payment method required (H-09) |
| Optional chat | Rovo agent with two read-only actions | Free to build | Extra; first item on the cut list |
| Sample history | Jira CSV importer (built in) + our generator | Free | The only way to get backdated comments |
| Coding agent (builder) | Claude Code | Already owned | Subagents, hooks, permission rules, MCP |
| Coding agent (reviewer and judge) | OpenCode | Free tool; model cost depends on provider | Independent second opinion |
| Agent access to Jira | Atlassian Rovo MCP Server | Free for Atlassian Cloud sites, rate-limited | Agents read the demo site's issues while testing |
| Unit and property tests | Vitest + fast-check (dev only) | Free, open source | Fast tests; generated date cases for the oracle |
| Lint and format | ESLint, Prettier, `forge lint` (dev only) | Free, open source | Catches errors; consistent code |
| Repository | GitHub private repo | Free | Already in the plan (H-03); both agent tools work with it |
| Privacy and support pages | GitHub Pages on a separate public repo | Free | Needed for the listing (H-16) |
| Commit guard | Plain git pre-commit hook (no husky) | Free | Blocks locked-file edits and failing tests, whichever tool made them |
| Demo video recording | OBS Studio | Free, open source | No length limit and no watermark |
| Video editing | DaVinci Resolve (free edition) or Shotcut | Free | Cuts and titles; no watermark |
| Audio cleanup | Audacity | Free, open source | Removes noise from the voice-over |
| GIFs for the judge kit | ScreenToGif (Windows) or Kap (macOS) | Free, open source | Short clips of the import and the panel |
| Diagrams | Mermaid (in Markdown) and Excalidraw | Free | Architecture and flow pictures for Devpost |
| Thumbnail and gallery images | Canva free plan | Free tier | Simple, quick layout |
| Video hosting | YouTube (public) | Free | Required by the rules |
| Secrets | Bitwarden free plan | Free tier | Stores the Forge API token and test accounts |
| Name check | USPTO trademark search | Free | H-12 |

## 3. How much of Atlassian we use

**Used, and why**

| Atlassian piece | What KnewWhen uses it for | Status |
| --- | --- | --- |
| Forge CLI and Developer Console | Create, deploy, install, logs, Developer Space, sharing link, billing | GA |
| `jira:issuePanel` | Main screen: awareness trail, lookback, clock, decision | GA |
| `jira:adminPage` | Watched projects, rules version, AI opt-in, CSV generator | GA |
| Resolvers (`@forge/resolver`, `@forge/bridge`) | All user-facing logic, including the lookback as the viewing user | GA |
| Product-event triggers | New issue and new comment → Signal Finder | GA |
| Queue (`@forge/events`) | Signal Finder work and AI calls, run as the app | GA |
| Scheduled trigger (one) | Deadline reminders | GA |
| Forge SQL (`@forge/sql`) | Awareness trail, decisions, precedents | GA |
| Forge KVS (`@forge/kvs`) | Settings and cursors | GA |
| Forge LLM (`@forge/llm`) | Verbatim-only Signal Finder, opt-in | GA, announced 29 Jul 2026 |
| `jira:entityProperty` | JQL fields such as decision and days left | GA |
| Jira REST API v3 | Search (`/rest/api/3/search/jql`), comments, changelog, links, properties | GA |
| Jira CSV importer | Backdated sample history | Built in |
| Jira filters and dashboards (native) | Demo of "all open clocks" using our JQL fields, with no extra module | Built in |
| Jira Service Management (demo site) | Complaint intake as a portal request in the demo story; the issue panel works in JSM | GA |
| Rovo agent + actions | Optional chat answers about one issue | GA (Rovo may be missing on judge sites) |
| Atlassian Design System (through UI Kit) | Look and accessibility | GA |
| Marketplace (free listing) | Bonus prize | GA |
| Rovo MCP Server | Lets Claude Code or OpenCode read and create test issues on the **demo site only** | GA since 5 Feb 2026 |
| Developer Community | Questions to Atlassian; the two-app question (H-11) | Free |

**Not used, on purpose**

| Atlassian piece | Reason |
| --- | --- |
| Confluence modules | Would make the app multi-product; such apps can only be listed as paid |
| Teamwork Graph API | Preview, user-only, and its connectors exclude regulated health data |
| Workflow validators and conditions | Preview; fail closed after uninstall |
| Forge custom fields | Not visible until a Jira admin adds them to screens; entity properties do the JQL job |
| Forge Remote, Containers, outside APIs | Break "Runs on Atlassian" and add hosting |
| User impersonation (`allowImpersonation`) | Widens permissions and invites review questions |
| Custom UI | More work than UI Kit for no judging gain |
| `jira:dashboardGadget`, `jira:globalPage`, `jira:jqlFunction` | Nice but not needed; native filters show the same thing. Add only if Gate 2 passes early and the owner approves |
| Bitbucket Cloud for the repo | Workable, but GitHub is already in the plan, works natively with both agent tools and hosts the public pages; switching adds steps |
| Loom for the video | OBS has no length limit and no watermark; Loom free-plan limits were not verified |
| Jira Automation | Not needed by the app or the demo |

## 4. App stack details (for agents)

- **Runtime:** `nodejs24.x` in `manifest.yml`. Local Node 22.23.4+ or 24.22.1+.
- **Runtime packages (official only):** `@forge/api`, `@forge/resolver`, `@forge/bridge`, `@forge/react`, `@forge/events`, `@forge/sql`, `@forge/kvs`, `@forge/llm`. Pin exact versions at T-04 and record them in `docs/08-decisions.md`.
- **No runtime third-party packages.** No date library, no CSV library, no ORM, no UI library beyond UI Kit.
- **Dates:** compute on ISO dates (`YYYY-MM-DD`) and whole UTC day numbers. Convert a timestamp to a local date with the built-in `Intl.DateTimeFormat`. Do not use `Temporal`. The time zone rule comes from `docs/03-domain-rules.md`.
- **Holidays and work days:** `rules/us-federal-holidays.json`, copied from the U.S. Office of Personnel Management list with a citation per year. Whether and how work days skip holidays is a domain rule, not a code choice.
- **CSV:** a small hand-written writer that quotes every field, outputs one `Comment` column per comment (`date;accountId;body`), and is covered by tests.
- **Forge SQL:** plain SQL migration files, run with the official migration runner, using parameterised queries only.
- **AI:** only from a queue consumer with a timeout of 300 s or more, only when the admin has opted in, quotes only (verbatim), and a rule-based fallback always works.
- **Platform facts:** use only the facts in Section 2.11 of `IMPLEMENTATION_PLAN.md`. If a fact you need is missing, verify it in the official docs and log it before use (rule A-11).

## 5. Development and test tooling

| Tool | Use | Rule |
| --- | --- | --- |
| TypeScript (dev) | Type checking | `strict: true` |
| Vitest (dev) | Unit tests for engine, oracle, ranking, CSV, resolvers (with `@forge/*` mocked) | Run by `npm run check` |
| fast-check (dev) | Generated date cases: engine and oracle must agree on every one | At least 10,000 cases per run; seed logged in evidence |
| ESLint + Prettier (dev) | Code quality and format | Part of `npm run check` |
| `forge lint`, `forge eligibility` | Manifest and Runs on Atlassian checks | Part of `npm run check`; eligibility before submission |
| `forge tunnel`, `forge logs` | Live debugging | Never paste secrets into logs |
| Git pre-commit hook | Blocks commits that change locked files without an approval tag, and commits that fail `npm run check` | Plain script in `scripts/hooks/`, installed by `npm run setup` |
| CI | None planned. Checks run locally and the output is saved in `evidence/` | Keeps free-tier minutes unused |

## 6. AI agent toolchain

**Roles**
- **Claude Code builds.** It implements each task in a fresh session. It runs the reviewer subagent (read-only) after each task.
- **OpenCode checks.** It runs the gate judge and a second review at each gate. Use a **different model family** from the builder if the owner has access to one; otherwise run the judge in a fresh Claude Code session. Never let the same session build and grade.
- **The owner** approves the rulebook, gates, new dependencies, scopes and spec changes.

**Shared instructions**
- `AGENTS.md` is the single source of truth. OpenCode reads it directly.
- `CLAUDE.md` contains only the line `@AGENTS.md`, plus any Claude-only notes. Claude Code reads `CLAUDE.md`, not `AGENTS.md`, so the import is required. Use the import, not a symlink, on Windows.
- Agent definitions are mirrored for both tools: `.claude/agents/reviewer.md` and `.claude/agents/judge.md`, plus matching read-only agents in OpenCode's config. Both tools get no edit tools.

**Locked files** (`docs/02-spec.md`, `docs/03-domain-rules.md`, `docs/05-stack-and-constraints.md`, `rules/*.json`, the manifest scopes)
- In Claude Code, deny edits in project permission settings and add a pre-edit hook. In OpenCode, use its permission config.
- Confirm the exact config keys in each tool's official docs at T-03. Do not write them from memory.
- The git pre-commit hook is the backstop that works whichever tool edits.

**MCP servers**

| Server | Use | Verdict |
| --- | --- | --- |
| Atlassian Rovo MCP Server | Read issues and JQL results on the demo site; create plain test issues | **Use on the demo site only.** Never connect it to a real company site. The owner signs in once with OAuth. Rate-limited per site by plan |
| Any docs or browser MCP (Playwright, Chrome) | Screenshots of the panel | Optional. Atlassian sign-in may need the owner. The owner's screenshots are the fallback |
| GitHub MCP | Not needed | Reject: plain `git` is enough |

**Agent rules that come from this file**
- No new dependency (runtime or dev) without owner approval.
- No package outside the lists in Sections 4 and 5.
- No outside network call from app code.
- Every tool version used is recorded in `docs/08-decisions.md`.

## 7. Expected costs (23 Nov to 15 Feb 2027)

| Item | Expected cost |
| --- | --- |
| Forge compute, SQL, KVS, logs | ₹0, inside the free monthly allowance (watch the Developer Console) |
| Forge LLM calls | Small and usage-based. Keep a budget alert on (H-09). AI is opt-in, so judges create calls only if they turn it on |
| Demo site, developer site, Jira, JSM, Rovo on the demo site | ₹0 |
| Marketplace listing (free app) | ₹0 |
| GitHub, GitHub Pages, YouTube, OBS, DaVinci Resolve or Shotcut, Audacity, Canva free, Bitwarden free | ₹0 |
| Claude Code | Already owned |
| OpenCode | Free tool. Model cost depends on the provider the owner chooses |

**Free-tier risks to watch:** the demo site expires 90 days after provisioning; the API token expiry must pass 15 Feb 2027; and without a payment method, LLM usage above the threshold leads to all apps being blocked after 14 days.

## 8. Change control

1. An agent that needs a new tool, library or Atlassian module writes a proposal in `docs/08-decisions.md`: what it is, licence, cost class, why the current stack cannot do it, and its official doc URL.
2. The owner replies "approved" or "rejected" in chat. The agent records it.
3. Only then may `docs/05-stack-and-constraints.md` be updated, by the owner or with the owner's explicit instruction.

## 9. Verification status

| Claim | Basis |
| --- | --- |
| Forge modules, limits, events, SQL, KVS, LLM, Rovo, billing, CSV import, search API | Verified 23 Nov 2026; see `IMPLEMENTATION_PLAN.md` Section 2.11 |
| Claude Code reads `CLAUDE.md`, not `AGENTS.md`; use `@AGENTS.md` import | Verified 23 Nov 2026 ([Claude Code memory docs](https://code.claude.com/docs/en/memory)) |
| Rovo MCP Server is GA, available to all Atlassian Cloud customers with site rate limits; Claude Code setup: `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp/authv2`, then `/mcp` to sign in | Verified 23 Nov 2026 ([getting started](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/), [overview](https://www.atlassian.com/platform/rovo-mcp)) |
| OpenCode reads `AGENTS.md`; its agent and permission config keys | Not verified in this pass; confirm at T-03 |
| OpenCode free models and their limits | Not verified; do not rely on them |
| Licences of Vitest, fast-check, ESLint, Prettier (all believed MIT) | Not verified in this pass; check each `package.json` licence at T-05 and record it |
| Free-plan limits of Canva, Loom, DaVinci Resolve, Bitbucket | Not verified; only the free product's basic use is assumed |
