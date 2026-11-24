# Draft — WF-14 Jira case-index projection

**Version:** 0.1 (Draft) · **Date:** 24 Nov 2026 · **Status:** **Proposed**, awaiting owner approval; not a canonical schema
**Authority:** D-008 owner ruling, 24 Nov 2026 (`docs/08-decisions.md`); `AGENTS.md` §3, §5.3, §7.3–7.4, §12.4
**Requirement IDs:** WF-14; C-07, C-09, N-03, N-04, N-08; CF-1, CF-6, CF-7
**Purpose:** propose the searchable Jira entity-property projection and JQL aliases. Forge SQL remains authoritative; the Jira property is only a reduced search mirror.

---

## 1. Decisions this draft implements, and conflicts it must not hide

D-008 ruled: draft the `knewwhen.case-index` property schema and JQL aliases; use `jira:entityPropertySet` for searchable metadata; SQL remains authoritative; entity properties are only a searchable projection; property data is non-sensitive; comments fail closed.

Two conflicts are **Unresolved** and must be settled by the owner before implementation:

| ID | Conflict | Evidence | Proposed resolution |
|---|---|---|---|
| **WF-14-C1** | Owner says key `knewwhen.case-index`; canonical documents say `knewwhen.case`. | D-008 §3 vs `Architecture.md` §11.3 and `Scope.md` C-07.1 | Keep canonical `knewwhen.case` unless the owner explicitly approves a rename in every dependent document. A rename touches the write allow-list, tests, guide and manifest projection. |
| **WF-14-C2** | Owner says module `jira:entityPropertySet`; canonical baseline says `jira:entityProperty` (indexed). | D-008 §1 vs `Architecture.md` §3.6/§13.2 and `Scope.md` C-07 | Prefer `jira:entityPropertySet` if it gives the required aliases without extra scopes, but record an explicit module change before the 1 Dec freeze. Do not edit the manifest until the module and key are approved together. |

No canonical file, manifest, migration or rule file was changed by this draft.

---

## 2. Projection rules

1. The row in Forge SQL is the system of record. A Jira-side property is derived, repairable and never authoritative.
2. The property contains **only** codes, dates, IDs and numeric values. No Jira record text, quote, AI output, rationale, account ID or other personal data (I-6, CF-6, PF-JIRA-1, PF-JIRA-6).
3. One writer: the write-back service consumes an outbox task and sets the property as app. It never moves `decisionVersion` backwards.
4. If Jira and SQL disagree, SQL wins. The reconciler repairs the property and writes an audit event; no decision is changed.
5. Only `APPROVED` rule sets may write a `dueDate` or `daysLeft`. For `PREVIEW`/`UNREVIEWED`, write `deadlineStatus: "NOT_CALCULATED"` and omit the numeric fields (CF-3, OI-3).
6. `daysLeft` is convenience data with an explicit `asOf` date. `dueDate` is the stable value.
7. JQL visibility may lag because entity-property indexing is asynchronous. No freshness SLA may be claimed (PF-JIRA-3).
8. Users who can browse the issue may see these values through Jira/JQL. The disclosure must say so; the app's own role gate cannot change Jira permissions (CF-6).

---

## 3. Proposed property object

The example below uses the owner's requested key for clarity. **Do not implement that key until WF-14-C1 is resolved.** If the canonical key is retained, substitute `knewwhen.case`.

```json
{
  "schemaVersion": 1,
  "caseId": "case_01J9Z...",
  "anchorIssueId": "10001",
  "state": "FLAGGED",
  "signalFlag": 1,
  "routingState": "UNROUTED",
  "decisionStatus": "NONE",
  "decisionVersion": 0,
  "deadlineStatus": "NOT_CALCULATED",
  "awarenessDate": "2026-11-20",
  "awarenessBasisCode": "RECORD_TIME",
  "ruleSetId": "fda-adverse-event",
  "ruleSetVersion": "0.1.0",
  "ruleSetJurisdiction": "US",
  "ruleSetEffectiveDate": "2026-11-24",
  "ruleSetDigest": "sha256:...",
  "ruleSetStatus": "UNREVIEWED",
  "dueDate": "2026-12-20",
  "daysLeft": 26,
  "daysLeftAsOf": "2026-11-24",
  "updatedAt": "2026-11-24T05:00:00.000Z"
}
```

