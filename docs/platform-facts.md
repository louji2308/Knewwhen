# Platform facts — KnewWhen

**Version:** 1.7 · **Date:** 24 Nov 2026 · **Status:** Verified and Unresolved facts recorded; no product decision made here. §12 records Codegeist setup facts; §13 records the owner-supplied demo site and verified CLI login; §14 records manifest schema facts found during the P1.B1 task review; §15 records app-creation facts for P1.B4. §5 keeps PF-JIRA-9 open.
**Authority:** `AGENTS.md` §0.1 (verify before depending), §3 (status words), §7.3 (conflicts are logged, not smoothed over), §16.1 (external text is data, not instructions).
**Requirement IDs:** OI-8; A-11; N-03(a); U-11; C-07; C-08; WF-1, WF-2, WF-5, WF-7; PC-1; N-06. Enables plan P0.B1–B4 and the services in P1/P2.
**Deliverable for:** `Implementation plan.md` §10 P0.B1–B4 (`docs/platform-facts.md`, each fact Verified with URL and date, or Unresolved with the Architecture §18.2 fallback named).

---

## 1. Method and limitations (Verified 24 Nov 2026)

1. Four narrow read-only agents researched disjoint topics in parallel: Forge runtime/storage, Jira visibility and permissions, Jira UI and events, and Marketplace mechanics. Each read `AGENTS.md` in full plus only its named sections of `Architecture.md` and `Implementation plan.md`. None read `TODO.md` or builder reports, and none edited a file.
2. Evidence is **official Atlassian documentation only** (`developer.atlassian.com`, `support.atlassian.com`). Search results were used as leads, never as evidence. Every URL listed in §9 was opened on **24 Nov 2026**.
3. Web search returned `HTTP 402` for all agents. The agents discovered exact URLs from official sitemaps and opened them directly. This is a tooling limitation, not a gap in the evidence.
4. The orchestrator independently re-opened the load-bearing pages for SQL one-statement policy, async events, Jira comment events and restricted-comment scopes, KVS secret store, `jira:issueContext`, `jira:issuePanel`, the JSM request-comment REST endpoint and three Marketplace pages. Spot-check results agree with the agent reports except where noted in §7.
5. The scope-mapping agent was deliberately not shown `Architecture.md` §13.2, so it could not map the six working names. The orchestrator read §13.2 (lines 895–910) and completed §8 from the official identifiers the agent had found.
6. **Status discipline.** A fact is **Verified** only where an official page states it, with URL and date. Silence in official docs is **Unresolved**, never inferred as support. No regulatory content, product decision, scope change or architecture edit is made by this record.

---

## 2. Storage and runtime (plan P0.B1)

| ID | Question | Status | Official answer | URL (all 24 Nov 2026) | Fallback / impact if Unresolved |
|---|---|---|---|---|---|
| **PF-DB-1** | Parameter binding? | **Verified** | `sql.prepare(query).bindParams(...)` binds one parameter per `?`; use `?` rather than interpolating values. SQL-level `PREPARE`/`EXECUTE`/`DEALLOCATE PREPARE` are rejected — use `sql.prepare`. | [sql-api], [sql-query-policy] | — |
| **PF-DB-2** | Affected-row counts? | **Verified** | `UpdateQueryResponse` includes `affectedRows: number`, plus `insertId`, `fieldCount`, `info`. | [sql-api] | — |
| **PF-DB-3** | Upsert (`ON DUPLICATE KEY UPDATE` / `REPLACE`)? | **Unresolved** | Official docs list supported DML as `INSERT`, `SELECT`, `UPDATE`, `DELETE`; no official statement confirms upsert syntax. | [sql-api], [sql-query-policy] | Use Arch §18.2 fallback: **replace affected-row checks with read-after-write; the single-writer rule limits the damage**. Do not assume upsert in P1/P2. |
| **PF-DB-4** | Foreign keys? | **Verified** | Not supported. JOINs work; DELETE does not cascade. | [sql] | — |
| **PF-DB-5** | Multi-statement transactions? | **Verified** | Not available: "Each call to the Forge SQL API must contain only one statement." `SET autocommit`, `SET sql_mode`, `SET GLOBAL`, `SET INSTANCE` are not permitted. | [sql-query-policy] | Consistent with Arch §18.2 (transactions "not needed"). No transaction-based idempotency. |
| **PF-DB-6** | SQL isolated per installation? | **Verified** | "Forge SQL provisions databases for each individual installation, thereby isolating each customer's data." Cross-installation table names are blocked by policy. | [sql], [sql-query-policy] | — |
| **PF-DB-7** | KVS isolated per installation; limits? | **Verified** | Forge prepends an identifier mapping each key to the right app and installation; capabilities scope data per installation. Key 500 bytes, value 240 KiB, depth 31. | [limits-kvs-ce], [storage-reference] | — |
| **PF-DB-8** | KVS secret store? | **Verified** | `kvs.setSecret` / `kvs.getSecret` / `kvs.deleteSecret` exist; values are encrypted, readable only via `getSecret`, not queryable; JSON ≤128 KiB, key ≤500 bytes; requires `storage:app`. | [kvs-api-secret] | The **preferred** key custody in Arch §6.2 is now Verified; the weaker U-3 fallback is not required on this platform fact alone. |

---

## 3. Queues and product events (plan P0.B1)

