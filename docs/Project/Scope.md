# KnewWhen — Scope (Product Contract)

**Status:** Draft v0.1 for owner approval · **Date:** 23 Nov 2026
**Purpose:** Say exactly what KnewWhen must do, what is optional, what is out, and how each requirement is proved. A requirement is **done** only when every acceptance criterion (AC) passes with the named proof.
**Tags:** **[S]** from an approved source · **[A]** from the Architecture draft (design, not scope) · **[PA]** proposed addition, awaiting approval · **CF-n** conflict (§5) · **OI-n** open item (§5).

## 0. Basis

| Input | Use |
|---|---|
| `Idea.md` | Approved proposal. Sole authority for Core / Should / Stretch tiers. |
| `Tools_and_technologies.md` (locked v1.0) | Authority for technology, modules and constraints. |
| `Hackathon.md` | Distribution, installation and judging constraints. |
| `Architecture.md` (draft v0.1) | Design detail. It supports requirements; it never changes a tier. |
| `Winner_Benchmarks.md` | Engineering bar only (inspectable tests, no data egress, checkable AI). Creates no requirement. |
| **Not supplied** | `Knewwhen.md` (assumed same content as `Idea.md`), `IMPLEMENTATION_PLAN.md`, `docs/02-spec.md`, `docs/03-domain-rules.md`, `rules/*.json`. See OI-1. |

Order of authority: Tools file → Idea → Hackathon → Architecture. Where they disagree, the conflict is shown in §5. Nothing here is silently promoted, demoted, added or removed.

---

## 1. Product in one paragraph

KnewWhen is a Forge app for Jira (JSM optional). It finds the earliest Jira record in which anyone at a medical-device maker wrote or received a possible adverse-event report. It shows the awareness trail and the FDA reporting clocks under each candidate awareness date. A qualified person then records a decision. Results are written back into Jira as JQL-searchable data and a summary comment. It is decision support. It never decides reportability.

## 2. Product boundaries (binding on every requirement)

| ID | Boundary |
|---|---|
| **B-1** | A possible complaint signal is **not** a reportability determination. The app never outputs "reportable / not reportable", never suggests or pre-selects a decision answer, and never claims FDA or EU compliance. |
| **B-2** | Evidence is exact. A quote is shown only if it is word-for-word in the live Jira record (after fixed whitespace normalisation). Source, author, record timestamps and location are kept with it. An AI paraphrase, summary or confidence score is never evidence. Limit of "preserved": CF-4. |
| **B-3** | Time is never merged: **Jira record time** (system), **date received (entered)** (typed by a named person), and **app observation time** are separate fields, each labelled in the UI. |
| **B-4** | An earlier-record match is shown with a plain-language reason and a confidence label. It joins the trail only after a Qualified person answers "same event?" **and** confirms the date basis. |
| **B-5** | A Qualified person owns the decision record. Roles are checked on the server. |
| **B-6** | Deadlines come only from approved, versioned rule data, a pure engine, golden tests and an independent oracle. The review status of the rule set is always visible. |
| **B-7** | FDA deadlines are **Core**. EU deadlines are **Should, preview**. (Conflicting wording: CF-2.) |
| **B-8** | No data leaves Atlassian: no external egress, no third-party runtime code. AI is Forge LLM only, opt-in. |
| **B-9** | The app stores no Jira record text: pointers and keyed hashes only. The exception is text a person writes in the app (rationale, follow-ups, notes). |
| **B-10** | "No signal" is a valid result. A flagged case can never be silently dismissed; it ends only in a decision record. |

## 3. In scope / out of scope

**In scope:** the Core, Should and Stretch features in §4, plus the requirements in §10. Everything else is out until approved.

**Out of scope (explicit):**
- Any reportability yes/no, severity grading, or AI-assigned event coding.
- Filing or submitting reports to FDA or EU authorities. [no source asks for it]
- AI text as evidence; AI self-confidence scores.
- External egress, Forge Remote, containers, third-party runtime packages, Confluence modules, Jira Automation dependency, workflow validators/conditions, Teamwork Graph, user impersonation, Custom UI.
- Forge custom fields (see CF-1).
- Recovering the original wording of an edited or deleted record (unless CF-4 option b is approved).
- Data export or archive in the baseline (only X-01, Stretch).
- Tamper-evidence claims in the baseline (only X-02, Stretch).
- Regimes other than FDA (Core) and EU (preview). Domains other than medical-device complaints. Systems other than Jira Cloud.
- Real patient data or real company/device names in any sample or demo.
- Paid listing, licensing block in the judge app, `app.compatibility`.

## 4. Tiers, dates and scope-cutting rule

| Tier | Target | Requirements |
|---|---|---|
| **Core** | 8 Dec | C-01 Signal Finder · C-02 "Scan this issue now" · C-03 Lookback search · C-04 Awareness trail · C-05 FDA deadline engine · C-06 Decision record · C-07 Jira write-back · C-08 Sample scenario + historical CSV · C-09 Issue panel + glance · C-10 Admin page · C-11 Evidence-only mode · C-12 Test evidence pack |
| **Should** | 15 Dec | S-01 Similar-case precedents · S-02 "Deadlines at risk" gadget · S-03 Rovo agent "KnewWhen Analyst" · S-04 Versioned rule sets · S-05 EU deadlines (preview) |
| **Stretch** | none set | X-01 Printable event file · X-02 Hash-chain integrity check · X-03 Part 806 prompt on software release · X-04 VMSR setting · X-05 IMDRF code pick-lists |

C-02 is the "Scan this issue now" part of the Core Signal Finder item, split out so it can be tested alone. Other dates [S]: Marketplace listing submitted about 1 Dec (hard 8 Dec); Devpost submission 17 Dec (official close 22 Dec 12:00 PT).

**Core outcome to protect:** on a clean Jira site, a judge or customer can go from a possible complaint to a recorded, Jira-visible decision: *signal → lookback → trail → deadlines → decision → write-back*, with test evidence that shows how far to trust it. Lookback and evidence are protected first [S, Idea §10].

**Scope-cutting rule**
1. Never cut, thin out or silently downgrade a Core requirement.
2. If time runs short, cut in this order: all Stretch → Should items → (never Core). Within Should, the Rovo agent goes first [S, Tools §2]. The rest of the Should order is **[PA-5]**: S-02, S-05, S-04, S-01.
3. A Should or Stretch item ships only if all its ACs pass. A half-built item is cut, not shipped.
4. Any change to a Core requirement needs an owner-approved change record: what changes, why, impact on the Core outcome. A cut Core item is disclosed in the listing and test guide.
5. If a requirement cannot be met on the platform, the conflict is shown here with a proposed resolution. It is never worked around quietly.

---

## 5. Conflicts and open items

### 5.1 Conflicts needing owner decision

