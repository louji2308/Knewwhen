# OI-4 operating defaults

**Version:** 1.0 · **Date:** 24 Nov 2026 · **Status:** **Approved** operating defaults by D-009; **not** regulatory rule data and **not** a performance SLA
**Authority:** D-008 owner ruling supplied the values; D-009 owner blanket approval approved them (`docs/08-decisions.md`); `AGENTS.md` §3, §5.3, §7.2, §7.4, §12.4
**Requirement IDs:** OI-4; C-01, C-02, C-03, C-05, C-06, C-08, C-11, C-12; N-04, N-06
**Purpose:** define the approved numerical limits and the invariants that must hold when they are implemented.

---

## 1. Status and use

The owner supplied the numbers below in D-008 and approved the draft in D-009. They are **Approved operating defaults**. They may be implemented as configuration/settings when the relevant service exists.

They remain:

- **not regulatory content** under I-7;
- **not written to `rules/*.json`** until qualified QA/RA rule data exists and owner approves that separate step;
- **not a performance SLA** under OI-7 — instrumentation and benchmarking are still required before any SLA claim.

No file under `docs/Project/` or `rules/` was changed by this document.

| Class | Status | Where it may live |
|---|---|---|
| Engineering limits (debounce, LLM caps, scan caps, lookback caps, display cap, quote length) | **Approved operating defaults** | Settings service / versioned configuration |
| Regulatory-adjacent thresholds (reminder days) | **Approved as operating defaults only**; QA/RA confirmation still needed before regulatory reliance | Proposed configuration first; only a QA/RA-approved rule set may control deadline calculation |
| Behavioural invariants | **Approved in D-008** | Core/services and tests |

---

## 2. Operating defaults

| ID | Setting | Approved value | Applies to | Verification intended |
|---|---|---:|---|---|
| **OI-4.1** | UI debounce | 5 seconds | Manual scan / search inputs | Unit test: one action after 5 s of quiet, not one per keystroke |
| **OI-4.2** | Automatic LLM calls per unique content version | 1 | Signal Finder | Unit/service test with a fake LLM: same content version reuses the captured result; changed content version is eligible |
| **OI-4.3** | LLM request budget | 100 requests per installation per day | Signal Finder, queues, daily reset | Counter test: 101st request is deferred, not silently dropped |
| **OI-4.4** | LLM token budget | 8,000 input / 1,000 output | Each request and installation accounting | Boundary test at 7,999/8,000 and 999/1,000; model I/O never stored (N-04) |
| **OI-4.5** | Manual scans | 5 per user per 10 minutes | C-02 | Rate-limit test per account ID and rolling window; no shared global counter |
| **OI-4.6** | Lookback relationship depth | 2 hops | C-03 | Test stops after hop 2 and says the search was incomplete if caps stop it first |
| **OI-4.7** | Lookback records examined | 500 initial / 2,000 extended | C-03 | Cap test; `extended` is explicit, never an automatic retry that hides incompleteness |
| **OI-4.8** | Candidates displayed | maximum 25, plus remaining count | C-03 UI | UI/service test: 26+ matches show 25 and a truthful remainder |
| **OI-4.9** | Evidence quote length | 1–1,000 characters | C-01, C-04 | Validator test: 0 and 1,001 rejected; verbatim check still required |
| **OI-4.10** | Reminders | 7, 3 and 1 days before deadline; once daily while overdue | C-05, C-07, P10 reconciler | Idempotency test keyed by case, threshold and due date; no duplicate comment on replay |

---

## 3. Approved behavioural constraints

These are binding because D-008 approved them; they must be covered by tests before implementation acceptance.

1. **Low-strength matches are retained.** No match is automatically discarded because its strength or confidence is low. `LOW` remains a display label, not a dismissal.
2. **Verbatim validation is strict.** A quote is evidence only if it matches the live record after the fixed normalisation. Every non-verbatim, paraphrased, reordered, or out-of-range quote is rejected (I-1, I-2).
3. **LLM failure never means no signal.** A failed, blocked, over-budget or deferred model call produces an explicit degraded state or rules fallback, never `NO_SIGNAL_FOUND` (D-008 OI-4; Architecture §7.3).
4. **Rule status gates deadlines.** Only an `APPROVED` rule set may calculate regulatory deadlines. `PREVIEW` and `UNREVIEWED` rule sets preserve evidence and investigation but produce no deadline numbers (D-008 CF-3/OI-3).
5. **Exact quote validation serves AI, rules and people through one validator.** No second validator may be introduced for a special path (I-1).

---

## 4. Limits held open

| ID | Issue | Handling |
|---|---|---|
| **OI-4-A** | Values are approved defaults, but no benchmark data exists. | Do not call them an SLA. Instrument first (OI-7). |
| **OI-4-B** | Reminder thresholds are numeric and deadline-adjacent. | Do not write them into `rules/*.json` until a qualified QA/RA-approved rule set exists (OI-1, I-7). |
| **OI-4-C** | `daily` reset needs a time zone. | Use the rule time zone only when rule data defines it; until then, display “not calculated” and hold reminder scheduling. |
| **OI-4-D** | Budget counters must survive retries and restarts. | Implementation must use the owning SQL service with idempotency keys; this is a technical choice, not a new scope. |
| **OI-4-E** | Live model call evidence is approved (DR-18) but access is absent. | One synthetic controlled call only after Forge access exists; record usage and cost; automated tests never call the model. |

---

## 5. Test plan before acceptance

- Unit and property tests for bounds: 0/1/1,000/1,001 quote lengths; 499/500/2,000 record caps; 25/26 candidate display; 7/3/1 and overdue reminder thresholds.
- Fake-boundary tests for counters: unique content version reuse, per-installation daily cap, per-user rolling manual-scan window, deferred LLM on failure, duplicate queue delivery.
- A negative test proving a paraphrase or one-character mutation never validates as evidence.
- A negative test proving `NO_SIGNAL_FOUND` is never emitted on LLM failure or budget exhaustion.
- A test proving a `PREVIEW` or `UNREVIEWED` rule set produces no deadline number.
- Evidence saved under `evidence/` with command output, commit SHA and seeds.