| ID | Question | Status | Official answer | URL (all 24 Nov 2026) | Fallback / impact if Unresolved |
|---|---|---|---|---|---|
| **PF-Q-1** | Queue push delay? | **Verified** | `queue.push({ body, delayInSeconds })`; processing can be delayed up to **15 minutes**. Max 50 events and 200 KB combined payload per request. In `@forge/events` 2.x the `body` wrapper is mandatory. | [async-events] | — |
| **PF-Q-2** | Retries, retry-after hint, dedupe identifiers? | **Verified** | At-least-once delivery; 24-hour retention window, extendable to 96 hours for platform errors. Exponential backoff to ~15 minutes. `RetryOptions.retryAfter` capped at **900 s**; `retryData` ≤4 KB. Every event carries `jobId` and `eventId`; retries carry `retryContext`. App-level errors eventually drop the event after retention. | [async-events] | Consumers must be idempotent (Arch §14.2–14.3). `retryAfter` can honour a Jira 429 `Retry-After` only up to 900 s. |
| **PF-Q-3** | Comment create/edit/delete event identifiers? | **Verified** | `avi:jira:commented:issue` fires **each time a comment is created or edited**; `avi:jira:deleted:comment` on delete; `avi:jira:mentioned:comment` on mention. There is no `avi:jira:updated:comment` in the official list. Requires `read:jira-work`. | [jira-events] | Edit handling must use `commented:issue` plus validation-time detection; a distinct edit event cannot be assumed. |
| **PF-Q-4** | Link created/deleted events? | **Verified** | `avi:jira:created:issuelink` and `avi:jira:deleted:issuelink`; same payload; requires `read:jira-work`; links only within a single Jira instance. | [jira-events] | — |
| **PF-Q-5** | Does Jira CSV import emit standard issue/comment-created events? | **Unresolved** | The official CSV-import article makes no statement about webhooks, events, notifications or triggers. Forge's event page lists `avi:jira:created:issue` but does not say CSV import fires it. | [csv-import], [jira-events], [webhooks] | Arch §18.2 fallbacks: **"rely on validation-time detection and the sweep"** and **"coverage is stated per project; lookback and display remain as-user"**. WF-7 must not depend on event-driven import detection without runtime proof or an owner decision. |

---

## 4. LLM (plan P0.B1)

| ID | Question | Status | Official answer | URL (all 24 Nov 2026) | Fallback / impact if Unresolved |
|---|---|---|---|---|---|
| **PF-LLM-1** | Model identifiers? | **Verified** | `model` is a string array of model families; "Currently only `claude` family (Anthropic Claude) is supported." The `llm` module may be defined once per app; adding it triggers a major version upgrade. No per-version model IDs are published on the pages opened. | [llm-module] | — |
| **PF-LLM-2** | Moderation and data handling? | **Verified** | Atlassian-hosted LLMs; requests undergo the same moderation checks as Atlassian first-party AI and Rovo features; high-risk messages under the Acceptable Use Policy are blocked; usage reports include input/output token counts. | [llms-api] | — |
| **PF-LLM-3** | Moderation behaviour on injury/adverse-event narratives specifically? | **Unresolved** | Official pages state the general moderation policy and AUP blocking, but say nothing about how injury narratives are classified. | [llms-api] | Arch §18.2 fallback: **"more cases route to the rules fallback"**. The rule screener must remain the guaranteed path (Arch §7.3). |

---

## 5. Jira data, visibility and UI (plan P0.B1, P0.B3)

| ID | Question | Status | Official answer | URL (all 24 Nov 2026) | Fallback / impact if Unresolved |
|---|---|---|---|---|---|
| **PF-JIRA-1** | Are entity properties app-private? | **Verified** | **No.** Users can access them via REST; any user with edit permission can modify them; all apps write in a global namespace. Issue-property reads require Browse Projects, writes require Browse Projects + Edit Issues. Atlassian says never store personal, sensitive or configuration data there. | [jira-entity-properties], [issue-properties], [user-privacy] | Confirms architecture intent: pointers and keyed hashes only, no record text (I-6). No change proposed. |
| **PF-JIRA-2** | Entity-property JQL types and query forms? | **Verified** | Forge `jira:entityProperty` supports `number`, `text`, `string`, `user`, `date`; max 100 indexed values per app unless using `jira:entityPropertySet`. Query via `searchAlias` or `issue.property['<key>'].<path>`; dates expect `YYYY-MM-DD` or ISO 8601 with offset. | [forge-entity-property], [jira-entity-properties] | — |
| **PF-JIRA-3** | Entity-property index lag / freshness guarantee? | **Unresolved** | Official pages confirm indexing and JQL syntax but state no lag, delay or consistency window. | [forge-entity-property], [jira-entity-properties] | Arch §18.2 fallback: **"fall back to JQL on `issue.property[...]` paths if allowed"**. Write-back tests must tolerate eventual visibility; no freshness SLA may be claimed. |
| **PF-JIRA-4** | Can `asApp()` see restricted comments? | **Verified** | By default **no**. `read:restricted-comment-event:jira` opts in to events only (no admin approval for a Connect migration; otherwise approval needed). `read:restricted-comment:jira` opts in to events **and** `asApp()` REST reads, including pre-install comments, but needs admin approval. Neither scope bypasses Browse Projects or app access rules; `asUser()` sees only what the user sees. Payload carries `comment.visibility`. | [jira-events] | Architecture §13.2 **does not request** either restricted-comment scope. Coverage remains stated per project and lookback/display remain as-user (Arch §18.2). |
| **PF-JIRA-5** | Group-membership lookup? | **Verified** | `GET /rest/api/3/group/member` and `GET /rest/api/3/user/groups` return paginated membership; requires Browse users and groups; granular scope `read:group:jira`. Standard group names can be edited or deleted. | [api-group-groups], [api-group-users] | Role checks that depend on group *names* are fragile; account-id allow-list remains the Arch §18.2 fallback if needed. |
| **PF-JIRA-6** | Personal-data reporting mechanics? | **Verified** | Apps storing personal data report `accountId` + `updatedAt`; default cycle 7 days unless `Cycle-Period` says otherwise; responses can request erasure/update. Forge `privacy.reportPersonalData` wraps 3LO `/report-accounts` and handles >90 accounts. Forge scope `report:personal-data`. Personal data must not be stored in entity properties. | [user-privacy], [privacy-api] | — |
| **PF-JIRA-7** | `jira:issuePanel` visibility and pinning? | **Verified** | Button shown **only to users with permission to edit the issue**; content appears above Activity; usable in Jira and JSM, new issue view only. Only Jira admins see "Show/Hide for all work items". **No pinning requirement is documented.** | [issue-panel] | WF-2 concern is real: viewers may not reach the panel. The UI choice is a product decision (§7). |
| **PF-JIRA-8** | `jira:issueContext` status? | **Verified** | **Current** documented module (page last updated 9 Oct 2026), a collapsible panel under the fields on the right. The migration guide says **Issue Glance** will eventually be deprecated; when both modules are defined, `issueContext` is displayed by default. No deprecation notice on the `issueContext` page. Page last updated 23 Nov 2026 for the migration guide. | [issue-context], [future-proof-glance] | Confirms the technical premise behind WF-1. D-008 now prefers this module, subject to PF-JIRA-9. |
| **PF-JIRA-9** | Does `jira:issueContext` require edit permission, or can Viewers open it? | **Unresolved** | The official module page and migration guide describe placement, properties, events and extension context but do not state a Jira permission requirement. The issue-panel page separately documents the edit-permission restriction for `jira:issuePanel` (PF-JIRA-7); silence for `issueContext` is not proof of Viewer access. | [issue-context], [future-proof-glance], [issue-panel] | D-008 selects `jira:issueContext` **subject to read-only permission verification**. Verify on a clean site with a Viewer/test account before the 1 Dec manifest freeze; if Viewers cannot open it, record the limitation and preserve the evidence-only Trail path for roles that can. Do not claim the Viewer nudge works until verified. |

