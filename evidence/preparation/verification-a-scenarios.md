# Verification A — blind scenario list (frozen before execution)

**Date:** 25 Nov 2026 · **Status:** Written; execution **Blocked** · **Not a pass report**

## Handoff rule

Give a separate verifier this scenario list and the requirement documents only: `Idea.md`, `Hackathon.md`, `Winner Benchmarks.md`, `Tools and technologies.md`, `Architecture.md`, `Scope.md`, `Workflow and UI demo.md` and `AGENTS.md`. Withhold `TODO.md`, `Implementation plan.md`, builder reports, handoff blocks and the implementation evidence index. The verifier writes its own expected results before touching the running product, then records actual results with screenshots, logs and requirement IDs.

## Blocking preconditions

1. A clean Jira site and an outside organisation are provisioned (D-008 §4; D-012 did not supply them).
2. A non-shell Core build from the current commit is deployed and installed (current installed apps are shells).
3. Only synthetic data is used; no real patient or personal data is pasted into fields, comments, logs or screenshots.
4. Runtime role, browse-permission and settings sources are approved and injected; production currently fails closed.
5. QA/RA-reviewed rule data is supplied; otherwise C-05 must be observed in evidence-only mode with no deadline numbers.
6. Two independent verifier contexts are available, or the owner records a §13.5 exception. A different model family is not available here.

## Frozen scenarios

