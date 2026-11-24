# P9 local proof (24 Nov 2026)

Checkpoint: `0431a81` (`feat(p9): wire deadline and decision workflow into operations`).

**Command:** `npm run check`
**Result:** PASS. 50 test files, 369 tests; strict TypeScript, ESLint, manifest parity, import boundary, Prettier and `forge lint` (**No issues found**) all pass. Full output: `evidence/P1/check-2026-11-24T17-05-57-160Z.txt`. The pre-commit gate re-ran the same check green.

**Fail-closed proof:** `tests/operation-dispatch.test.ts` asserts that `runtimeQuestionSet` is `FAILED/MISSING`, `currentQuestionSet()` is `null`, `runtimeRuleBundle` is `null`, an Awareness action is refused before the gate, a viewer cannot reach `DECIDE`, `GET_QUESTIONS` returns the fixed missing-rule-data message, and `COMPUTE_DEADLINES` returns `NOT_FOUND` when no rule bundle is injected.

**Decision proof:** `tests/question-set.test.ts`, `tests/deadline-service.test.ts`, `tests/decision-service.test.ts`, `tests/follow-up.test.ts`, `tests/decision-handlers.test.ts`, `tests/decision-view.test.ts` and `tests/deadlines-view.test.ts` cover strict rule-data loading, append-only calculation, QP-only draft/finalise/supersede, one reminder per case/threshold/due date, role and payload stripping, and fixed UI wording with no default answer or record text.

**Not proved here:** live rule data, deployed runtime, demo-site UI visibility, outside-organisation journey, verification A/B, live Jira/SQL effects, live model call. No phase is Accepted.