---

## 6. JSM, UI Kit and Marketplace (plan P0.B1, P0.B3, P0.B4)

| ID | Question | Status | Official answer | URL (all 24 Nov 2026) | Fallback / impact if Unresolved |
|---|---|---|---|---|---|
| **PF-JSM-1** | JSM internal-comment mechanism? | **Verified** | `POST /rest/servicedeskapi/request/{issueIdOrKey}/comment` "creates a public or private (internal) comment on a customer request, with the comment visibility set by `public`"; the request body has `body: string` and `public: boolean`. Customers may set public visibility only. Granular scope `write:request.comment:jira-service-management`; classic `write:servicedesk-request`. | [jsm-request] | Mechanism verified; see §7 D-PF-1 — the architecture's assumed *comment-property* key is not documented, and the required write scope is **not** in Architecture §13.2. |
| **PF-JSM-2** | Documented internal-comment **property key**? | **Unresolved** | No official page opened states a supported comment-property key for JSM internal comments. | [jsm-comments], [jsm-request] | Arch §18.2 fallback: **"write-back for JSM held until a safe mechanism is verified"**. Do not build on an assumed key. |
| **PF-UI-1** | Native UI Kit CSV download component? | **Verified** | **No download component** is listed in the UI Kit catalogue. Documented alternatives are `Link`, `Router (Preview)`, `File card (Preview)` / `File picker (Preview)` and `Frame`. | [ui-kit-components], [link], [router] | WF-5 needs an owner decision on an acceptable mechanism; no download claim may be made before then. |
| **PF-MP-1** | Code-only updates **during** Marketplace review? | **Unresolved** | Docs lock **listing fields** while review is pending and route changes through the approval ticket; the security workflow requires publishing a patched version after critical scan findings. No official page states a general rule permitting code-only Forge deployments during active review. | [cannot-edit-listing], [security-workflow] | No §18.2 row exists. Escalate under AGENTS §17.5; assume the permission is **absent** and keep the M-1 frozen-manifest / M-2 submission strategy. |
| **PF-MP-2** | Code-only updates **after** approval? | **Verified** | Forge production changes reach customer instances within minutes; new Marketplace versions publish within minutes. Routine version updates need no re-approval except payment-model changes or new app types. | [upgrade-version], [approval-guidelines] | — |
| **PF-MP-3** | Cost of a manifest change after submission? | **Verified** | Increased/changed scopes or free→paid increments the **major** version: delivered via UPM within 24 h and requiring manual admin approval. Other descriptor changes increment the **minor** version, instantly available with no manual approval. Forge sends no admin email for approval-required updates. | [upgrade-version] | Confirms the App B freeze after the last outside-org test (Arch §17). |
| **PF-MP-4** | Ticket/scan flow and partner verification? | **Verified** | Submit via partner portal → ECOHELP ticket → app-specific and partner security questionnaires → one-time KYC/KYB Partner Verification for new apps → automated vulnerability scan → Marketplace review. Critical/high findings block approval, move the ticket to Awaiting Resubmission and raise an AMS ticket; resolve, resubmit, and a new ECOHELP ticket triggers a rescan. Rejected verification prevents app uploads; Verified status is required for approval/launch. Updates do not repeat Partner Verification. Stated SLAs differ by page (one week / 5–10 / 10–15 business days) — cite the specific page, not a blended figure. | [security-workflow], [due-diligence], [approval-guidelines] | — |
| **PF-MP-5** | Judge install link after listing submission? | **Verified** | Sharing links are for internal use/testing **before** listing. Once an app is submitted for listing or has a licence in its manifest, it cannot be shared by installation link; copy the code into a new, unlicensed app. After listing, developer-console distribution no longer applies. "Sharing within organization" apps cannot be listed — set Sharing before submission. | [distribute], [listing] | Official basis for the separate judge-link identity (App B). No product decision made here. |

---

## 7. Conflicts, discrepancies and Unresolved items (AGENTS §7.3)

| ID | Type | Statement A | Statement B | Effect | Proposed resolution — no edit made |
|---|---|---|---|---|---|
| **D-PF-1** | Document vs official platform fact | Arch §18.2: "JSM internal-comment mechanism through a comment property"; "Write-back for JSM held until a safe mechanism is verified" (§11.3). | Official JSM REST publishes a `public` boolean on `POST /rest/servicedeskapi/request/{id}/comment` (PF-JSM-1); no property key is documented (PF-JSM-2). | A documented mechanism may exist, but it needs `write:servicedesk-request` or the granular equivalent, which Arch §13.2 explicitly does **not** request. | Owner decision: add a JSM write scope (Type C, §7.4) or keep JSM write-back held. Do **not** edit `Architecture.md` or the manifest. |
| **D-PF-2** | Document assumption vs official docs | Arch §18.2 assumes Forge SQL has "upsert, affected-row counts" for idempotency. | Affected rows and parameters are Verified (PF-DB-1/2); upsert is **Unresolved** (PF-DB-3); one statement per call (PF-DB-5). | Idempotency cannot rely on upsert. | Use the named read-after-write fallback plus the existing single-writer rule; probe at runtime in P1/P2. No architecture edit. |
| **D-PF-3** | Reconciled agent disagreement — **Resolved** | Jira-visibility agent marked `asApp` restricted-comment visibility **Unresolved** because its brief excluded the Forge events page. | Forge-runtime agent and orchestrator spot-check of the official Jira events page Verified the two scopes and their effects (PF-JIRA-4). | None after reconciliation. | Record PF-JIRA-4 as **Verified**; the difference was read scope, not conflicting sources. |
| **D-PF-4** | Unresolved assumption | Arch §18.2 queue row assumes push delay, bounded retries and a retry-after hint. | All three are **Verified** (PF-Q-1/2). | None. Assumption confirmed; no fallback needed. |
| **D-PF-5** | Unresolved fact | Index lag for entity-property JQL. | No official freshness statement (PF-JIRA-3). | Write-back visibility may lag. | Named fallback: JQL on `issue.property[...]`; state no freshness SLA. |
| **D-PF-6** | Unresolved fact | LLM moderation of injury narratives. | Only general AUP moderation documented (PF-LLM-3). | Some narratives may be blocked. | Named fallback: route more cases to the rule screener (always runs). |
| **D-PF-7** | Unresolved fact | CSV import event emission (WF-7). | Official import docs silent (PF-Q-5). | Event-driven import detection is unsafe. | Named fallback: validation-time detection + sweep; or owner decision with runtime proof. |