| ID | Judge step / journey | Requirement IDs | Verifier writes and checks | Current status |
|---|---|---|---|---|
| **VA-S01** | 1 — Install | C-09, N-08, I-13 | Open the installation link from the outside organisation, accept permissions, confirm the app appears under Apps and the admin page opens on **Get started**. Record the site, org type and version. | Blocked — no outside org or current build |
| **VA-S02** | 2 — Configure | C-10, G-4, I-4 | Add the sample project to Watched projects; add the verifier's own account as Reviewer and Qualified person; choose comment visibility; set routing label; set product identity prefix; leave AI off; note the rule-set chip. Confirm each setting survives reload and is audited without showing record text. | Blocked — no settings store |
| **VA-S03** | 2h — Panel visibility | C-09, WF-2, PF-JIRA-9 | Open any issue in the sample project and pin the panel with Jira's own `Show for all work items` control. Confirm a user with Browse but not Edit can see the panel or record the exact limitation. | Blocked — permission fact unresolved |
| **VA-S04** | 3a — Historical CSV | C-08.4–6, G-10 | Copy the CSV from the admin Code block, map Created, Summary, Description, Labels and Comment in Jira's importer, and confirm H1–H5 with their relative created dates. | Blocked — no live loader |
| **VA-S05** | 3b — Sample load | C-08.1–3, G-10 | Click **Load sample scenario** for the watched project. Confirm A1 and A2 are created now and that their text goes through the normal scan path. | Blocked — no Jira create port |
| **VA-S06** | 3b repeat | C-08.9, D-018 | Load the sample a second time. Confirm an explicit `ALREADY_LOADED` result, no duplicate issues and no deleted issues. | Blocked |
| **VA-S07** | 4 — Signal on A1 | C-01, C-02, C-11, G-2 | Open A1; wait for background scan or use **Scan this issue now**. Confirm two quotes are findable word-for-word in the live description, each labelled “Verbatim from the Jira record (whitespace normalised)”; route to the complaint unit and confirm the label. | Blocked |
| **VA-S08** | 8b — No signal | C-01.5, C-02, G-6 | Scan A2 or a feature request. Confirm “No signal found …” is a completed result, not a degraded or skipped state. | Blocked |
| **VA-S09** | 8a — Judge's own text | C-01, G-10, I-11 | Create the verifier's own issue describing a possible injury or malfunction, scan it, and confirm the same pipeline and wording as the sample. No branch may key on sample data. | Blocked |
| **VA-S10** | 8a fallback | C-04, WF-12 | If rule screening finds no signal, use **Open a case for this issue…**, choose a live segment and confirm the case opens with a PROPOSED trail entry. | Blocked |
| **VA-S11** | 5 — Lookback | C-03.1–5, C-03.10–13, G-3 | Search earlier records as the reviewer. Confirm H1 appears as “19 days before this issue” with match reasons, confidence label and coverage status; H2/H3 appear with weaker reasons. Confirm searcher, timestamp and scope are recorded and “Search again as me” exists. | Blocked |
| **VA-S12** | 5 — Same event decision | C-03.6–9, I-4 | Answer **Same event** on H1 and **Not the same event** on H2. Confirm H1 becomes a PROPOSED evidence/trail entry, H2 moves to rejected, and no awareness date is set by this action. | Blocked |
| **VA-S13** | 8c — Imported anchor | C-03, WF-7 | Scan H5 manually and search earlier records. Confirm H4 is found through the link and that incomplete coverage is stated in words. | Blocked |
| **VA-S14** | 6 — Awareness trail | C-04 all, I-3, CF-4 | Confirm H1 and A1 entries with basis “Jira record time”. Confirm record time and “date received (entered)” remain separate fields. Confirm both candidate dates are shown with no preselection. | Blocked |
| **VA-S15** | 6 — Deadlines | C-05, C-11, FX-1, CF-3 | With reviewed or preview data, confirm “If the first knowledge was H1: 11 days left … If it was this issue: 30 days left” and that counting details name the rule set, inputs and skipped days. With unreviewed data, confirm no numbers and the stated reason. | Blocked — rule data absent |
| **VA-S16** | 7 — Decision | C-06, G-1, I-5, I-4 | As QP, start a decision record, choose the H1 entry, answer every question, author a rationale and finalise. Confirm no answer is pre-filled, suggested or ranked; confirm no reportability or compliance wording; confirm Final v1. | Blocked |
| **VA-S17** | 7 — Write-back | C-07, CF-6 | After finalisation, confirm the Jira property and summary comment, then run the displayed JQL. Re-run after the documented index-lag note if needed. Confirm the property contains codes/dates/ids only and the comment fails closed on visibility uncertainty. | Blocked |
| **VA-S18** | 8e — Role matrix | G-4, C-06.1, C-10.5 | Remove the verifier from Qualified person and reopen A1: answer, confirm and finalise are disabled with reasons. Repeat for Viewer, Reviewer and admin-without-role. Confirm denied calls are audited without payload text. | Blocked |
| **VA-S19** | 8f — New information | C-04.8, C-06.8, C-07.8, I-8 | Edit A1 to remove the ER phrase and reopen. Confirm the evidence reads Modified, the header reports new information since final decision v1, and the Jira comment is unchanged. Confirm a new decision version is required. | Blocked |
| **VA-S20** | Admin states | C-10, N-09, G-8 | Exercise empty, loading, save error, SQL unavailable and health states. Confirm correlation IDs and plain-language messages; no record text or secret appears. | Blocked |
| **VA-S21** | Degradation | C-01.5, C-11, G-6, N-01 | Force or observe Jira 429/5xx, AI unavailable/failure and SQL unavailable. Confirm degraded states say so and are never shown as “no signal”. Confirm retry timing and bounded pagination. | Blocked |
| **VA-S22** | Switches | C-11, CF-3 | Flip AI screening and rule-status switches. Confirm AI off still runs rule screening, AI failure never becomes no-signal, and changing a switch does not alter past calculations or decisions. | Blocked |
| **VA-S23** | Wording | G-1, I-13, N-08 | Scan all reachable UI, comments and errors for forbidden verdict/compliance claims; confirm the required decision-support sentence appears in listing/admin context and EU is described only as preview. | Blocked for live surfaces; local string scans pass |
| **VA-S24** | Accessibility | N-05, OI-6 | Use keyboard only, screen reader and 200% zoom on a clean site in light and dark mode. Confirm all actions reachable, labels attached, meaning not colour-only and domain terms explained. | Blocked — no browser/manual run |
| **VA-S25** | 9 — Cleanup | C-08, Arch §17.5 | Search `labels = knewwhen-sample`, delete with Jira, then uninstall. Confirm the guide's statement that Jira comments/property values remain while stored records are removed. | Blocked |

## Evidence format required for each executed scenario

- Scenario ID, requirement IDs, date/time, site and app version.
- Pass/Fail/Blocked with exact observed text or result code, never invented record prose.
- Screenshots with personal data blurred; logs with code-only IDs.
- Reproduction steps sufficient for the orchestrator to repeat the scenario.
- Any deviation from this list recorded as a new scenario ID, not silently folded into an existing one.

## Current outcome

Verification A is **Blocked**, not Passed. No clean outside-organisation install, current Core build, live role/settings source or QA/RA rule data exists in this environment.