| ID | Conflict | Effect on this contract | Proposed resolution |
|---|---|---|---|
| **CF-1** | **Modules and "fields".** Idea Core lists "issue glance"; Idea §7 lists 3 × `jira:customField`, `jira:entityPropertySet`, `dashboardGadget`, `rovo:agent`. The locked Tools file says: no custom fields (entity properties do the JQL job); module is `jira:entityProperty`; glance not listed (needs written approval); gadget and Rovo only if approved, Rovo first to cut. Architecture baseline has none of glance, gadget, Rovo. | C-07 uses indexed issue entity properties, not custom fields. C-09 glance, S-02 and S-03 need approval. | Approve entity properties as the meaning of "write-back fields". Decide glance: approve it, or record that the panel carries the nudge. Gadget and Rovo stay Should and need approval (see CF-5). |
| **CF-2** | **EU wording.** Idea tagline, §1 and the §3 flow speak of "FDA or EU vigilance deadline". Idea §6 puts EU in Should (preview). Idea §3 and Hackathon §7.1 say EU is preview. | Core promises FDA only. Tagline and listing over-promise. | Keep tier as is. Change tagline/listing/video text to "FDA deadlines; EU in preview". In Core, "per regime" means FDA. |
| **CF-3** | **"Evidence-only mode" has two meanings.** Idea §10: rules not yet practitioner-reviewed ("ship FDA-only in evidence-only mode, disclosed"). Hackathon §14: admin mode "LLM or Evidence-only" (AI off). The Idea §10 fallback can be read two ways: no deadline numbers, or FDA numbers with a disclosure banner. | C-11 and the fallback if the 24 Nov practitioner review fails. | Two independent named switches: *AI screening* (off/on) and *Rule-set status* (reviewed / preview / unreviewed). Contract default: **unreviewed = no deadline numbers** (fail-safe, as in Architecture). Owner confirms or picks the banner reading. |
| **CF-4** | **"Exact quotes preserved" vs "no text stored".** The boundary asks to preserve exact quotations. Idea and Architecture store only pointer + keyed hash. Jira keeps no comment history, so if a comment is edited or deleted, its original wording cannot be recovered [A §6.5]. | B-2, C-04. | **(a)** Accept (default): "preserved" = pointer, timestamps, fingerprint, live re-display, and a visible MODIFIED/UNAVAILABLE flag; say so in the intended-use text. **(b)** Approve an encrypted per-evidence snapshot (changes privacy design and listing). |
| **CF-5** | **Manifest freeze vs tiers.** Listing is submitted about 1 Dec; Core is due 8 Dec; Should 15 Dec. Adding a module, scope or `llm` after that is a major version needing admin re-consent, and App B is frozen after its outside-org test [Hackathon §8, A §17]. | S-02 and S-03 need new modules; they cannot be added late without risk. | Set a manifest-freeze date. By then decide: put final modules in the first submission, or drop S-02/S-03. |
| **CF-6** | **Write-back vs Viewer role.** Viewers see nothing of trail, deadlines or decisions inside the app [A §13]. But write-back puts due date and decision status in an issue property (readable and JQL-searchable by users who can browse the issue [A-11, unverified]) and a summary comment. | C-07, C-09: the role limit cannot be enforced outside the app. | Property holds codes and dates only; comment visibility is fail-closed (C-07). Intended-use text says anyone with Browse access may see these. Verify property access rules before release. |
| **CF-7** | **"Rules version" (Core) vs "Versioned rule sets" (Should).** | C-06, C-05 vs S-04. | Core: every calculation and decision records id, version and digest of the one bundled rule set. Should: several versions side by side, admin selects, recalculation under a chosen version. Owner confirms this reading. |

### 5.2 Open items

| ID | Item | Impact |
|---|---|---|
| **OI-1** | Inputs not supplied (see §0). Regulatory content — day-count conventions, time-zone rule, which entry types count as awareness, decision-question set and answer vocabulary, signal lexicon location — is **data owned by `docs/03-domain-rules.md` and `rules/*.json`**. This file does not restate it. | Blocks the content of C-05, C-06 questions and the C-01 lexicon, not their code. |
| **OI-2** | Outside deadlines: practitioner review of rules (24 Nov), trademark search (24 Nov), partner verification (20 Nov, status unknown). | Review outcome sets rule status (CF-3). |
| **OI-3** | Can a decision be finalised with no awareness date (for example "not a complaint")? Is the decision record available when rules are UNREVIEWED? Sources are silent. | C-06, C-11. Proposed: yes to both; deadline fields show "not calculated". |
| **OI-4** | Values not set by sources and **not invented here**: debounce delay, LLM caps per issue/site, manual-scan limit, lookback caps and depth, reminder thresholds, min/max quote length, confidence thresholds (set by benchmark). | Must be fixed in the spec before build. |
| **OI-5** | Pass bars for precision/recall are not set. This contract requires honest reporting and HIGH better than MEDIUM (C-03.12). Owner may set hard bars. | C-03, C-12. |
| **OI-6** | Accessibility conformance level not set. Proposed: WCAG 2.2 AA via UI Kit. | N-05. |
| **OI-7** | No numeric performance target is set by any source, so none is invented. | N-02. |
| **OI-8** | Platform assumptions to verify before use [A §18.2]: JSM internal comment, entity-property visibility, group lookup, Rovo invoker identity, personal-data mechanics, event IDs. | C-07, S-03, N-04. |
| **OI-9** | Two-app plan (H-11) depends on a Developer Community answer. | Distribution only, not features. |
| **OI-10** | Proposed additions: **PA-1** admin historical backfill [A §14.6] (C-10); **PA-2** audited "add me to both roles" evaluation action [A §13.1] (C-10); **PA-3** precedent shown only if viewer can browse the earlier issue (S-01); **PA-4** defined behaviour when the sample is loaded twice (C-08); **PA-5** cut order within Should (§4). | Not part of "done" until approved. |

---

## 6. Shared definitions

### 6.1 Roles [A §13.1, §13.3]

| Role | Who | Rights (binding matrix) |
|---|---|---|
| **Viewer** | Any Jira user who can browse the issue | See signal nudge and flagged quotes in records they can read; route to complaint unit (needs their own Jira edit permission). Nothing else. |
| **Reviewer** | Configured QA/RA group or accounts | Viewer rights + manual scan, run lookback, view case/trail/candidates/deadlines, enter receipt date (as PROPOSED), compute deadlines, retry write-back. |
| **Qualified person (QP)** | Configured group or accounts (includes Reviewer rights) | Reviewer rights + answer "same event?" yes/no, confirm trail entry and date basis, draft/finalise/supersede decisions, add follow-ups. |
| **Site admin** | Jira administrators | Admin page only (settings, kill switch, roles, sample loader). No case or decision rights unless also placed in a role; placement is audited. |

### 6.2 Global rules (apply to every requirement; not repeated below)

