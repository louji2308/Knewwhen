# Production integration and adapter checklist

**Date:** 25 Nov 2026 · **Baseline:** `de6230c` · **Status:** Local wiring only; production is deliberately fail-closed · **Not a deployment plan authorisation**

The pure services and strict view models exist. The runtime adapter supplies only identity, a SQL port, an audit sink and fail-closed defaults. Every missing source below must be approved and injected before the app can produce a real judge journey. No new dependency, scope, role or module is implied by this list.

## Checklist

| ID | Port or source | Code seam | Current state | Proof required before use | Status |
|---|---|---|---|---|---|
| **IN-01** | Forge SQL + migration | `src/adapters/forge-sql.ts`; `runSchemaMigration()` | SQL port exists; live migration invocation not observed. | Run on a clean site; observe all 14 migrations including `015-writeback_attempt`; confirm idempotent second run (PF-SQL-2). | Blocked — live proof absent |
| **IN-02** | Server-side role resolver | `resolveRoles` in `src/adapters/forge-resolver.ts:103,153` | Always returns `[]`, so every gated action denies. | Approved source of Reviewer/QP/admin roles; role matrix on live platform; no client-supplied role (D-013). | Not injected — approval needed |
| **IN-03** | Browse-permission adapter | `canBrowseResource` in `src/adapters/forge-resolver.ts:164,172` | Hardcoded `false`. | Clean-site `jira:issueContext` read-only permission result (PF-JIRA-9); deny path audited. | Not injected — permission fact unresolved |
| **IN-04** | Admin settings store | `AdminHandlerDependencies.settingsStore` in `src/handlers/admin.ts:29` | Absent; admin dispatcher has no KVS adapter. | Persist, re-read and re-parse settings; unsafe values rejected; audit actor correct. | Not injected |
| **IN-05** | Hash-key material | `currentKey`, `keyFor` in `src/adapters/forge-resolver.ts:90–91` | Both return `null`; evidence capture cannot authenticate. | Approved per-installation secret store; create-if-absent, lost-race adoption and fail-closed key errors. | Not injected |
| **IN-06** | Live Jira segment reader | `liveSegment` in `src/adapters/forge-resolver.ts:98` | Always `ISSUE_UNAVAILABLE`. | As-user re-fetch of current segments; MODIFIED/UNAVAILABLE handling; no record text stored. | Not injected |
| **IN-07** | Time-zone rule | `timeZone` in `src/adapters/forge-resolver.ts:102` | `null`; no candidate date conversion. | QA/RA-approved rule data; no invented regulatory convention. | Blocked — OI-1 |
| **IN-08** | Rule bundle and question set | `src/adapters/rule-data.ts` | `runtimeRuleBundle = null`; question set status `FAILED/MISSING`. | Reviewed `rules/*.json`; SHA-256 recorded; status gate observed in panel and calculation. | Blocked — OI-1 |
| **IN-09** | Lookback service ports | `LookbackService` / `LookbackHandlerDependencies.lookback` | No lookback service injected, so `RUN_LOOKBACK` and `CONFIRM_SAME_EVENT` are unavailable. | As-user JQL, segment metadata, acceptance side-effect, caps and coverage codes on live site. | Not injected |
| **IN-10** | Manual scan and write-back retry | `OperationDependencies.manualScan` / `retryWriteback` | Absent; gated operations return honest `NOT_FOUND`. | Scan same pipeline as triggers; retry respects marker and five-write allow-list. | Not injected |
| **IN-11** | Jira create-issue sample port | `AdminHandlerDependencies.loadSample` | Absent; `LOAD_SAMPLE` cannot run live. | Create only `knewwhen-sample` issues in a watched project; second load returns `ALREADY_LOADED`. | Not injected |
| **IN-12** | Health query port | `AdminHandlerDependencies.health` | Absent; no live SQL health data. | Bounded queries using only frozen columns; required-source failure returns `HEALTH_DEPENDENCY_FAILED`. | Not injected |
| **IN-13** | Reconciler and scheduled trigger | `src/services/reconciler.ts`, `src/handlers/scheduled.ts` | Service and handler exist; no live reconciler port or observed scheduled invocation. | Run twice; second run changes nothing; cursors and IDs shape-validated; budget respected. | Not injected |
| **IN-14** | Write-back consumer | Outbox services and marker logic exist. | No queue/scheduled processor wired to process tasks. | Property and comment created once under 429/5xx, crash and duplicate retries; JQL finds A1; comment fails closed. | Not injected |
| **IN-15** | Product-event trigger adapter | `src/handlers/trigger.ts` and manifest triggers | Pure trigger exists; live event-to-scan wiring not observed. | Official event identifiers; event payload treated as untrusted; duplicate/late events idempotent. | Not injected |
| **IN-16** | AI gateway and controlled live call | `LlmGateway`, `LlmPolicy`, `LlmState` seams in scan/LLM tests | Fakes and strict parser exist; no live model call. | One owner-approved synthetic call; usage/cost recorded; no input/output stored; `npm run check` still does not call the model. | Blocked — DR-18 access/cost |
| **IN-17** | Audit sink | `auditRepository` in `src/adapters/forge-resolver.ts:60–73` | Wired to the SQL repository with actor mapping from `AuditEvent`. | Live append-only rows with structured actor, code-only details and no payload text. | Wired locally; live proof absent |
| **IN-18** | Personal-data erasure cycle | No implementation. | U-5 unresolved; no tombstone cycle. | Account IDs declared personal data; erasure replaces IDs with tombstone and keeps record; proof on live site. | Blocked — U-5 |
| **IN-19** | Deployed non-shell build | Root `manifest.yml` is App A; both apps installed as development shells. | Current P10 code has not been deployed or installed. | Both App A and App B built from one frozen commit; parity passes; outside-org install succeeds. | Not done — owner-gated |
| **IN-20** | Runtime evidence pack | `evidence/preparation/evidence-pack-index.md` | Partial index only. | Close all C-12 gaps, then re-run the full gate and Verification A/B on the exact commit. | Partial |

## Safe current behaviour

Because roles are empty, browse is false, no settings/key/rule/Jira ports are injected and no hidden demo path exists, live resolver calls fail closed with `NOT_PERMITTED` or `NOT_FOUND`. This is correct for an unintegrated build. It must not be described as a working feature or used as a judge demonstration.

## Approval boundaries

- The source of roles, groups and browse permission is a product/security decision; do not add a package, scope or admin action to solve it without an owner ruling (AGENTS §7.4, §10.2).
- No production deploy, public sharing, Marketplace submission or Devpost submission may follow from this checklist without explicit owner approval.
- When a port is approved, inject only that port, add a regression test at the adapter boundary, re-run `npm run check`, and update the corresponding `TODO.md` row with evidence before marking it complete.
