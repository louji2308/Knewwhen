# Platform facts — KnewWhen

**Version:** 1.0 · **Date:** 24 Nov 2026 · **Status:** Verified and Unresolved facts recorded; no product decision made here.
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
| **PF-JIRA-8** | `jira:issueContext` status? | **Verified** | **Current** documented module (page last updated 9 Oct 2026), a collapsible panel under the fields on the right. The migration guide says **Issue Glance** will eventually be deprecated; when both modules are defined, `issueContext` is displayed by default. No deprecation notice on the `issueContext` page. Page last updated 23 Nov 2026 for the migration guide. | [issue-context], [future-proof-glance] | Confirms the technical premise behind WF-1. Whether switching modules is Type C remains an owner/governance decision. |

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

Additional official pages opened as context but not load-bearing: `storage-reference/sql-tutorial/`, `storage-reference/sql-data-types/`, `storage-reference/kvs/`, `runtime-reference/fetch-api/`, `runtime-reference/authorize-api/`, `events-reference/`, `events-reference/product_events/`, `manifest-reference/modules/`, `manifest-reference/modules/consumer/`, `manifest-reference/modules/scheduled-trigger/`, `manifest-reference/modules/jira-entity-property-set/`, `manifest-reference/modules/index-jira/`, `manifest-reference/modules/index-jsm/`, `platform-quotas-and-limits/`, `limits-sql/`, `limits-async-events/`, `limits-llm/`, `faq-privacy-security/`, `in-scope-end-user-data/`, `user-privacy-guidelines/`, `security/`, `app-context-security/`, `apis-reference/product-rest-api-reference/`, `apis-reference/fetch-api-product.requestjira/`, `marketplace/`, `marketplace/onboarding-hub/launch/submit-for-review/`, `marketplace/security-scanning/`, `marketplace/ecoscanner/`, `marketplace/vulnerability-management-for-marketplace-apps/`, `marketplace/creating-a-marketplace-listing/`, `marketplace/marketplace-partner-program/`, `forge/`, `forge/versions/`, `forge/developer-space/publish-developer-space/`, `forge/developer-space/developer-space-apps/`, `cloud/jira/platform/jira-entity-properties/`, `cloud/jira/platform/storing-data-with-entity-properties/`, `cloud/jira/platform/modules/entity-property/`, `cloud/jira/platform/security-for-forge-apps/`, `cloud/jira/platform/webhooks/`, `cloud/jira/service-desk/rest/`, `cloud/jira/service-desk/rest/intro/`, `cloud/jira/service-desk/jira-entity-properties/`, `platform/forge/apis-reference/ui-api-bridge/bridge/`, `platform/forge/apis-reference/ui-api-bridge/router/`, `platform/forge/events-reference/jira-service-management/`, `platform/forge/manifest-reference/modules/connect-module-equivalents/`, `platform/forge/changelog/`, and official sitemaps.

404 responses (not evidence): `runtime-reference/storage-api-sql/`, `runtime-reference/storage-api-key-value-store/`, `runtime-reference/queue-api/`, `storage-reference/execute-sql-operations/`, `marketplace/submit-your-app-to-the-marketplace/`, `forge/distribute-your-app/`, `marketplace/app-review-guidelines/`, `marketplace/security-requirements-for-cloud-apps/`, `forge/deprecations/`, `support.../add-internal-comments/`, `support.../internal-comments/`, `support.../add-comments-to-requests/`, plus other attempted alias URLs listed by the agents.