| ID | Rule |
|---|---|
| **G-1** | **Wording.** No app-authored text states or implies a reportability outcome or compliance. Question text taken from rule data is allowed only as a question. A string scan enforces this over UI, comments, errors and logs. |
| **G-2** | **One quote gate.** Every quote, from AI, rule screener or a person, passes the same verbatim validator. The quote shown is always the live slice of the record, labelled "verbatim from the Jira record (whitespace normalised)". |
| **G-3** | **As-user.** Anything shown to or started by a person is read with that person's Jira permissions. As-app is used only where no user exists (consumers, scheduled job, write-back). As-app results are never shown without an as-user re-fetch. |
| **G-4** | **Server-side authority.** Every resolver call goes through one gate: identity from platform context, issue-browse check, role check. Deny by default; any dependency failure means deny; each denial writes an audit event (no payload). |
| **G-5** | **Append-only and attributable.** Confirmations, calculations, decisions and audit events are never edited or deleted. Corrections add a new version with actor, time, rule-set version and engine version. |
| **G-6** | **Fail closed on authority, degrade on convenience.** Role, rule-set and visibility failures deny. AI, search and reminder failures degrade and say so in words. A degraded or skipped result is never shown as "no signal". |
| **G-7** | **Idempotent.** Every async step is safe under duplicate, late or out-of-order delivery. |
| **G-8** | **Honest states.** Every screen has loading, empty, error (with correlation id), role-not-permitted and degraded states, in plain language that explains domain terms. Dark mode works. |
| **G-9** | **Untrusted content.** Jira text, AI output, typed phrases and ADF structure are data. They are never run as instructions, markup or SQL. |
| **G-10** | **No hidden path.** Sample data and judge-typed text take the same code path. No behaviour keys on sample data. |

### 6.3 Proof legend

**UT** unit test · **PT** property test (fast-check) · **GT** golden cases · **OR** independent oracle · **FK** service test with fakes, including adversarial AI/Jira fakes · **BM** labelled benchmark · **SC** static check (manifest, scope and module snapshot, `forge lint`, `forge eligibility`, import boundary, string and canary scans) · **E2E** manual script on a clean site from an outside organisation (the judge guide steps 1–9 [Hackathon §14]) · **MR** manual review (practitioner, accessibility).

### 6.4 Synthetic fixtures (all fictional names; one scenario is never the product boundary)

| ID | Fixture | Proves |
|---|---|---|
| **SC-1** | **Headline.** A clinic request: "app froze during dose calculation… patient went to the ER". An earlier mention sits in a different ticket created 19 days before (backdated by the CSV importer). | Signal, lookback, deadlines, decision. Expected: two verbatim quotes; source example "11 days left, not 30" (FX-1). |
| **SC-2** | Companion app for a connected device shows a wrong unit; no injury. First mention is a bug ticket from an engineer, linked to a later support request, with different wording. | Generality: link-based lookback, malfunction without injury. |
| **SC-3** | A feature request. | "No signal". |
| **SC-4** | Hard negatives: same reporter / different event; same product / different problem; text-similar feature request; boilerplate-heavy ticket. | False-match control, benchmark. |
| **SC-5** | Evidence drift: cited comment edited, quote moved, comment deleted, record not visible to the viewer. | Evidence states, trail flags. |
| **SC-6** | Hostile text: planted instructions; AI fake returns invented, trimmed or cross-segment quotes. | Verbatim guard, injection posture. |
| **SC-7** | A phone call with no Jira record, entered with an earlier received date. | ENTERED trail entry. |
| **FX-1** | Source example: awareness 19 days before the as-of date → 11 days left on the 30-calendar-day clock, versus 30 for the later date. Rule data must reproduce it, or the mismatch is raised as a conflict. | C-05 headline. |

---

## 7. Core requirements

### C-01 Signal Finder — Core
**Who / problem:** Support agents and engineers read reports first; Reviewers and QPs need the possible complaint found. Today the first awareness hides in tickets nobody labelled as a complaint.
**Behaviour:** On change, scan the issue's summary, description and comments. Return only validated verbatim quotes with pointers, or an explicit "no signal". No severity, no codes, no AI confidence.
**Trigger → input → output:** Trigger: issue created/updated, comment created, link created (comment updated/deleted where the platform offers), daily sweep, or C-02. Input: the **current** issue content, read at scan time (event payload is not trusted for content). Output: a scan record (method, result, versions), evidence items, a case in state FLAGGED, and a flag written to Jira (C-07).

**AC**
1. A quote is accepted only if, after normalisation, it is an exact substring of the live segment, meets the min/max length (OI-4) and does not cross a segment boundary or placeholder.
2. Every one-character change, case change, omitted word, reordered words or boundary-crossing text applied to a valid quote is rejected (PT, generated cases, 0 accepted).
3. AI output that is invented, paraphrased, non-JSON, has extra fields, has unknown segment IDs, or follows planted instructions stores no evidence. The scan falls back to rules and records a reason code.
4. The rule screener runs on every scan. With AI off, blocked, capped, killed or tripped (breaker open), the product still works end to end on rules alone.
5. A scan with nothing validated is stored as NO_SIGNAL with method, lexicon/prompt/model versions, segments seen vs scanned and time. The panel says "No signal found by <method> in N of M segments". It never says "not a complaint". Skipped or deferred segments are listed separately.
6. A segment whose keyed body hash is unchanged is not rescanned. An edited comment is rescanned and its evidence re-validated.
7. Replaying the same event twice, or out of order, creates no second case and no duplicate evidence.
8. Comments written by KnewWhen (marker) are never scanned.
9. AI is **off by default**. Turning it on shows the data-flow disclosure. The kill switch stops new model calls immediately (checked at enqueue, at consumer start and before each call). Per-issue and per-site caps defer segments, shown as "not yet scanned by AI".
10. The event trigger makes no Jira call and no SQL call (SC, UT).
11. **Nudge:** anyone who can browse the issue sees the flagged quotes (re-fetched as them) and a one-click "Route to complaint unit". They see nothing of trail, deadlines or decisions.
12. **Route:** adds the admin-configured label as the clicking user. It succeeds only if that user may edit the issue. It writes a ROUTED audit event. A failure shows its reason.
13. Recall is **measured, not promised**: the rule screener's precision and recall on labelled synthetic segments are reported (C-12).

**Cases:** (+) SC-1 text → two quotes. (+) SC-2 wording → found by link/lexicon or reported as missed by the rule screener. (−) SC-3 → NO_SIGNAL. (edge) quote in a very long description → scanned in windows, not dropped; quote inside a mention/emoji node is rejected. (edge) comment deleted between event and scan → skipped, reason code. (fail) AI timeout, moderation block (`LLM_BLOCKED`), breaker open, malformed JSON (one repair retry, then rules). (fail) hash key missing → evidence capture blocked, admin banner (no new key is generated).
**Permissions / privacy:** Consumer runs as app; no restricted-comment scope. Model input and output are never stored or logged; only counts of rejected quotes are kept.
**Depends on:** Arch §7, §14.1; trigger, scan queue/consumer, normaliser, validator, rule screener, LLM client, KVS settings.
**Proof:** PT (validator), FK with adversarial model fake (all AC3 cases + SC-6), GT (frozen ADF corpus), UT (screener metrics), SC (AC10), E2E steps 4 and 8 using the judge's **own** text, plus a recorded run of SC-1 text through the hosted model (block → fallback).