**Open conflicts from other canonical files are unchanged**: CF-1…CF-7, OI-1…OI-10 (Scope) and WF-1…WF-16 (Workflow). This record supplies evidence for some of them; it does not rule on them.

---

## 8. Scope mapping (plan P0.B2, Architecture §13.2)

The six working names in Arch §13.2 lines 899–906 map **exactly** to official Forge/Jira scope identifiers. All six are **Verified** as existing identifiers on official pages (all read 24 Nov 2026); no new scope is proposed.

| Working name (= official identifier) | Official evidence | Status |
|---|---|---|
| `read:jira-work` | Published Jira product scope; required by core issue and comment events. [scopes-product-jira], [jira-events] | **Verified** |
| `write:jira-work` | Published Jira product scope. [scopes-product-jira] | **Verified** |
| `read:jira-user` | Published Jira product scope; required for user events. [scopes-product-jira], [jira-events] | **Verified** |
| `storage:app` | Required by `@forge/kvs`, including the secret store. [kvs-api-secret] | **Verified** |
| `report:personal-data` | Published Forge scope for the personal-data reporting cycle. [scopes-forge], [privacy-api] | **Verified** |
| `read:servicedesk-request` | Classic recommended scope on JSM Service Desk REST request operations. [jsm-request] | **Verified** |

**U-11 (granular scopes), read-only assessment.** Atlassian recommends classic scopes where available and granular scopes only when a classic scope cannot do the job; scopes do not override Jira permissions; fewer than 50 scopes is recommended and `forge lint --fix` can add required scopes. [scopes-product-jira], [add-scopes], [permissions] **Verified.** U-11 remains **not adopted**; changing the manifest needs owner approval (AGENTS §7.4, Arch §13.2).

**Caveat:** Arch §13.2 itself says the mapping "must be confirmed with `forge lint`". There is no scaffold or manifest yet, so `forge lint` has **not** been run and that confirmation is **not** claimed. No manifest file was read or edited.

---

## 9. Implications for P1/P2 (inferred from the facts above — not decisions)

| Area | Implication | Requirement / assumption |
|---|---|---|
| SQL access | Use `sql.prepare().bindParams()`; one statement per call; use `affectedRows`; **do not** rely on upsert — keep read-after-write and the single-writer rule. | PF-DB-1/2/3/5; Arch §14.2–14.3 |
| Key custody | Use `kvs.setSecret`/`getSecret` with `storage:app`; U-3 weaker fallback not needed on this platform fact. | PF-DB-8; Arch §6.2 |
| Queue consumer | Use `@forge/events` 2.x `body` wrapper; idempotency keyed on stable fingerprint plus `jobId`/`eventId`; honour `Retry-After` only up to 900 s; tolerate at-least-once and eventual drop. | PF-Q-1/2 |
| Edit and delete handling | No distinct comment-update event: use `avi:jira:commented:issue` plus validation-time detection and the sweep. | PF-Q-3, PF-Q-5 |
| Panel UI | Edit permission gates the issue panel; viewers may not reach it. Any module change is an owner decision, not an implementation choice. | PF-JIRA-7/8; WF-1, WF-2 |
| Evidence export | No native CSV download component; WF-5 needs an owner decision before any claim. | PF-UI-1; WF-5 |
| JSM write-back | Mechanism documented but write scope not requested; keep held pending owner decision. | PF-JSM-1/2; D-PF-1 |
| Distribution | App B must be a separate unlicensed copy before submission; freeze manifest after the outside-org test because scope changes force major-version re-consent. | PF-MP-3/5; PC-1 |

---

## 10. Decisions and proof still needed

1. **Owner:** D-PF-1 — add a JSM write scope or keep JSM write-back held (§7.4 Type C).
2. **Owner:** WF-1/WF-2 — panel/module choice given edit-permission gating; WF-5 — acceptable evidence export mechanism.
3. **Owner:** PF-MP-1 — rule on in-review code updates; meanwhile assume absent.
4. **Runtime proof (P1/P2):** upsert behaviour (PF-DB-3), entity-property index lag (PF-JIRA-3), CSV import event emission (PF-Q-5). Until proven, use the named fallbacks in §7.
5. **Not run:** `forge lint` scope confirmation (no scaffold/manifest). **Not arranged:** clean-site install and independent verifiers (AGENTS §13.5) — phase acceptance remains Blocked.

---

## 11. Official URLs opened (all accessed 24 Nov 2026)

Reference labels used above:

- [sql-api]: https://developer.atlassian.com/platform/forge/storage-reference/sql-api/
- [sql-query-policy]: https://developer.atlassian.com/platform/forge/storage-reference/sql-query-policy/
- [sql]: https://developer.atlassian.com/platform/forge/storage-reference/sql/
- [storage-reference]: https://developer.atlassian.com/platform/forge/storage-reference/
- [limits-kvs-ce]: https://developer.atlassian.com/platform/forge/limits-kvs-ce/
- [kvs-api-secret]: https://developer.atlassian.com/platform/forge/storage-reference/kvs-api-secret/
- [async-events]: https://developer.atlassian.com/platform/forge/runtime-reference/async-events-api/
- [jira-events]: https://developer.atlassian.com/platform/forge/events-reference/jira/
- [csv-import]: https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/
- [webhooks]: https://developer.atlassian.com/cloud/jira/platform/webhooks/
- [llm-module]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/llm/
- [llms-api]: https://developer.atlassian.com/platform/forge/runtime-reference/forge-llms-api/
- [jira-entity-properties]: https://developer.atlassian.com/cloud/jira/platform/jira-entity-properties/
- [issue-properties]: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-properties/
- [user-privacy]: https://developer.atlassian.com/cloud/jira/platform/user-privacy-developer-guide/
- [forge-entity-property]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-entity-property/
- [api-group-groups]: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-groups/
- [api-group-users]: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-users/
- [privacy-api]: https://developer.atlassian.com/platform/forge/runtime-reference/privacy-api/
- [issue-panel]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-panel/
- [issue-context]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-context/
- [future-proof-glance]: https://developer.atlassian.com/cloud/jira/platform/future-proof-issue-glance-implementation/
- [jsm-request]: https://developer.atlassian.com/cloud/jira/service-desk/rest/api-group-request/
- [jsm-comments]: https://developer.atlassian.com/cloud/jira/service-desk/rest/api-group-comments/
- [ui-kit-components]: https://developer.atlassian.com/platform/forge/ui-kit-components/
- [link]: https://developer.atlassian.com/platform/forge/ui-kit/components/link/
- [router]: https://developer.atlassian.com/platform/forge/ui-kit/components/router/
- [cannot-edit-listing]: https://developer.atlassian.com/platform/marketplace/knowledge-base/i-cant-edit-my-listing-during-the-review-process/
- [security-workflow]: https://developer.atlassian.com/platform/marketplace/app-approval-security-workflow/
- [upgrade-version]: https://developer.atlassian.com/platform/marketplace/upgrading-and-versioning-cloud-apps/
- [approval-guidelines]: https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/
- [due-diligence]: https://developer.atlassian.com/platform/marketplace/partner-due-diligence/
- [distribute]: https://developer.atlassian.com/platform/forge/distribute-your-apps/
- [listing]: https://developer.atlassian.com/platform/marketplace/listing-forge-apps/
- [scopes-product-jira]: https://developer.atlassian.com/platform/forge/manifest-reference/scopes-product-jira/
- [scopes-forge]: https://developer.atlassian.com/platform/forge/manifest-reference/scopes-forge/
- [permissions]: https://developer.atlassian.com/platform/forge/manifest-reference/permissions/
- [add-scopes]: https://developer.atlassian.com/platform/forge/add-scopes-to-call-an-atlassian-rest-api/
- [forge-entity-property-set]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-entity-property-set/
- [forge-runtimes]: https://developer.atlassian.com/platform/forge/runtime-reference/
- [manifest overview]: https://developer.atlassian.com/platform/forge/manifest-reference/
- [issue-panel]: https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-panel/

Additional official pages opened as context but not load-bearing: `storage-reference/sql-tutorial/`, `storage-reference/sql-data-types/`, `storage-reference/kvs/`, `runtime-reference/fetch-api/`, `runtime-reference/authorize-api/`, `events-reference/`, `events-reference/product_events/`, `manifest-reference/modules/`, `manifest-reference/modules/consumer/`, `manifest-reference/modules/scheduled-trigger/`, `manifest-reference/modules/jira-entity-property-set/`, `manifest-reference/modules/index-jira/`, `manifest-reference/modules/index-jsm/`, `platform-quotas-and-limits/`, `limits-sql/`, `limits-async-events/`, `limits-llm/`, `faq-privacy-security/`, `in-scope-end-user-data/`, `user-privacy-guidelines/`, `security/`, `app-context-security/`, `apis-reference/product-rest-api-reference/`, `apis-reference/fetch-api-product.requestjira/`, `marketplace/`, `marketplace/onboarding-hub/launch/submit-for-review/`, `marketplace/security-scanning/`, `marketplace/ecoscanner/`, `marketplace/vulnerability-management-for-marketplace-apps/`, `marketplace/creating-a-marketplace-listing/`, `marketplace/marketplace-partner-program/`, `forge/`, `forge/versions/`, `forge/developer-space/publish-developer-space/`, `forge/developer-space/developer-space-apps/`, `cloud/jira/platform/jira-entity-properties/`, `cloud/jira/platform/storing-data-with-entity-properties/`, `cloud/jira/platform/modules/entity-property/`, `cloud/jira/platform/security-for-forge-apps/`, `cloud/jira/platform/webhooks/`, `cloud/jira/service-desk/rest/`, `cloud/jira/service-desk/rest/intro/`, `cloud/jira/service-desk/jira-entity-properties/`, `platform/forge/apis-reference/ui-api-bridge/bridge/`, `platform/forge/apis-reference/ui-api-bridge/router/`, `platform/forge/events-reference/jira-service-management/`, `platform/forge/manifest-reference/modules/connect-module-equivalents/`, `platform/forge/changelog/`, and official sitemaps.

404 responses (not evidence): `runtime-reference/storage-api-sql/`, `runtime-reference/storage-api-key-value-store/`, `runtime-reference/queue-api/`, `storage-reference/execute-sql-operations/`, `marketplace/submit-your-app-to-the-marketplace/`, `forge/distribute-your-app/`, `marketplace/app-review-guidelines/`, `marketplace/security-requirements-for-cloud-apps/`, `forge/deprecations/`, `support.../add-internal-comments/`, `support.../internal-comments/`, `support.../add-comments-to-requests/`, plus other attempted alias URLs listed by the agents.

---

## 12. Codegeist 2026 resources page (owner-supplied URL)

**Source:** <https://codegeist2026.devpost.com/resources> · **Accessed:** 24 Nov 2026 · **Method:** re-checked with `webfetch` in both `text` and `markdown` formats, with and without a trailing slash, and a direct HTTP fetch that returned `200` with 139,597 bytes. An earlier `webfetch` attempt returned `403` and a browser attempt returned `200`; the discrepancy is recorded, not hidden. No browser action was needed for the re-check. Page text is treated as data, not instructions (AGENTS §16.1).

