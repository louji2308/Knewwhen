# P10.C1 — accessibility and dark-mode engineering checklist

**Status:** Verified by local source inspection only; browser/manual accessibility review is **Blocked** (no live role-gated UI or clean site, PS-3). This is not a claim of WCAG 2.2 AA conformance (OI-6 is Unresolved).

**Requirement IDs:** N-05, G-8, C-09.3, P10.C1.

| Check | Local evidence | Status |
|---|---|---|
| All fixed UI strings carry plain-language state words, not colour alone | `src/frontend/*-view.ts` string catalogues and their wording-scan tests | Verified locally |
| Every section has loading, empty, unavailable/error and role-restricted states | Existing view-model tests: `tests/awareness-view.test.ts`, `tests/scan-view.test.ts`, `tests/decision-view.test.ts`, `tests/deadlines-view.test.ts`, `tests/lookback-view.test.ts`; P10 view-model suites | Verified locally |
| Controls are reachable by keyboard through native UI Kit components | UI uses `Button`, `RadioGroup`, `DatePicker`, `TextArea`, `Textfield`, `Checkbox` and `Select` from `@forge/react`; no custom canvas or pointer-only surface | Verified by source inspection |
| Labels are attached to inputs | Every `RadioGroup`, `TextArea`, `DatePicker`, `Textfield`, `Checkbox` and `Select` in `src/frontend/index.jsx` declares `label` | Verified by source inspection after P10 wiring |
| Dark mode relies on Atlassian Design System tokens | No hard-coded colours, CSS or inline `style` objects exist in `src/frontend/` | Verified by source inspection |
| Decision wording | Fixed `notice` string is present in all UI string catalogues; banned-phrase scans run in the view-model suites | Verified locally |
| Human manual review with screen reader and 200% zoom on a clean site | No live role-gated site or browser journey available | Blocked |

**Not claimed:** no external audit, no screen-reader run, no mobile gesture test, no contrast measurement. The proposed WCAG 2.2 AA target remains OI-6 and is not an acceptance claim until a human verifies it on the running product.
