# WF-14 Jira case-index projection

**Version:** 1.1 · **Date:** 24 Nov 2026 · **Status:** **Approved in principle** by D-009; enum vocabulary still requires qualified QA/RA rule data. v1.1 adds a technical implementation note (WF-14-C3); no product decision changed.
**Authority:** D-008 owner ruling requested the draft; D-009 approved it and resolved WF-14-C1/C2 (`docs/08-decisions.md`); `AGENTS.md` §3, §5.3, §7.3–7.4, §12.4
**Requirement IDs:** WF-14; C-07, C-09, N-03, N-04, N-08; CF-1, CF-6, CF-7
**Purpose:** define the searchable Jira entity-property projection and JQL aliases. Forge SQL remains authoritative; the Jira property is only a reduced search mirror.

---

## 1. Resolved decisions

| ID | Ruling | Effect |
|---|---|---|
| **WF-14-C1** | D-009 retains the canonical key **`knewwhen.case`**. The `knewwhen.case-index` name in D-008 is superseded. | Use `knewwhen.case` in manifests, tests, JQL and docs. |
| **WF-14-C2** | D-009 approves **`jira:entityPropertySet`** for the searchable projection. This is an explicit owner-approved change from the canonical `jira:entityProperty` baseline. | Implement with `jira:entityPropertySet`. Update manifest/scope snapshot and parity tests when P1.B1/B2 are built. Pending canonical wording update in `Architecture.md`/`Scope.md`; those files were not edited here. |

### WF-14-C3 — technical implementation note (not a product decision)

The approved alias `knewwhenRuleSet` is defined as `ruleSetId@ruleSetVersion` (§4), but that expression is not a JSON path and cannot be indexed directly. The P1.B1 manifest therefore indexes a derived string field **`ruleSetRef`** with that alias. The write-back service must set `ruleSetRef` to the exact value `${ruleSetId}@${ruleSetVersion}`; the original `ruleSetId` and `ruleSetVersion` values remain in the authoritative SQL row and CF-7 is unchanged. This is a necessary technical implication (AGENTS §5.3, kind A) of the approved alias, not a new field for users. No canonical file was changed; the property example in §3 should be updated to include `ruleSetRef` at the next authorised revision.

No canonical file, manifest, migration or rule file was changed by this document.

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

## 3. Approved property object

Key: **`knewwhen.case`** (WF-14-C1).

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

- Enums (`state`, `routingState`, `decisionStatus`, `deadlineStatus`, `awarenessBasisCode`, `ruleSetStatus`) are **technical codes approved as a projection contract**, but the authoritative domain vocabulary still requires qualified QA/RA rule data (OI-1, WF-15). No code here is regulatory content.
- `signalFlag` uses number `0|1` because the documented entity-property JQL types are number/text/string/user/date, not boolean (PF-JIRA-2).
- `decisionStatus` distinguishes `NONE`, `PROVISIONAL` and `FINAL` so OI-3 can be represented without a deadline. Final regulatory closure is unavailable under unreviewed rules.
- `ruleSet*` fields implement CF-7: ID, version, digest, jurisdiction and effective date are recorded for every calculation and decision. Status is included so a reader can tell why no deadline appears.
- `anchorIssueId` and `caseId` are opaque IDs, not record text.
- No account ID, author name, comment body, quote or model output is stored here.

---

## 4. Approved JQL aliases

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

Example queries:

```text
knewwhenCaseState = "FLAGGED"
knewwhenDueDate <= "2026-12-01" and knewwhenDecisionStatus != "FINAL"
knewwhenRuleSetStatus = "APPROVED" and knewwhenDeadlineStatus = "CALCULATED"
```

Fallback path if an alias is unavailable: `issue.property['knewwhen.case'].<field>`. This is also the documented query form in PF-JIRA-2.

---

## 5. Tests required before acceptance

- Parity test: every projected field is derived from an authoritative SQL row; no extra field contains text.
- Canary test: synthetic record text, quote and model output never appear in the property or JQL index (N-04).
- Monotonic test: a lower `decisionVersion` cannot overwrite a higher one.
- Rule-status test: `PREVIEW`/`UNREVIEWED` rows have `deadlineStatus: "NOT_CALCULATED"` and no numeric deadline fields.
- Repair test: a modified Jira property is detected and repaired from SQL with an audit event.
- Alias test: each approved alias resolves to the expected indexed value; fallback `issue.property[...]` query works.
- Freshness test: the UI and tests tolerate index lag and never say “no cases” solely because JQL has not caught up.
- Manifest/scope snapshot test: `jira:entityPropertySet` and the `knewwhen.case` key are locked by an approval marker (N-03, CF-5).