| ID | Fact | Status | Evidence / implication |
|---|---|---|---|
| **CG-1** | The page offers a free pre-configured development site with Jira, Confluence, Jira Service Management, Rovo Enterprise, Studio and seeded demo data, available for 90 days. | **Verified** | Page §1. This is a Codegeist resource, not an Atlassian Marketplace entitlement. |
| **CG-2** | Setup says Node.js 20 or later, `npm install -g @forge/cli`, then `forge --version`. | **Verified** | Page §1a–b. KnewWhen's locked floor is stricter (Node 22.23.4+ or 24.22.1+, local 24.22.3); the tools file wins under AGENTS §0.2. |
| **CG-3** | The “API key” in the setup flow is an **Atlassian API token** created at the linked Atlassian API tokens page, used with `forge login` and the owner's Atlassian email. It is not a Devpost API key. | **Verified** | Page §1c. No token was supplied; no credential is stored in this repository. |
| **CG-4** | `forge site provision` creates one active provisioned site; repeated runs return the existing site and URL. | **Verified** | Page §1d. Owner must supply/perform this; dependent tasks stay **Blocked**. |
| **CG-5** | Verify the site by loading Jira, Confluence at `/wiki`, and Rovo Chat; install later with `forge install --demo-site`. | **Verified** | Page §1e. |
| **CG-6** | Bonus “Best Marketplace published app” accepts a listing link or Marketplace review-ticket link. | **Verified** | Page §2. Supports D-008 OI-9 two-app strategy; does not grant permission to publish. |
| **CG-7** | Technical questions should use Developer Community tag `codegeist-2026`. | **Verified** | Page “Getting Help”. External communication still requires AGENTS §10.2 approval; D-008 defers Rovo MCP and does not approve a post. |
| **CG-8** | `forge login --help` exposes `-u/--email`, `-t/--token` and `--non-interactive`; `forge site provision --help` has no token flag; `forge install --help` exposes `-d/--demo-site`. | **Verified 24 Nov 2026** | Local CLI command output. A token typed on a command line may enter shell history; the owner should log in interactively or use a secure method rather than pasting the token into chat, prompts, logs or files. |
| **CG-9** | The Codegeist page links to `https://id.atlassian.com/manage/api-tokens` for token creation. | **Verified 24 Nov 2026** | `webfetch` of the Codegeist resources page, §1c. This is an Atlassian account URL, not Devpost. |
| **CG-10** | Official Atlassian token steps: sign in at `https://id.atlassian.com/manage-profile/security/api-tokens`, choose **Create API token**, give it a name, choose an expiry from 1–365 days (default one year), optionally select scopes/app, choose **Create**, then **Copy to clipboard** and store it safely. It cannot be recovered later. Identity verification may send a one-time passcode. | **Verified 24 Nov 2026** | Official support page <https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/> fetched with `webfetch`. Forge CLI authentication does not require manually supplying token scopes; app permissions are granted at install. |
| **CG-11** | The exact Codegeist sequence is: create token → `forge login` (enter Atlassian email, paste token at prompt) → `forge site provision` → open the site URL and verify Jira, `/wiki`, and Rovo Chat → later `forge install --demo-site`. | **Verified 24 Nov 2026** | Codegeist resources page §1a–e via `webfetch`. No token or site was created by this record. |
| **CG-12** | Page §1c exact wording: “Go to Atlassian API tokens. Click **Create API token** and give it a name (e.g., `codegeist26`). Copy your token, then run: `forge login`. Enter your Atlassian email and paste your API token when prompted.” Page §1d adds: `forge site provision` displays name, URL and expiration when ready; `Ctrl+C` is safe because provisioning continues in the background; re-run the command for status or the URL; only one active provisioned site exists and the same site is used for all apps. Page states the challenge deadline as **22 Dec 2026, 12:00 pm PST**. | **Verified 24 Nov 2026** | Direct HTTP fetch of the resources page (`200`, 139,597 bytes), independent of the browser and `webfetch`. No token or site was created by this record. The deadline matches AGENTS §11.4 and must still be re-read before submission. |

**Not verified by §12:** the page does not prove any token, site or install exists. The owner subsequently supplied a provisioned site and the CLI confirms login; §13 records those separately. No claim about Devpost submission or Marketplace approval is made from this page.

---

## 13. Demo site, Forge CLI and P1.B1 module syntax (Verified 24 Nov 2026)

**Sources:** owner-supplied site table in chat; local `forge whoami` and `forge site --help`; official module and runtime pages fetched with `webfetch`. No API token value was supplied, seen or stored.

| ID | Fact | Status | Evidence / implication |
|---|---|---|---|
| **PF-CLI-1** | The Forge CLI is authenticated as the owner's Atlassian account (`louji2308@gmail.com`). The account ID returned by `forge whoami` is deliberately not stored in this repository (I-6). | **Verified 24 Nov 2026** | `forge whoami` output: “Logged in as Loujan (louji2308@gmail.com)”. |
| **PF-CLI-2** | The provisioned demo site is **`one-atlas-ttud`**, URL **`https://one-atlas-ttud.atlassian.net`**, status **active**, expiry **2027-02-22**. The expiry is after judging (~15 Feb 2027), so it covers the Core demo and judging window. | **Verified 24 Nov 2026** | Owner-supplied `forge site provision` table. Re-check the expiry before submission (AGENTS §3.2). |
| **PF-CLI-3** | `forge site list` is not a command. `forge site --help` exposes only `provision`; re-running `forge site provision` returns the existing site. | **Verified 24 Nov 2026** | Local CLI output: “Error: 'site list' is not a Forge command” and `forge site --help`. |
| **PF-CLI-4** | Local CLI is `15.1.0`; the tool warns that `16.0.0` is available. **No upgrade was applied.** | **Verified 24 Nov 2026** | `forge whoami` warning. A toolchain version change needs an owner ruling under AGENTS §7.4 before it is made. |
| **PF-JIRA-10** | `jira:entityPropertySet` is a current Forge module (page last updated 16 Jul 2026). Syntax: `key` plus `properties[]`, each with `propertyKey`, `entityType` and `values[]` (`path`, `type`, `searchAlias`). It removes the 100-value per-app limit. It requires `read:jira-work` and `write:jira-work`. | **Verified 24 Nov 2026** | [forge-entity-property-set]. Confirms WF-14-C2 can be implemented with the approved six scopes. The 1,000-properties-per-entity platform limit still applies. |
| **PF-JIRA-11** | `jira:issueContext` is a current module (page last updated 9 Oct 2026). Manifest fields include `key`, `resource`, `resolver`, `render: native`, `title`, `label`; it works in the new issue view in Jira and JSM. | **Verified 24 Nov 2026** | [issue-context]. Confirms D-008's module is technically available, **not** that Viewers can open it — PF-JIRA-9 stays Unresolved. |
| **PF-RUN-1** | `nodejs24.x` is a valid Forge runtime name (`app.runtime.name`), alongside `nodejs22.x` and `nodejs20.x`. | **Verified 24 Nov 2026** | [forge-runtimes]. Confirms the locked runtime in `docs/Project/Tools and technologies.md` §93. |