### C-02 "Scan this issue now" — Core (part of the Signal Finder item)
**Who / problem:** A Reviewer or QP wants a fresh look at one issue now, including a judge's own issue.
**Behaviour:** Starts a scan of one issue on demand. Same pipeline and same output as C-01.
**Pre → trigger → output:** Caller is Reviewer or QP and can browse the issue (as-user check). Button in the panel. Output: scan status, then the normal scan result.

**AC**
1. Viewer and Admin-without-role cannot start it; denial is audited.
2. It skips the debounce delay and the "unchanged" skip. It does **not** skip the kill switch, circuit breaker or caps.
3. A per-user, per-issue limit applies (value: OI-4). Over the limit shows a clear message.
4. The panel polls status (queued, running, done, AI deferred/unavailable). The AI call never runs inside the 25 s resolver limit.
5. On rules-only completion the result appears without waiting for AI.
6. Works on an issue created by the judge in a watched project.
7. An issue in an unwatched project returns `SKIPPED_SCOPE` with a plain message, never "no signal".

**Cases:** (−) feature request → NO_SIGNAL. (edge) issue has no comments. (fail) AI unavailable → rules result and a notice.
**Permissions / privacy:** G-3, G-4. **Depends on:** C-01, resolver gate, queue.
**Proof:** FK (AC1–5, 7), E2E step 8.

### C-03 Lookback search with match reasons and "same event?" — Core
**Who / problem:** QP and Reviewer must find earlier records that may describe the same event ("found, not entered").
**Behaviour:** From a case's anchor trail entry, search **earlier** records and propose candidates. Each shows reasons and a confidence label. A QP confirms or rejects. Lookback never confirms anything itself.
**Trigger → input → output:** Reviewer/QP opens a case and runs lookback. Input: case, anchor entry, cursor. Output: candidates (pointer, record timestamp, reason codes, confidence), next cursor or done, and which caps were hit.

**AC**
1. All searches run as the viewing user. A candidate in a project that user cannot open never appears (FK with a restricted user).
2. Only records created strictly before the anchor's record time, in watched projects, are returned.
3. Sources: links (depth-capped); same reporter; same organisation (JSM only); same product (only if the admin mapped a product field); text overlap from the anchor's **validated quotes**. If a relationship cannot be checked (no JSM, no mapping), the panel names which one.
4. Each candidate shows: issue key, record timestamp with its strength label, reasons in plain words (for example "linked as *relates to*; same reporter; 7 shared distinctive terms"), and one label HIGH / MEDIUM / LOW. No number is ever shown as a probability.
5. Label rules (UT over the decision table): HIGH needs reasons from at least two independent families (relationship and text) with overlap above the HIGH threshold; text-only is capped at MEDIUM; relationship-only is never above LOW; no label ever reads "confirmed".
6. "Same event?" (yes / no / unsure) is QP only. A Reviewer sees candidates but cannot answer.
7. "Unsure" keeps the candidate visible with no effect. "No" persists and the candidate does not resurface unprompted; a QP can reopen it.
8. "Yes" re-fetches the cited segment live, runs the validator, writes an evidence item, a **PROPOSED** trail entry and an audit event. It does **not** set an awareness date (see C-04.5).
9. For an issue-level or link-only candidate, the QP picks the segment from a live list (with author and timestamp), then either types a short phrase (validated, G-2) or takes the whole segment as evidence.
10. When any cap is reached (calls, issues examined, candidates shown, depth) the panel says "search incomplete". It never implies nothing else exists.
11. A run is resumable: results appear step by step within the soft time budget; a closed tab can resume; a 429 returns partial results with a retry time.
12. Confirming an earlier record can become a new anchor, to a bounded depth. Benchmark report (C-12) shows precision, recall and false-match rate per tier and per label on a held-out split. **HIGH must show higher precision than MEDIUM** on that split; if not, the label definitions are changed and re-measured.
13. Candidate text is used for scoring in memory only. SQL keeps pointers, reason codes and numeric overlap, never text.

**Cases:** (+) SC-1: the earlier ticket 19 days before is proposed with reasons. (+) SC-2: link-based match. (−) SC-4: same reporter/different event is never HIGH. (edge) candidate was deleted or moved; JSM absent; many candidates. (fail) Jira 429/5xx → partial; one bad candidate does not fail the run.
**Permissions / privacy:** Reviewer runs; QP decides (G-4). Needs `read:servicedesk-request` only for JSM relationships.
**Depends on:** Arch §8; lookback service, ranker, Jira client (as user), evidence service, C-04.
**Proof:** BM (labelled corpus with hard negatives, tuning split and held-out split), FK (AC1, 2, 6–11), UT (AC5), E2E step 5.

### C-04 Awareness trail — Core
**Who / problem:** QP needs to see who wrote or received what, when and where, and which date counts.
**Behaviour:** An ordered, append-only list per case. Entry types: **RECORD** (backed by an evidence item) and **ENTERED** (a person typed a receipt with no Jira record: date received, who entered, when entered, optional note).
**Trigger → input → output:** From signals (C-01), lookback confirmations (C-03) and manual receipt entry. Output: entries, candidate awareness dates, confirmed awareness entry + basis.

**AC**
1. A RECORD entry shows author, Jira created/updated timestamps, location (issue key and comment), a strength label in words (unedited / edited since creation / edit history not checked), and the live verbatim slice.
2. An ENTERED entry is labelled "entered, not system-recorded" with who and when. It is never shown as a system timestamp.
3. Jira record time, app observation time ("first observed") and received-date-entered live in separate fields. A RECORD entry may carry both a record time and an entered receipt date; both show, neither overwrites the other. Observation time is never used as awareness.
4. For each regime and each basis (`JIRA_RECORD_TIMESTAMP` or `ENTERED_RECEIPT_DATE`), the panel lists the earliest confirmed effective date as the candidate, then all later ones. Timestamp-to-date conversion uses the time-zone rule from the domain rules (OI-1).
5. Only **confirmed** entries can drive a deadline. A QP confirms one entry and one basis. PROPOSED entries (Reviewer entries, lookback "yes") cannot. Changing either later creates a new decision version.
6. If rule data does not say which entry types count as awareness, the panel lists all confirmed entries and pre-selects none.
7. An entry is never edited in place. A mistaken entry is REJECTED with a reason; a correction is a new entry that supersedes it.
8. Each evidence item shows its check state: VALID, RELOCATED, MODIFIED, UNAVAILABLE or UNVERIFIABLE. A degraded item stays in the trail, flagged. The QP must re-confirm it or record why it no longer exists. The decision record shows the flag.
9. If the viewer cannot access the record, the panel shows "record not accessible to you" with pointer and timestamps only, no text. An issue-level 403/404 is treated as ambiguous and changes no stored state.
10. Evidence is re-checked as the viewing user when displayed (short cache, rate-limited per case) and daily for open cases.
11. Reviewer may enter a receipt date as PROPOSED; only a QP confirms it.