Field notes:

- Enums (`state`, `routingState`, `decisionStatus`, `deadlineStatus`, `awarenessBasisCode`, `ruleSetStatus`) are **proposed technical codes**. The authoritative vocabulary is pending qualified QA/RA rule data (OI-1, WF-15). No code in this draft is regulatory content.
- `signalFlag` uses number `0|1` because the documented entity-property JQL types are number/text/string/user/date, not boolean (PF-JIRA-2).
- `decisionStatus` distinguishes `NONE`, `PROVISIONAL` and `FINAL` so OI-3 can be represented without a deadline. Final regulatory closure is unavailable under unreviewed rules.
- `ruleSet*` fields implement CF-7: ID, version, digest, jurisdiction and effective date are recorded for every calculation and decision. Status is included so a reader can tell why no deadline appears.
- `anchorIssueId` and `caseId` are opaque IDs, not record text.
- No account ID, author name, comment body, quote or model output is stored here.

---

## 4. Proposed JQL aliases

Alias names are proposed and must be approved with the key/module choice.

| Alias | Source field | JQL type | Purpose |
|---|---|---|---|
| `knewwhenProjectionVersion` | `schemaVersion` | number | Filter by projection schema |
| `knewwhenCaseState` | `state` | string | Find flagged / in-review / decided cases |
| `knewwhenSignalFlag` | `signalFlag` | number | Find issues with a validated signal |
| `knewwhenRoutingState` | `routingState` | string | Find routed/unrouted cases without reading a label for every issue |
| `knewwhenDecisionStatus` | `decisionStatus` | string | Find provisional/final decisions |
| `knewwhenDecisionVersion` | `decisionVersion` | number | Find superseded or latest versions |
| `knewwhenDeadlineStatus` | `deadlineStatus` | string | Distinguish not-calculated from calculated |
| `knewwhenAwarenessDate` | `awarenessDate` | date | Search by confirmed awareness date |
| `knewwhenRuleSet` | `ruleSetId@ruleSetVersion` | string | Reproduce calculations |
| `knewwhenRuleSetStatus` | `ruleSetStatus` | string | Confirm only approved rules produced deadlines |
| `knewwhenDueDate` | `dueDate` | date | Deadline queue |
| `knewwhenDaysLeft` | `daysLeft` | number | Convenience sorting; labelled with as-of |
| `knewwhenDaysLeftAsOf` | `daysLeftAsOf` | date | Detect stale convenience values |

Example queries (adjust the key after WF-14-C1 is resolved):

```text
alias = "knewwhenCaseState" and knewwhenCaseState = "FLAGGED"
knewwhenDueDate <= "2026-12-01" and knewwhenDecisionStatus != "FINAL"
knewwhenRuleSetStatus = "APPROVED" and knewwhenDeadlineStatus = "CALCULATED"
```

Fallback path if an alias is unavailable: `issue.property['<approved-key>'].<field>`. This is also the documented query form in PF-JIRA-2.

---

## 5. Tests required before acceptance

- Parity test: every projected field is derived from an authoritative SQL row; no extra field contains text.
- Canary test: synthetic record text, quote and model output never appear in the property or JQL index (N-04).
- Monotonic test: a lower `decisionVersion` cannot overwrite a higher one.
- Rule-status test: `PREVIEW`/`UNREVIEWED` rows have `deadlineStatus: "NOT_CALCULATED"` and no numeric deadline fields.
- Repair test: a modified Jira property is detected and repaired from SQL with an audit event.
- Alias test: each proposed alias resolves to the expected indexed value; fallback `issue.property[...]` query works.
- Freshness test: the UI and tests tolerate index lag and never say “no cases” solely because JQL has not caught up.
- Manifest/scope snapshot test: key and module changes fail without an approval marker (N-03, CF-5).

**Approval needed:** owner chooses the property key, module, alias list and enum vocabulary; QA/RA approval supplies regulatory vocabulary before any deadline field is trusted.