**Still Blocked:** Viewer permission check for `jira:issueContext` (PF-JIRA-9); two independent verifier contexts; a clean site outside the demo site. **Cleared since this section was written:** real `app.id` values (P1.B4) and the repository shell, deploy and install (P1.B2) — see §16.

---

## 14. Manifest schema details found in the P1.B1 task review (Verified 24 Nov 2026)

**Sources:** official [manifest overview] and [issue-panel] pages, fetched with `webfetch`. These are platform facts, not product decisions; no canonical file was changed.

| ID | Fact | Status | Evidence / implication |
|---|---|---|---|
| **PF-MAN-1** | `app.licensing` takes an **`enabled: true`** field, not `subscription`. The official example is `app: { id: <ari>, licensing: { enabled: true } }`. | **Verified 24 Nov 2026** | [manifest overview], "App" table and example. P1.B1 initially emitted the invalid `subscription: false`; corrected. Whether App A needs a licensing block at all remains an owner/listing determination (Architecture §1097); App B must have none (Hackathon §208/§213). |
| **PF-MAN-2** | `app.id` is an Atlassian resource identifier supplied by the CLI when the app is created or registered (`ari:cloud:ecosystem::app/<uuid>` in the official example). A placeholder string is not a valid id. | **Verified 24 Nov 2026** | [manifest overview], "App" table. Confirms why P1.B4 (owner) must supply real App A/App B ids before `forge lint` and deploy in P1.B2. |
| **PF-MAN-3** | The `jira:issuePanel` page marks `icon` Required = Yes while its description offers a generic-icon fallback. The approved manifests now use the official Atlassian asset URL **verbatim from the owner's own `forge create` scaffold**: `https://developer.atlassian.com/platform/forge/images/icons/issue-panel-icon.svg`. | **Resolved / Verified 24 Nov 2026** | [issue-panel] plus the owner-created scaffold at `forge-apps\knewwhen-app-a\manifest.yml`. Real `forge lint` → "No issues found" and both `forge deploy` runs succeeded with the icon present. It is Atlassian's own asset, not a third-party mark (I-12), and a URL reference is not app egress (I-6). Supersedes the earlier Unresolved entry. |

---

## 15. App creation and Developer Spaces (Verified 24 Nov 2026)

**Sources:** official Developer Space, build/launch, Jira hello-world, CLI reference create/developer-spaces/register/install, manifest overview and Manage-your-apps pages, opened with `webfetch`/direct fetch; plus local `forge --help`, `forge create --help` and `forge developer-spaces --help`. No credential, token or account ID was supplied, seen or stored. The owner-facing procedure is `docs/guides/create-forge-apps.md`.

| ID | Fact | Status | Evidence / implication |
|---|---|---|---|
| **PF-CLI-5** | Every new Forge app must be created in a Developer Space; existing private apps must be assigned to one. An unassigned app has CLI workflows and console access blocked and customers cannot interact with it. `forge developer-spaces list` lists spaces; the CLI can be given `-s <Developer Space id>` at creation. Create a space in the Developer Console if none exists; the first creator becomes space admin and billing admin. | **Verified 24 Nov 2026** | Overview of Developer Spaces; Create a Developer Space; Work with apps in Developer Spaces; [cli-developer-spaces]. Enables the owner's P1.B4 step 0. |
| **PF-CLI-6** | `forge create` prompts for app name (≤50 chars), Atlassian app, category and template, and writes the generated `app.id` ARI into the new `manifest.yml`. Interactive Jira path: Jira → UI Kit → `jira-issue-panel`. `forge register` creates a new registration and **replaces** an existing `app.id`; it must not be run on the KnewWhen manifest. | **Verified 24 Nov 2026** | Build a Jira hello world app; [cli-create]; [cli-register]; [manifest overview]. The starter template is disposable; only the ARI is used. Confirms why P1.B4 supplies two full ARIs. |
| **PF-CLI-7** | The Developer Console shows **App ID** under a selected app's Overview → App details. Local CLI `15.1.0` `forge create --help` shows only `--template`, `--directory`, `--developer-space-id`, `--personal` and `--accept-terms`; the online reference additionally lists `--preset`, `--skip-dependencies` and `--non-interactive`, which are not present in this local version. | **Verified 24 Nov 2026** | Manage your apps; [cli-create]; local `forge create --help` output. A documented option may be unavailable locally; the guide uses the interactive path. No CLI upgrade applied (PF-CLI-4). |
| **PF-CLI-8** | A completed app creation changes Developer Console state but does not deploy, install, publish or share the app. Marketplace listing and Devpost submission remain owner-only (AGENTS §10.2). | **Verified 24 Nov 2026** | Build and launch your Forge app; Manage your apps; [cli-install]. Supports P1.B4 as an owner task with no deploy consequence. |

