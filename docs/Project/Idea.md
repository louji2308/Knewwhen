# KnewWhen — Complaint Awareness & Reporting Deadlines for Jira

> **When did your company first know? Found, not entered.**
> KnewWhen finds the earliest record anyone in your company wrote or received about a possible medical-device adverse event — across your Jira records — so a qualified person can evaluate it, consistently, before the FDA or EU vigilance deadline.

**Codegeist 2026 · Category:** Apps for Specialized Industries · **Bonus:** Best Marketplace published app
**Built on:** Atlassian Forge · Jira (JSM optional) · Forge SQL · Forge LLMs · Rovo · no third-party egress (Runs on Atlassian eligible)

---

## 1. The problem
Under FDA rules (21 CFR 803), the 30-day adverse-event reporting clock starts when **any employee** becomes aware of a possible injury or malfunction — not when Quality finds out. EU vigilance (MDR Art. 87) counts 2 / 10 / 15 days from the day of awareness.

At device makers whose quality records live in Jira, that first awareness usually sits in a support request, a bug report or a comment nobody labelled as a complaint. Weeks later, the quality/regulatory team must reconstruct "when did we know?" by scrolling issue history. Deadlines are tracked in spreadsheets, and similar events get decided differently.

**Why it matters**
- In 2025, **23 of 59** FDA warning letters to device makers alleged reporting violations and **25** cited complaint files (Covington, Feb 2026).
- Recent letters show complaints closed as "feedback", never evaluated, or reported months to years late (e.g., SeniorLife 2025, Avertix 2025, Mast Biosurgery 2025, Specialty Health 2026).

**What's missing today**
- The main Jira-native complaint model (Ketryx WI-07) has **no awareness date, no reportability decision and no deadlines**.
- eQMS tools (Greenlight Guru, TrackWise, AssurX) record or automate the decision **outside Atlassian**, without reconstructing awareness.
- No Marketplace app and no visible Codegeist 2026 entry does this.

## 2. Who it's for
| Role | What they get |
|---|---|
| **QA/RA lead, complaint unit, PRRC** (decides) | An evidence-backed awareness date, correct deadlines, and a documented, consistent decision |
| **Support agents and engineers** (first to read reports) | A nudge when something they're reading may be a complaint, plus one click to route it |
| **Target companies** | Software-centric medical-device makers (SaMD, connected devices, digital health) running their QMS in Jira |

## 3. How it works — context → decision → action
```
Someone writes in Jira / JSM (request, bug, comment, field report)
   ▼
Signal Finder — Forge LLM proposes quotes that may indicate a complaint/adverse event;
   only quotes that exist WORD-FOR-WORD in the record survive; "no signal" is a valid answer
   ▼
Lookback search — "found, not entered": from the case, searches EARLIER records
   (links → same reporter/organisation + product → text match), shows each hit's match
   reason and confidence; the qualified person confirms "same event?"
   ▼
Awareness trail — who wrote/received what, when, where (system timestamp vs
   "date received (entered)"); candidate awareness date per regime; human confirms
   ▼
Deadlines — regulation-exact FDA clocks (30 calendar days / 5 work days excl. Federal
   holidays), EU in preview; "if this was the first knowledge: 11 days left — not 30"
   ▼
Decision record — qualified person answers the public decision questions, sees similar
   past cases, records rationale (the app NEVER outputs "reportable / not reportable")
   ▼
Write-back — JQL-searchable fields + a decision-summary comment on the Jira issue
```

## 4. What makes it new
1. **Found, not entered.** Every other tool records awareness as a typed date. KnewWhen finds it in the organisation's own records.
2. **AI that can't invent evidence.** Only verbatim quotes survive; humans decide. Research shows LLM self-confidence and coding of device events are unreliable, so we don't use them.
3. **Deadline sensitivity.** Shows the deadline under each candidate awareness date, so the cost of late recognition is visible.
4. **Evidence strength made explicit.** System timestamps are shown separately from "date received (entered)".
5. **Consistency.** Similar earlier cases and their decisions appear at the moment of decision.

## 5. Why it has to be an Atlassian app
The evidence that answers "when did we first know?" — who wrote which report, when, in which ticket, linked to what — **exists only in Jira's history**. KnewWhen's outputs go back into Jira as searchable fields and comments, so filters, dashboards, Automation and Rovo can use them without the app.