**Cases:** (+) SC-1 two RECORD entries. (+) SC-7 ENTERED entry earlier than the ticket. (edge) edited comment (both timestamps shown); backdated imported records (strength labels describe Jira's claims, not independent proof; disclosed in the intended-use text); moved issue (stable IDs, not keys). (fail) SC-5 modified, relocated, deleted, not visible. CF-4 limit applies.
**Permissions / privacy:** G-3, G-4; account IDs are personal data (N-04).
**Depends on:** Arch §6, §9; evidence service, trail service, normaliser v1 (frozen), keyed hasher.
**Proof:** FK (evidence lifecycle, all five states), GT (frozen ADF corpus with expected hashes), UT, E2E steps 5–6.

### C-05 FDA deadline engine — Core
**Who / problem:** QP needs correct FDA clocks and the cost of late recognition.
**Source facts [S]:** FDA clocks are 30 calendar days and 5 work days excluding Federal holidays. Exact counting rules are rule data (OI-1).
**Behaviour:** One pure function: `(awarenessDate, asOfDate, ruleSet, holidayCalendar) → clocks | typed error`. It chooses nothing: not the awareness entry, not the regime, not reportability.

**AC**
1. The engine does no I/O, does not read the clock, and imports nothing from `@forge/*` (SC import boundary).
2. Inputs are ISO `YYYY-MM-DD` strings. Output per clock: `dueDate`, `calendarDaysRemaining`, `workDaysRemaining` (work-day clocks), `state` (OPEN / DUE_TODAY / OVERDUE), and a trace of every skipped day with its reason (weekend or named holiday).
3. Counting conventions come only from the rule set. A rule file using a parameter the engine does not support is rejected at load (`RULE_SET_INVALID`), never approximated.
4. Typed errors: `RULE_SET_INVALID`, `RULE_SET_UNREVIEWED`, `HOLIDAY_DATA_MISSING(year)`, `DATE_INVALID`. With an error, **no number is shown**; the panel gives the reason; evidence features keep working.
5. **Golden cases** (expected values written from the rule text and practitioner, not from engine output) cover: window starting on a weekend; holiday inside the window; holiday on the due date; leap year; year boundary; timestamps near midnight in several time zones; DUE_TODAY and OVERDUE states; missing holiday year (typed error); preview rule set flagged.
6. **Oracle:** a separate implementation sharing no code with the engine (no shared date helper or rule loader), written by a different author or session, in `oracle/`, dev-only. Engine and oracle agree on `dueDate`, remaining days and the full trace for every case, over at least **10,000 generated cases per run**, seed logged. Metamorphic checks hold: a work-day due date never falls on a non-working day; adding a holiday never moves a due date earlier; due date never decreases as awareness date increases.
7. **FX-1:** with awareness 19 days before the as-of date, the 30-calendar-day clock shows 11 days left; the later candidate date shows the larger value. All shown numbers are computed, never constants in text.
8. **Sensitivity view:** for every candidate awareness date from the trail, clocks show side by side, with the line "If this was the first knowledge: N days left".
9. Rule files are bundled; nothing is fetched at runtime. Federal holidays come from the OPM list with a citation per year.
10. Every calculation is stored append-only with: awareness date and basis, regime, rule-set id, version, status and SHA-256 digest, engine version, time-zone rule id, as-of date, full result. A recalculation adds a new row.
11. Deadlines never say "compliant", "late filing" or equivalent; they show dates and counts attached to a rule-set version.

**Limits stated in the evidence pack:** oracle agreement shows the arithmetic is consistent, not that the legal reading is right. Rule data is common to both, so a wrong holiday entry would be common-mode. The controls are the separately built golden holiday set and the practitioner review.
**Depends on:** Arch §10; rule loader, edge date converter (`Intl.DateTimeFormat`), deadline service, `rules/*.json`.
**Proof:** GT, OR, PT (metamorphic), SC (AC1), MR (practitioner review), E2E step 6.

### C-06 Decision record — Core
**Who / problem:** A QP must record a documented, consistent decision, so similar events are not decided differently.
**Behaviour:** A role-checked record with the confirmed awareness entry and basis, the deadline calculation it relies on, answers to the public decision questions (from rule data), a rationale, follow-ups and the rule-set version.

**AC**
1. Only a QP can create, finalise or supersede a decision or add a follow-up. Role is resolved on the server, fresh for each request. Reviewer, Viewer and Admin-without-role are denied; a role-lookup failure denies; every denial is audited (matrix test).
2. Content: awareness entry + basis; cited `deadline_calc`; question set id/version and the answer code chosen for each question; rationale; follow-ups; rule-set id@version; a snapshot of each cited evidence item's check state at finalising.
3. The app never derives, suggests, ranks or pre-fills an answer. No default selection. No reportability wording (G-1).
4. States: DRAFT (editable) → FINAL (immutable). A correction is a new version with a mandatory reason; the old version becomes SUPERSEDED and stays readable.
5. Finalising twice (double click, retry) changes nothing and returns the existing FINAL record.
6. "This is not a complaint" is itself a decision record with rationale. A flagged case cannot be deleted or hidden.
7. Follow-ups have an owner, a due date and a status, and are written by a person. The daily job creates at most one reminder per case + threshold + due date. Thresholds and reminder channel: OI-4, CF-6.
8. If cited evidence later becomes MODIFIED or UNAVAILABLE, the decision shows that.
9. Rationale and follow-up text are stored (declared exception to B-9). The UI says not to paste record text.
10. The record stores structured features (product key, answer codes, reason codes of the confirmed match), no text, so S-01 can be built later.
11. Integrity claim is limited to append-only behaviour plus audit events. No tamper-evidence claim (X-02).
12. Finalising without an awareness date, and in UNREVIEWED mode: OI-3.

**Cases:** (+) SC-1 finalised. (+) SC-3-like "not a complaint" decision. (edge) superseding after rule-set change; evidence degraded after finalising. (fail) role lookup down → deny; double submit.
**Permissions / privacy:** G-4; QP only. **Depends on:** Arch §11.1–11.2; decision service, authorisation gate, deadline service, evidence service.
**Proof:** FK (matrix: every handler × role × browse allowed/denied; handler list equals matrix), UT, SC (string scan), E2E step 7.

### C-07 Jira write-back (searchable data + summary comment) — Core
**Who / problem:** Results must live in Jira so filters, dashboards and Automation can use them without the app.
**Behaviour:** After a signal or a finalised decision, the app writes an indexed issue entity property and a decision-summary comment, as the app, through an outbox.

**AC**
1. Issue entity property `knewwhen.case` holds codes, dates and ids only: schema version, case id, state, signal flag, decision status and version, awareness date and basis, rule-set id@version, due date, days left with its as-of date. Never text.
2. The JQL given in the test guide finds the issue (allowing for index delay, E2E waits and re-checks). `dueDate` is authoritative; `daysLeft` is refreshed daily and labelled with its as-of date.
3. The summary comment contains: decision version, awareness date and basis with evidence strength, rule-set id@version, due dates, the recording QP (mention), a link to the panel, and the fixed line "decision-support record, not a regulatory determination". The rationale is **excluded by default**.
4. The comment carries a body marker and a `knewwhen.generated` comment property so the scanner skips it and a retry can find it.
5. **Visibility fails closed.** On JSM the comment is internal. On other projects the admin must choose a visibility first; until then tasks wait as PENDING with a visible reason. A JSM customer reporter never sees it (CF-6, OI-8).
6. Duplicate delivery, or a crash after posting but before saving the comment id, still yields exactly one comment.
7. A failed write-back shows FAILED in the panel and admin health, can be retried by a Reviewer/QP and by the daily job, and never changes or reverts the stored decision.
8. A new decision version posts a new comment that refers to the earlier one. Earlier comments are never edited. The property never moves to a lower decision version.
9. If Jira and SQL disagree, SQL wins: the property is repaired; a deleted comment is reported, not silently reposted.
10. The app can perform exactly five Jira write operations: set issue property, set comment property, add comment, add label, create issue. A test fails if any other write endpoint is reachable.
11. EU (preview) clocks are not written back unless the admin explicitly enables preview write-back (S-05).

**Cases:** (+) SC-1. (edge) edited property by a user; index lag; JSM vs plain Jira. (fail) Jira 429/5xx, comment deleted by a user.
**Permissions:** `write:jira-work` as app; the routing label is written as the user. **Depends on:** Arch §11.3, §14.4; write-back service/consumer, outbox, `jira:entityProperty`.
**Proof:** FK (AC4–9, 11), SC (AC10), E2E step 7 (run the JQL).

### C-08 One-click sample scenario + historical CSV for Jira's importer — Core
**Who / problem:** A judge or new customer needs a realistic site within minutes, and the headline "found, not entered" must rest on system timestamps.
**Behaviour:** Admin page "Load sample scenario" creates tagged issues. A generator also produces a CSV for Jira's importer with backdated comments.

**AC**
1. "Load sample scenario" creates issues tagged `knewwhen-sample` in an admin-chosen **existing** project. It works in plain Jira and in JSM.
2. The set covers more than one scenario: at least SC-1, SC-2, SC-3 and SC-4, all with fictional names and no real patient data or trademarks.
3. Issues created now carry timestamps of now. The guide and the UI say which evidence is system-timestamped and which is entered. The headline "19 days earlier" case is delivered by the CSV import (Jira sets *Created*), so it is system-backed.
4. The CSV is built by a small hand-written writer that quotes every field and writes one `Comment` column per comment as `date;accountId;body`. The same seed gives a byte-identical file.
5. Importing the CSV in Jira produces backdated comments and issues (E2E).
6. The generator also writes the ground-truth labels used by C-12. The benchmark uses a larger, separate seed.
7. Cleanup is documented as an admin bulk delete by JQL (`labels = knewwhen-sample`). The app does not delete.
8. Sample issues take the normal scan path (G-10).
9. Loading twice must not fail silently; defined behaviour is **[PA-4]**.

**Proof:** UT (writer, determinism), FK, E2E steps 3 and 9.

### C-09 Issue panel and issue glance — Core (glance: conditional, CF-1)
**Who / problem:** Everyone reads a case in one place, shown to each role what that role may see.
**Behaviour:** `jira:issuePanel` carries the nudge, scan status, trail, lookback, deadlines, decision and write-back status. Presentation only: it holds no authority; every action goes through the resolver gate.

**AC**
1. Viewer sees only the nudge, flagged quotes and "Route". Reviewer and QP see the sections their role allows (6.1).
2. Every section has loading, empty, error (with correlation id), role-not-permitted and degraded states (G-8). Degraded AI says "AI screening unavailable, rule-based screening used".
3. Evidence strength, confidence and check states are shown as words, never by colour alone. Dark mode works through Atlassian Design System tokens.
4. Scan status and write-back status (PENDING, DONE, FAILED) are visible, with a retry where allowed.
5. Nothing is written to browser storage. The live quote slice exists in UI state only while shown.
6. It works on plain Jira and on JSM issues.
7. **Glance:** if approved (CF-1), `jira:issueGlance` shows case state and days left, only what the viewer's role may see, with no new data path. If not approved, the panel carries the nudge and this AC is closed by the CF-1 decision record, not by omission.

**Proof:** E2E (first five minutes on a fresh site match the demo), SC (string scan), MR (accessibility, dark mode).

### C-10 Admin page — Core
**Who / problem:** A Jira admin sets the app up safely and can see its health.
**Behaviour:** `jira:adminPage`, Site admin only.

**AC**
1. Settings: watched projects; issue-type exclusions; product-identity mapping (component, label prefix or one named field); Reviewer and QP groups/accounts; AI opt-in, per-issue and per-site caps (cannot exceed the code ceiling), kill switch; summary-comment visibility; rule-set status display.
2. Defaults: AI off, both roles empty, write-back blocked until a visibility is chosen. With empty roles, case and decision actions are blocked with an explanation.
3. Turning AI on shows the data-flow disclosure (record text goes to the Atlassian-hosted model).
4. Unsafe or invalid settings are rejected (for example, write-back on with no visibility chosen). Every setting change is audited with before/after codes.
5. A non-admin cannot open or call it; the denial is audited.
6. Sample loader and CSV generator (C-08) are here.
7. First screen is a checklist (roles, projects, rule-set status, AI mode, write-back visibility) plus "Load sample scenario".
8. Health view shows: scans by status/result (7 days), stalled scans, AI use vs caps and breaker state, deferred count, evidence check-state counts, pending/failed write-backs, last reconciler run and caps hit, rule-set version and status, hash-key status.
9. **[PA-1]** Optional historical backfill, with a dry-run count first and AI off by default. **[PA-2]** An audited "add me to both roles" action for evaluation sites.

**Proof:** FK (AC2, 4, 5), E2E steps 1–3, SC (AC1 caps vs ceiling).

### C-11 Evidence-only mode — Core (meaning: CF-3)
**Who / problem:** The product must stay safe and useful when AI is off, or when the rules have not been practitioner-reviewed.
**Behaviour:** Two independent switches. **AI screening** (off/on): off means rule screening only. **Rule-set status** (reviewed / preview / unreviewed), read from rule data.

**AC**
1. AI off: C-01 to C-07 work end to end (rule screener, lookback, trail, deadlines, decision, write-back).
2. Status REVIEWED: deadlines show normally.
3. Status PREVIEW: deadlines show with a persistent "preview, not reviewed" banner and are not written back unless the admin enables it.
4. Status UNREVIEWED: the engine is not called. The panel shows trail and evidence with a visible note and **no deadline numbers** (contract default, CF-3).
5. Both switches show on the admin page and in the panel. Changing a switch does not alter past calculations or decisions.
6. The disclosed fallback if the 24 Nov practitioner review does not land is FDA-only in this mode [S, Idea §10].

**Proof:** FK (matrix of both switches), E2E (flip each, observe), MR (wording).

### C-12 Test evidence pack — Core
**Who / problem:** Judges, customers and a reviewer must be able to check how far to trust the app.
**Behaviour:** `npm run check` runs lint, strict type check, unit/property tests, oracle, `forge lint` and `forge eligibility`, and saves results to `evidence/` for each release candidate. No CI [S].

**AC**
1. The pack holds: commit SHA; engine, normaliser and lookback-profile versions; SHA-256 of every rule file; oracle seed and case count (at least 10,000); golden results; lookback benchmark per tier and per label (precision, recall, false-match rate among HIGH, held-out split); rule-screener metrics; recorded AI-path results (the model is not called in `npm run check`); `forge lint` and `forge eligibility` output; manifest parity report for App A and App B; the clean-site E2E log.
2. Re-running with the same seed reproduces the same results.
3. Results are reported as measured, including unflattering ones.
4. The pack states its limits: oracle ≠ legal validation (C-05); imported timestamps are Jira's claims; edited/deleted wording not recoverable (CF-4).
5. Tests and the oracle are dev-only and are not in the deployed bundle (SC).
6. A summary of the pack is visible from the README and the listing's validation notes.

**Proof:** SC, review of the pack against this list.

---

## 8. Should requirements (target 15 Dec; cut before any Core item)

### S-01 Similar-case precedents — Should
**Who / problem:** A QP should see how similar earlier cases were decided, at the moment of decision, to stay consistent.
**Behaviour:** In the decision view, list earlier decisions in this installation that match on structured features (product key, answer codes, reason codes). Never matches on stored text.
**AC**
1. Visible to QP only.
2. Each precedent shows case, decision version and date, chosen answer codes and awareness basis, beside the current draft.
3. It never pre-fills, suggests or ranks an answer (G-1).
4. Empty state: "No similar earlier decisions".
5. A precedent in an issue the viewer cannot browse shows as "restricted precedent" with no details **[PA-3]**.
6. Needs C-06.10 (features stored). Without it, S-01 is not shippable.

**Cases:** (+) SC-1 and SC-2 decided; a later similar case shows both. (−) SC-4 decoys do not appear as precedents. (edge) superseded decisions show the current version only.
**Proof:** FK, E2E step 7. **Depends on:** Arch §11.1 (`features_json`).

### S-02 "Deadlines at risk" gadget — Should (needs approval, CF-1, CF-5)
**Who / problem:** Reviewers and QPs want all open clocks on a dashboard.
**Behaviour:** `jira:dashboardGadget` reading the `knewwhen.case` indexed properties through JQL. No SQL aggregation of its own.
**AC**
1. Lists open cases sorted by due date, with days left labelled by its as-of date.
2. Shows only issues the viewer can browse, and only to Reviewer/QP. Others see "role not permitted".
3. Empty state when nothing is open. Never shows rationale or record text.
4. Native Jira filters remain the fallback [S, Tools §3]; if the gadget is cut, the JQL in the guide still shows the same list.

**Proof:** FK, E2E (with C-08 data), SC (module snapshot, approval marker).

### S-03 Read-only Rovo agent "KnewWhen Analyst" — Should (needs approval; first to cut)
**Who / problem:** A user wants plain-language answers about one issue's case.
**Behaviour:** `rovo:agent` with exactly two read-only actions. Action names are to be defined before build.
**AC**
1. Exactly two actions; neither writes (manifest and UT check).
2. Actions call the same service layer and the same authorisation gate as the panel (G-4).
3. Answers give status, dates and pointers. Any quote shown is a live validated slice (G-2). No reportability wording (G-1).
4. If the invoking user's identity cannot be verified (OI-8), the agent returns only what a Viewer sees, or S-03 is not shipped.
5. If Rovo is missing on a site, the rest of the app is unaffected.

**Proof:** FK, E2E on a Rovo-enabled demo site.

### S-04 Versioned rule sets — Should (reading: CF-7)
**Who / problem:** Rules change; old calculations must stay reproducible.
**AC**
1. Several immutable rule-set versions can be bundled. A released version is never edited.
2. The admin selects the version used for **new** calculations.
3. "Recalculate under version X" adds a new calculation row and never overwrites.
4. Existing calculations and decisions keep and display the version they were made under.
5. An upgrade adds versions and never alters history.

**Proof:** UT, FK (upgrade test with existing rows), GT/OR run against each shipped version.

### S-05 EU deadlines (preview) — Should
**Who / problem:** EU vigilance users see the 2 / 10 / 15 day clocks from awareness [S, Idea §1], clearly marked unreviewed.
**AC**
1. Shipped as a rule set with status PREVIEW, shown with a persistent "preview, not reviewed" banner.
2. Not written back to Jira unless the admin enables preview write-back.
3. Which events each clock applies to is rule data (OI-1), not code.
4. The same oracle and golden tests (C-05.5, C-05.6) cover every shipped rule set, preview included.
5. FDA features work unchanged if EU is absent.

**Proof:** GT, OR, FK, E2E.

---

## 9. Stretch requirements (no date; start only when Core and Should are done)

The approved sources give these names only. Behaviour is **not specified** and must be defined and approved before any build. Until then, only the boundary ACs below apply.

| ID | Item | Boundary ACs (already binding) | Open before build |
|---|---|---|---|
| **X-01** | Printable event file | Any print or export marks evidence that is MODIFIED or UNAVAILABLE. It carries the rule-set version and the decision-support notice. It follows B-1 to B-3. Record text appears only as live validated slices. | Format, content, role, and whether it needs the storage change in CF-4(b). Baseline has no export, so users must be told before uninstall. |
| **X-02** | Hash-chain integrity check | Until it ships, no text may claim tamper-evidence. When it ships, a check reports pass or fail and names the first broken record. | What is chained (decisions, audit events), where the chain lives, key custody. |
| **X-03** | Part 806 prompt on software release | A prompt only. A person answers. The app never decides whether a release is reportable (B-1). | Trigger source (a new event may mean a manifest change, CF-5), wording, role. |
| **X-04** | VMSR setting | A setting only; no determination. | The acronym is not expanded in the sources; owner to define it and what the setting changes. |
| **X-05** | IMDRF code pick-lists | Codes are chosen by a person; no AI coding (see B-2, Idea §4). Code lists are bundled, versioned rule data with citation, not fetched at runtime. | Which lists, where the code is stored, licence to bundle. |

---

## 10. Non-functional requirements

Each is a testable statement. Where no source sets a number, none is invented.

| ID | Area | Requirement | Proof |
|---|---|---|---|
| **N-01** | Reliability | (a) Resolvers return partial results with a cursor within a soft time budget well under the 25 s limit; consumers stop new work at about 80% of their timeout and re-enqueue. (b) Jira traffic goes through one client that meters calls against the shared 65k points/hour budget, keeps headroom for interactive use, honours `Retry-After`, and ends in a visible FAILED state after the attempt limit. (c) A daily reconciler recovers missed events, stalled scans and missing write-backs, and is safe to run twice. (d) No unbounded loop or pagination. (e) The trigger cannot slow Jira (no calls). | FK (replay, crash-between-steps, reorder), UT |
| **N-02** | Performance | No numeric target is set by the sources (OI-7). Host protection is by design: trigger does no Jira or SQL calls; AI only in queue consumers with timeout ≥ 300 s. | SC, FK |
| **N-03** | Security | (a) Scopes are exactly: `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`, `report:personal-data`, `read:servicedesk-request`. A snapshot test fails on any scope or module change without an approval marker. (b) No admin-configuration scope, restricted-comment scope, delete capability or impersonation. (c) Write allow-list of five operations (C-07.10). (d) One authorisation gate; a test lists every handler against the role matrix. (e) Parameterised SQL only. (f) G-9 injection tests (SC-6). (g) `forge eligibility` passes (no egress). (h) No runtime third-party package; no secret in logs. | SC, FK |
| **N-04** | Privacy | (a) No Jira record text in SQL, KVS, logs, property, comment or error text; canary strings must not appear in any of them. (b) Hashes are HMAC-SHA-256 bound to issue and segment, with a per-installation random key; no key shared across installations. (c) Model input and output are never stored. (d) Account IDs are declared personal data; the daily job runs the personal-data cycle; default erasure replaces IDs with a tombstone and keeps the record (OI-8; retention fit is the customer's call). (e) Human-authored text is the only stored text (B-9). (f) Listing and privacy text disclose the Forge-hosted AI and say egress is "none". | SC (canary, migration column check), FK |
| **N-05** | Accessibility | UI Kit and Atlassian Design System components only. Meaning is never carried by colour alone. Dark mode works. Every action is reachable by keyboard through the components. Domain terms are explained in plain words. Conformance level: OI-6. | MR |
| **N-06** | Testability | Pure core (normaliser, validator, screener, ranker, deadline engine) imports nothing from `@forge/*`. TypeScript `strict`. Dev-only tools only: Vitest, fast-check, ESLint, Prettier, `forge lint`, `forge eligibility`. `npm run check` runs all of them and saves output to `evidence/`. The builder never grades its own work. | SC |
| **N-07** | Auditability and versioning | Audit events for confirmations, rejections, denials, setting changes, kill-switch use, manual scans, routing. Normaliser and extractor versions are frozen once evidence exists under them. Migrations are forward-only. | FK, GT |
| **N-08** | Distribution | App A (Marketplace) and App B (judge link) are built from the same commit. Their manifests differ only in `app.id` (and a licensing declaration for A if the listing requires it); a parity check in `npm run check` fails on any other difference. Jira-only: no Confluence modules, no `app.compatibility`. App B has no `licensing` block, AI off by default, lower model ceilings, a billing alert, and is frozen after its outside-org test. "Runs on Atlassian" is described as a product property, not as a prize track [Hackathon §2]. Listing carries intended use and non-use: "decision support, not a regulatory determination or legal advice". | SC, E2E |
| **N-09** | Observability | Logs hold ids, codes, counts and durations only. The admin health view (C-10.8) is the user-facing view. No external telemetry. | SC (canary), E2E |

---

## 11. Traceability map

**Workflows:** W0 install and first run · W1 capture → signal → route · W2 lookback → trail · W3 deadlines · W4 decision · W5 write-back and JQL · W6 admin and health.

| Objective | Requirements | Architecture components | Workflow | Verification evidence |
|---|---|---|---|---|
| O1 Find possible complaints in normal work | C-01, C-02, C-09 (nudge) | Trigger, scan queue/consumer, normaliser, validator, rule screener, LLM client | W1 | PT validator, FK adversarial AI, screener metrics, E2E 4 and 8 |
| O2 Find the earliest awareness, "found, not entered" | C-03, C-04, S-01 | Lookback service, ranker, trail service, evidence service, keyed hasher | W2 | BM, FK evidence lifecycle, E2E 5 |
| O3 Show correct FDA clocks and the cost of late recognition | C-05, C-11, S-04, S-05 | Deadline engine, rule loader, edge date converter, deadline service | W3 | GT, OR (10,000+ cases), MR practitioner review, E2E 6 |
| O4 One owned, consistent, documented decision | C-06, S-01 | Decision service, authorisation gate | W4 | Role-matrix FK, string scan, E2E 7 |
| O5 Make results usable in Jira | C-07, S-02, S-03 | Write-back service/consumer, outbox, `jira:entityProperty` | W5 | FK write-back, E2E 7 (run the JQL) |
| O6 Install and try in minutes | C-08, C-09, C-10, C-11 | Admin page, scenario generator, issue panel, settings service | W0, W6 | E2E 1–3 and 9, CSV determinism UT |
| O7 Prove it works, honestly | C-12, N-06 | `oracle/`, `evidence/`, `npm run check` | all | Evidence pack |
| O8 Stay inside trust, privacy and platform limits | B-1 to B-10, G-1 to G-10, N-01, N-03, N-04, N-08 | Gate, Jira client, logger, manifest template | all | SC (scopes, canary, eligibility, parity), FK |
| O9 Stretch value after the Core outcome | X-01 to X-05 | Not designed in baseline | — | Defined and approved first (§9) |

| Boundary | Where enforced | Proof |
|---|---|---|
| B-1 not a determination | G-1, C-06.3, C-05.11, C-09, S-03 | String scan, E2E |
| B-2 exact evidence | G-2, C-01.1–3, C-04.1, C-04.8 | PT, FK, GT |
| B-3 time kept apart | C-04.2–3, C-07.3 | FK, E2E 5–6 |
| B-4 match reason + human confirm | C-03.4–8 | BM, FK |
| B-5 QP owns decision | G-4, C-06.1, role matrix | Matrix FK |
| B-6 approved, versioned, independently tested rules | C-05, C-11, S-04 | GT, OR, MR |
| B-7 FDA Core, EU Should preview | C-05, S-05, CF-2 | Tier tags, listing text review |
| B-8, B-9 no egress, no stored text | N-03, N-04 | `forge eligibility`, canary tests |
| B-10 no silent dismissal | C-01.5, C-06.6 | FK |

---
**End of Scope.md.** Changes to this file after approval go through the change record in §4, rule 4.