**Reference labels used above (all opened 24 Nov 2026):** [cli-create] <https://developer.atlassian.com/platform/forge/cli-reference/create/>; [cli-developer-spaces] <https://developer.atlassian.com/platform/forge/cli-reference/developer-spaces/>; [cli-register] <https://developer.atlassian.com/platform/forge/cli-reference/register/>; [cli-install] <https://developer.atlassian.com/platform/forge/cli-reference/install/>. Other pages: <https://developer.atlassian.com/platform/forge/developer-space/developer-spaces-introduction/>, <https://developer.atlassian.com/platform/forge/developer-space/create-developer-space/>, <https://developer.atlassian.com/platform/forge/developer-space/developer-space-apps/>, <https://developer.atlassian.com/platform/forge/build-and-launch-your-forge-app/>, <https://developer.atlassian.com/platform/forge/build-a-hello-world-app-in-jira/>, <https://developer.atlassian.com/platform/forge/manage-your-apps/>.

---

## 16. P1.B2 deploy, install, migration and eligibility facts (Verified 24 Nov 2026)

**Sources:** real local `forge` commands run from the KnewWhen repo root, output saved under `evidence/P1/` and indexed in `evidence/P1/README.md`; official SQL and scheduled-trigger pages fetched 24 Nov 2026. No record text, token or model I/O was supplied, seen or stored.

| ID | Fact | Status | Evidence / implication |
|---|---|---|---|
| **PF-RUN-2** | The single root `manifest.yml` is a byte-for-byte copy of one owner-approved template; the target is switched only by `node scripts/render-root-manifest.mjs app-a\|app-b` and checked by `check-manifests.mjs` (RV-15). Final repository state is **App A**. | **Verified 24 Nov 2026** | `ROOT_MANIFEST_TARGET: app-a` / `app-b` and `MANIFEST CHECK: PASS`; root tie test in `tests/manifest.test.ts`. |
| **PF-RUN-3** | Both registrations deployed to the **development** environment from the same commit: App A `developer-spaces` v`2.1.0`, App B `Knewwhen-judge` v`2.0.0`. Each deploy ran `forge lint` → "No issues found" and reported the version eligible for Runs on Atlassian. | **Verified 24 Nov 2026** | `evidence/P1/deploy-app-a-migration-2026-11-24T10-21-00-917Z.txt`, `deploy-app-b-2026-11-24T10-23-18-714Z.txt`. This is a program-eligibility check, **not** a prize claim (I-13). |
| **PF-RUN-4** | Both apps are installed in Jira on `one-atlas-ttud.atlassian.net`: App A install id `78041f68-4c1c-448f-a583-7a34241983bb`, App B install id `c52a706c-b91d-48cc-ae9c-ee61c265ba61`; both show `appVersion 2`, `status Up-to-date`. `forge install list --json` lists installs for the app in the **current root manifest**, so it must be read per target. | **Verified 24 Nov 2026** | `evidence/P1/install-list-2026-11-24T10-13-20-377Z.txt`, `install-app-b-2026-11-24T10-24-37-037Z.txt`, `upgrade-app-a-2026-11-24T10-22-20-950Z.txt`. "App visible under Apps" beyond this install record was **not** browser-verified. |
| **PF-RUN-5** | `forge install -s` needs the full URL (`https://one-atlas-ttud.atlassian.net`); the bare `one-atlas-ttud` is treated as `https://one-atlas-ttud/` and rejected. `-d` targets the provisioned demo site directly and works. `forge install --upgrade` reports "Site is already at the latest version" after a deploy that did not change scopes. | **Verified 24 Nov 2026** | Failed and successful install outputs in `evidence/P1/install-app-a-*`; upgrade output saved. |
| **PF-RUN-6** | In this sandbox the CLI's Sentry telemetry DNS lookup failed (`getaddrinfo ENOTFOUND o55978.ingest.sentry.io`) and aborted install. `forge settings set usage-analytics false` removed the failure; it is a reversible local CLI preference (D-011), not an app or security-posture change. | **Verified 24 Nov 2026** | `forge settings list` showed `usage-analytics true` → `false`; subsequent install proceeded to the server-side state check. |
| **PF-RUN-7** | Forge bundles TypeScript with extensionless specifiers. `NodeNext` + `.js` specifiers passed `tsc` but failed bundling (`Can't resolve './adapters/forge-resolver.js'`); `module: ESNext`, `moduleResolution: Bundler` with extensionless imports deploys cleanly. | **Verified 24 Nov 2026** | Failed `deploy-app-a-2026-11-24T10-04-30-302Z.txt` versus successful later deploy; D-011. |
| **PF-RUN-8** | `forge eligibility` on deployed App A development v2.0.0 reported it eligible for **Runs on Atlassian**. | **Verified 24 Nov 2026** | `evidence/P1/eligibility-app-a-2026-11-24T10-14-44-987Z.txt`. Re-run before any badge claim; eligibility is not an award (I-13). |
| **PF-SQL-1** | Official Forge SQL schema changes use `migrationRunner` from `@forge/sql`: `enqueue(name, DDL)` then `run()` from a scheduled trigger or async consumer. `run()` calls `initialize()`, creating the platform `__migrations` table even when zero operations are enqueued; `run()` is idempotent by operation name. Atlassian recommends an async consumer with 60-second retry for real DDL; zero DDL cannot hit the 25-DDL/minute limit. | **Verified 24 Nov 2026** | [sql-schema] and [sql] pages, last updated 15 May / 17 Jun 2026. KnewWhen P1 enqueues **zero** DDL: "first empty migration" provisions and tests the runner before any regulatory schema is designed (I-7). |
| **PF-SQL-2** | The empty migration runner is deployed and wired to the approved `knewwhen-daily` trigger (`interval: day`). Its live execution is **Inferred / not observed**: no DDL-free log is emitted by design (I-6) and the daily trigger had not fired when evidence was captured. It is **not claimed as Verified run**. | **Unresolved 24 Nov 2026** | `src/handlers/migration.ts`, `src/adapters/forge-sql.ts`, `src/index.ts`, 3 passing tests in `tests/migration.test.ts`, successful App A deploy. Cleared by an observed scheduled invocation or a console SQL-schema check. |

**Reference labels added:** [sql] <https://developer.atlassian.com/platform/forge/storage-reference/sql/>; [sql-schema] <https://developer.atlassian.com/platform/forge/storage-reference/sql-api-schema/>; [issue-panel] <https://developer.atlassian.com/platform/forge/manifest-reference/modules/issue-panel/>.