## 6. Scope
| Tier | Features |
|---|---|
| **Core (by 8 Dec)** | Awareness trail · Lookback search with match reasons and "same event?" · FDA deadline engine with golden tests + independent oracle · Signal Finder (verbatim check, rule-based fallback, "Scan this issue now") · Decision record (role-checked, rationale, follow-ups, rules version) · Write-back fields + summary comment · One-click sample scenario + historical CSV for Jira's importer · Issue panel + glance · Admin page · Evidence-only mode · Test evidence pack (oracle results, precision/recall benchmarks) |
| **Should (by 15 Dec)** | Similar-case precedents · "Deadlines at risk" gadget · Rovo agent "KnewWhen Analyst" (read-only) · Versioned rule sets · EU deadlines (preview) |
| **Stretch** | Printable event file · Hash-chain integrity check · Part 806 prompt on software release · VMSR setting · IMDRF code pick-lists |

## 7. Architecture (Forge)
- **Modules:** `jira:issuePanel`, `jira:issueGlance`, `jira:adminPage`, `jira:dashboardGadget`, 3 × `jira:customField`, `jira:entityPropertySet`, triggers (issue created/updated/commented, link created), queue consumers, daily scheduled job, `llm` module, `rovo:agent` + 2 read-only actions.
- **Data:** Forge SQL as system of record. Pointers + keyed hashes, no comment text stored. Personal-data reporting.
- **Scopes:** read/write Jira work, read users, storage, personal-data reporting, read service-desk requests. No admin-configuration or restricted-comment scopes.
- **Limits handled:**
  - Paged as-user backfill for the 25 s resolver limit.
  - Event-driven capture and per-case caps for the shared 65k points/hour rate limit.
  - Idempotent consumers for delayed or duplicate events.
  - Pre-filter, debounce, caps and a kill switch for LLM use.
- **Distribution:** two app IDs from one codebase — App A submitted for Marketplace listing, App B shared with judges via installation link, frozen until judging ends.

## 8. Demo (≈ 3 minutes)
1. **Hook (0:00):** "Under FDA rules, the reporting clock starts when *any* employee hears of a possible injury — not when Quality finds out."
2. **Signal (0:15):** a clinic writes "app froze during dose calculation… patient went to the ER". Two verbatim quotes are flagged and the request is routed to the complaint unit.
3. **Found, not entered (0:40):** the lookback finds the first mention in a *different* ticket 19 days earlier. On screen: **"If this was the first knowledge: 11 days left — not 30."**
4. **Decision (1:50):** the qualified person confirms the date, sees similar past cases and records the decision. Fields and a comment are written to Jira, and JQL finds them.
5. **Exception (2:30):** a feature request → "no signal found".
6. **Close (2:45):** "Runs on Atlassian eligible · submitted for Marketplace listing · install link and test guide in the description."

## 9. Marketplace plan
- **Listing:** free, Jira-only. Submit around **1 Dec**; **8 Dec** is the hard date for a review ticket.
- **Listing content:** intended use and non-use; "decision support, not a regulatory determination or legal advice"; validation notes with test evidence; supplier-qualification pack; privacy disclosures (Forge-hosted LLM).
- **Why customers install:** it closes a gap in Jira-based QMSs that $12k–60k/yr eQMS tools cover only outside Jira.
- **Repeat use:** every incoming report is screened, and every complaint gets a trail and a decision record.

## 10. Open conditions and key risks
| Item | Deadline | If it fails |
|---|---|---|
| Marketplace partner verification (business or tax ID) | 20 Nov | Main prize only; no bonus |
| Medical-device QA/RA practitioner reviews the rules (~1 hour) | 24 Nov | Ship FDA-only in evidence-only mode, disclosed, or reconsider |
| Formal trademark search for "KnewWhen" | 24 Nov | Switch to a fallback name |
| Judge copy tested from an outside org; listing submitted | 1 Dec (hard 8 Dec) | — |
| Core working end-to-end on a clean site | 8 Dec | Cut Should items; protect lookback + evidence |
| Devpost submission | 17 Dec (deadline 22 Dec 12:00 PT) | — |

**Main risks:** scope versus team capacity, lookback false matches, finished rival entries (e.g., Four Hours, DORA), no domain expert yet, and an audience likely in the low hundreds of organisations.

**Independent judge estimate:** 18–19/25. Stage One pass ≈ 88–92%. Top 3 in category ≈ 10–18% (≈ 24% if the practitioner review and lookback benchmark land). Marketplace bonus ≈ 8–12%.

---
_Full reasoning, evidence and red-team record: `11_final_winner_dossier.md`, `09_final_project_proposal.md`, `10_red_team_report.md`, `04_evidence_register.csv`._
